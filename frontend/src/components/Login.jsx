import { useState } from "react";

const C = {
  bg: "#080c14",
  card: "#0e1520",
  border: "#1a2536",
  text: "#e8eef8",
  muted: "#7c8aa0",
  teal: "#25dbb0",
  red: "#ff4d5e"
};

export default function Login({ onLogin }) {
  const [digits, setDigits] = useState("");
  const [error, setError] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }
    onLogin("+91" + digits);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: C.bg,
        padding: 16,
        fontFamily: "system-ui, sans-serif"
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: "min(400px, 100%)",
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          padding: 28,
          color: C.text
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: C.teal,
              color: "#04120e",
              display: "grid",
              placeItems: "center",
              fontWeight: 800
            }}
          >
            G
          </span>
          <strong style={{ letterSpacing: 1 }}>
            GAS<span style={{ color: C.teal }}>GUARD</span>
          </strong>
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Sign in</h1>
        <p style={{ margin: "0 0 22px", color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
          Use your mobile number. Your alert history and gas readings are saved under it,
          even after you log out.
        </p>

        <label htmlFor="phone" style={{ fontSize: 13, color: C.muted }}>
          Mobile number
        </label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <span
            style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${C.border}`,
              background: "#0a111b",
              color: C.muted
            }}
          >
            +91
          </span>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            maxLength={10}
            placeholder="98765 43210"
            value={digits}
            onChange={(e) => {
              setDigits(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "12px 14px",
              borderRadius: 10,
              border: `1px solid ${error ? C.red : C.border}`,
              background: "#0a111b",
              color: C.text,
              fontSize: 16,
              outline: "none"
            }}
          />
        </div>

        {error && (
          <p role="alert" style={{ margin: "10px 0 0", color: C.red, fontSize: 13 }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          style={{
            width: "100%",
            marginTop: 20,
            padding: "13px 16px",
            borderRadius: 10,
            border: "none",
            background: C.teal,
            color: "#04120e",
            fontWeight: 700,
            fontSize: 15,
            cursor: "pointer"
          }}
        >
          Sign in
        </button>

        <p style={{ margin: "14px 0 0", color: C.muted, fontSize: 12 }}>
          Demo sign-in: no OTP is sent.
        </p>
      </form>
    </div>
  );
}