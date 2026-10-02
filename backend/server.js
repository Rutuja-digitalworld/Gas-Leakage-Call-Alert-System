import "dotenv/config";
import express from "express";
import cors from "cors";
import twilio from "twilio";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const demoMode =
  String(process.env.DEMO_SMS || "true").toLowerCase() === "true";

const env = (k) => (process.env[k] || "").trim().replace(/^["']|["']$/g, "");

const SID = env("TWILIO_ACCOUNT_SID");
const TOKEN = env("TWILIO_AUTH_TOKEN");
const FROM = env("TWILIO_PHONE_NUMBER");
// Trial accounts block inline TwiML, so we can point the call at a URL instead.
// Leave blank to use inline TwiML (works on upgraded accounts).
const TWIML_URL = env("TWIML_URL");

const E164 = /^\+[1-9]\d{7,14}$/;

// ALERT_NUMBERS format:  Name:+919876543210,Other:+919812345678
// (the "Name:" part is optional). Falls back to REGISTERED_MOBILE_NUMBER.
// Only numbers listed here can ever be called - the browser cannot send its own.
function parseNumbers() {
  const raw = env("ALERT_NUMBERS") || env("REGISTERED_MOBILE_NUMBER");
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const parts = item.split(":");
      const number = parts.pop().trim();
      const label = parts.join(":").trim() || `Number ${index + 1}`;
      return { id: String(index), label, number };
    });
}

const NUMBERS = parseNumbers();

const maskNumber = (n) => `${n.slice(0, 3)}${"*".repeat(Math.max(n.length - 7, 0))}${n.slice(-4)}`;

const twilioConfigured = Boolean(SID && TOKEN && FROM && NUMBERS.length);

// Catch the most common setup mistakes at startup instead of at alert time
const configProblems = [];
if (twilioConfigured) {
  if (!SID.startsWith("AC")) configProblems.push("TWILIO_ACCOUNT_SID should start with 'AC'");
  if (!E164.test(FROM)) configProblems.push("TWILIO_PHONE_NUMBER must be E.164, e.g. +15551234567");
  NUMBERS.forEach((n) => {
    if (!E164.test(n.number)) {
      configProblems.push(`"${n.label}" number must be E.164 with country code, e.g. +919876543210`);
    }
    if (n.number === FROM) {
      configProblems.push(`"${n.label}" is the same as TWILIO_PHONE_NUMBER`);
    }
  });
}

let client = null;

if (twilioConfigured) {
  try {
    client = twilio(SID, TOKEN);
  } catch (e) {
    // Don't crash the whole server on a bad SID/token
    configProblems.push(`Twilio client error: ${e.message}`);
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    smsMode: twilioConfigured && !demoMode ? "twilio" : "demo",
    demoSmsFlag: demoMode,
    twilioConfigured,
    numbersCount: NUMBERS.length,
    configProblems
  });
});

// Numbers the dashboard can choose from (masked, raw numbers never leave the server)
app.get("/api/numbers", (req, res) => {
  res.json({
    numbers: NUMBERS.map((n) => ({
      id: n.id,
      label: n.label,
      masked: n.number ? maskNumber(n.number) : ""
    }))
  });
});

app.post("/api/alert", async (req, res) => {
  const { gasLevel, timestamp, recipientId } = req.body;

  if (typeof gasLevel !== "number") {
    return res.status(400).json({
      message: "gasLevel must be a number"
    });
  }

  // Work out who to call: "all", a listed id, or the first number by default
  let targets;
  if (recipientId === "all") {
    targets = NUMBERS;
  } else if (recipientId === undefined || recipientId === null || recipientId === "") {
    targets = NUMBERS.slice(0, 1);
  } else {
    targets = NUMBERS.filter((n) => n.id === String(recipientId));
  }

  if (!targets.length) {
    return res.status(400).json({
      success: false,
      mode: "failed",
      message: "Unknown recipient. Choose a number from the list."
    });
  }

  const level = gasLevel.toFixed(1);

  // Buzzer-style call: DTMF beeps (w = 0.5s pause) + spoken warning, repeated
  const beeps = "9w9w9w9w9w9w";
  const spoken = `Warning! Gas leakage detected. Gas level is ${Math.round(gasLevel)} percent. Please check the area immediately.`;
  const twiml =
    `<Response>` +
    `<Play digits="${beeps}"/>` +
    `<Say voice="alice" language="en-IN" loop="3">${spoken}</Say>` +
    `<Play digits="${beeps}"/>` +
    `</Response>`;

  if (demoMode || !twilioConfigured) {
    console.log("[DEMO CALL]", {
      to: targets.map((t) => t.label),
      gasLevel,
      timestamp
    });

    return res.json({
      success: true,
      mode: "demo",
      method: "call",
      message: demoMode
        ? "DEMO_SMS=true, so no real call was placed."
        : "Twilio credentials missing in backend/.env, so no real call was placed."
    });
  }

  if (configProblems.length || !client) {
    return res.status(500).json({
      success: false,
      mode: "failed",
      message: configProblems.join("; ") || "Twilio client not ready"
    });
  }

  const sids = [];
  const errors = [];

  for (const target of targets) {
    try {
      const call = await client.calls.create(
        TWIML_URL
          ? { url: TWIML_URL, from: FROM, to: target.number }
          : { twiml, from: FROM, to: target.number }
      );
      console.log(`Twilio CALL placed to ${target.label} (gas ${level}%):`, call.sid);
      sids.push(call.sid);
    } catch (error) {
      console.error(
        `Twilio error calling ${target.label}:`,
        error.code,
        error.message,
        error.moreInfo || ""
      );
      errors.push(`${target.label}: Twilio ${error.code || ""} ${error.message}`.trim());
    }
  }

  // Success if at least one call went out
  if (sids.length) {
    return res.json({
      success: true,
      mode: "twilio",
      method: "call",
      sids,
      failed: errors
    });
  }

  return res.status(502).json({
    success: false,
    mode: "failed",
    message: errors.join(" | ")
  });
});

app.listen(PORT, () => {
  console.log(`GasGuard backend running on http://localhost:${PORT}`);
  console.log(
    `Alert mode: ${twilioConfigured && !demoMode ? "TWILIO (real phone CALL)" : "DEMO (no real call)"}`
  );
  if (demoMode) console.log("  -> DEMO_SMS=true. Set DEMO_SMS=false in backend/.env for real calls.");
  console.log(`  -> Call message source: ${TWIML_URL ? "TWIML_URL (" + TWIML_URL + ")" : "inline TwiML"}`);
  console.log(
    `  -> Numbers: ${NUMBERS.length ? NUMBERS.map((n) => `${n.label} (${maskNumber(n.number)})`).join(", ") : "NONE"}`
  );
  if (!twilioConfigured) console.log("  -> Twilio vars missing/blank in backend/.env (is the file named exactly '.env'?).");
  configProblems.forEach((p) => console.log("  !! " + p));
});