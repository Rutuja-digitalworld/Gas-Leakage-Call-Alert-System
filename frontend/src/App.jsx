import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Dashboard from "./components/Dashboard";
import Circuit3D from "./components/Circuit3D";
import Architecture from "./components/Architecture";
import Login from "./components/Login";
import AlertLog from "./components/AlertLog";
import { getNextGasValue, resetSensor, setSensorValue, setSimulationMode } from "./simulation/virtualSensor";
import { saveAlert, saveReading } from "./services/firebase";
import { getAlertNumbers, sendGasAlert } from "./services/api";
import {
  MAX_ALERTS,
  MAX_POINTS,
  MAX_LOG,
  clearSession,
  getSession,
  isToday,
  loadAlerts,
  loadReadings,
  loadLog,
  saveAlerts,
  saveReadings,
  saveLog,
  setSession
} from "./services/storage";

const THRESHOLD = 60;
const LOG_INTERVAL = 60000; // 1 normal reading per minute goes to the log

function formatTime(date = new Date()) {
  return date.toLocaleTimeString("en-IN", { hour12: false });
}

const maskPhone = (p) => `${p.slice(0, 3)} ******${p.slice(-4)}`;

export default function App() {
  const [phone, setPhone] = useState(() => getSession());
  const [page, setPage] = useState("dashboard");
  const [gasLevel, setGasLevel] = useState(32);
  const [running, setRunning] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [log, setLog] = useState([]);
  const [hiddenBefore, setHiddenBefore] = useState(null);
  const [smsStatus, setSmsStatus] = useState("READY");
  const [lastUpdated, setLastUpdated] = useState(formatTime());
  const [numbers, setNumbers] = useState([]);
  const [recipientId, setRecipientId] = useState("0");

  const previousLevel = useRef(32);
  const alertLocked = useRef(false);
  const recipientRef = useRef("0");
  const phoneRef = useRef(phone);
  const alertsRef = useRef([]);
  const logRef = useRef([]);
  const lastLogged = useRef(0);
  const readingsRef = useRef([]);
  const unsaved = useRef(0);

  phoneRef.current = phone;

  const changeRecipient = (id) => {
    recipientRef.current = id;
    setRecipientId(id);
  };

  useEffect(() => {
    getAlertNumbers()
      .then(setNumbers)
      .catch(() => setNumbers([]));
  }, []);

  const persistReadings = useCallback(() => {
    if (phoneRef.current) saveReadings(phoneRef.current, readingsRef.current);
    unsaved.current = 0;
  }, []);

  // load this number's saved alerts, readings and log after login / page refresh
  useEffect(() => {
    if (!phone) return;
    const storedAlerts = loadAlerts(phone);
    const storedReadings = loadReadings(phone);
    const storedLog = loadLog(phone);
    alertsRef.current = storedAlerts;
    readingsRef.current = storedReadings;
    logRef.current = storedLog;
    setAlerts(storedAlerts);
    setChartData(storedReadings);
    setLog(storedLog);
  }, [phone]);

  // flush readings when the tab is closed or refreshed
  useEffect(() => {
    window.addEventListener("pagehide", persistReadings);
    return () => window.removeEventListener("pagehide", persistReadings);
  }, [persistReadings]);

  const processReading = useCallback(
    async (value) => {
      const owner = phoneRef.current;
      const now = new Date();
      const status = value >= THRESHOLD ? "DANGER" : value >= 40 ? "WARNING" : "SAFE";
      const reading = {
        gasLevel: value,
        status,
        timestamp: now.toISOString()
      };

      setGasLevel(value);
      setLastUpdated(formatTime(now));

      const nextReadings = [...readingsRef.current, { ts: now.getTime(), gas: value }].slice(-MAX_POINTS);
      readingsRef.current = nextReadings;
      setChartData(nextReadings);
      unsaved.current += 1;
      if (unsaved.current >= 5) persistReadings();

      // save a SAFE / WARNING reading to the log once per minute.
      // DANGER is skipped here because the alert entry below already records it.
      if (
        owner &&
        status !== "DANGER" &&
        now.getTime() - lastLogged.current >= LOG_INTERVAL
      ) {
        lastLogged.current = now.getTime();
        const row = {
          id: crypto.randomUUID(),
          ts: now.toISOString(),
          time: formatTime(now),
          gasLevel: value.toFixed(1),
          status,
          smsStatus: "—"
        };
        const nextLog = [row, ...logRef.current].slice(0, MAX_LOG);
        logRef.current = nextLog;
        setLog(nextLog);
        saveLog(owner, nextLog);
      }

      saveReading(reading).catch(() => {});

      const crossedIntoDanger =
        previousLevel.current < THRESHOLD &&
        value >= THRESHOLD &&
        !alertLocked.current;

      if (crossedIntoDanger) {
        alertLocked.current = true;
        setSmsStatus("CALLING");

        let result;
        try {
          result = await sendGasAlert({
            gasLevel: value,
            timestamp: now.toISOString(),
            recipientId: recipientRef.current
          });

          setSmsStatus(result.mode === "demo" ? "DEMO CALL" : "CALL PLACED");
        } catch (error) {
          setSmsStatus("FAILED");
          console.error("Call failed:", error.message);
          result = { mode: "failed", message: error.message };
          alertLocked.current = false; // allow a retry on the next crossing
        }

        // user logged out while the call was being placed
        if (owner !== phoneRef.current) return;

        const entry = {
          id: crypto.randomUUID(),
          ts: now.toISOString(),
          time: formatTime(now),
          gasLevel: value.toFixed(1),
          status: "DANGER",
          smsStatus:
            result?.mode === "demo"
              ? "DEMO CALL"
              : result?.mode === "twilio"
                ? "CALL PLACED"
                : "FAILED"
        };

        const nextAlerts = [entry, ...alertsRef.current].slice(0, MAX_ALERTS);
        alertsRef.current = nextAlerts;
        setAlerts(nextAlerts);
        if (owner) saveAlerts(owner, nextAlerts);

        saveAlert({ ...entry, timestamp: entry.ts }).catch(() => {});
      }

      if (value < 40) {
        alertLocked.current = false;
        setSmsStatus("READY");
      }

      previousLevel.current = value;
    },
    [persistReadings]
  );

  useEffect(() => {
    if (!running || !phone) return;

    const interval = setInterval(() => {
      processReading(getNextGasValue());
    }, 1500);

    return () => clearInterval(interval);
  }, [running, phone, processReading]);

  const login = (p) => {
    setSession(p);
    setPage("dashboard");
    setPhone(p);
  };

  const logout = () => {
    persistReadings();
    clearSession();
    alertsRef.current = [];
    readingsRef.current = [];
    logRef.current = [];
    lastLogged.current = 0;
    alertLocked.current = false;
    previousLevel.current = 32;
    setAlerts([]);
    setLog([]);
    setChartData([]);
    setHiddenBefore(null);
    setSmsStatus("READY");
    setPage("dashboard");
    setPhone(null);
  };

  const clearAllAlerts = () => {
    alertsRef.current = [];
    logRef.current = [];
    setAlerts([]);
    setLog([]);
    if (phone) {
      saveAlerts(phone, []);
      saveLog(phone, []);
    }
  };

  // dashboard shows only today's alerts; the log page keeps everything
  const todaysAlerts = useMemo(
    () => alerts.filter((a) => isToday(a.ts) && (!hiddenBefore || a.ts > hiddenBefore)),
    [alerts, hiddenBefore]
  );

  // danger alerts + normal readings merged, newest first
  const logRows = useMemo(
    () =>
      [...alerts.map((a) => ({ ...a, status: a.status || "DANGER" })), ...log].sort((a, b) =>
        b.ts.localeCompare(a.ts)
      ),
    [alerts, log]
  );

  const goTo = (target, anchor) => (e) => {
    e.preventDefault();
    setPage(target);
    setTimeout(() => {
      if (anchor) document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" });
      else window.scrollTo({ top: 0, behavior: "smooth" });
    }, 60);
  };

  const start = () => {
    setSimulationMode("normal");
    setRunning(true);
  };

  const pause = () => setRunning(false);

  const reset = () => {
    const value = resetSensor();
    previousLevel.current = value;
    alertLocked.current = false;
    setSmsStatus("READY");
    processReading(value);
  };

  const leak = () => {
    setSimulationMode("leak");
    setRunning(true);
  };

  const recover = () => {
    setSimulationMode("recover");
    setRunning(true);
  };

  const slider = (value) => {
    setRunning(false);
    setSensorValue(value);
    processReading(value);
  };

  if (!phone) return <Login onLogin={login} />;

  return (
    <div className="app-shell">
      <header className="navbar">
        <a href="#dashboard" className="brand" onClick={goTo("dashboard", "dashboard")}>
          <span className="brand-mark">G</span>
          <span>GAS<span>GUARD</span></span>
        </a>

        <nav>
          <a href="#dashboard" onClick={goTo("dashboard", "dashboard")}>Dashboard</a>
          <a href="#circuit" onClick={goTo("dashboard", "circuit")}>3D Circuit</a>
          <a href="#architecture" onClick={goTo("dashboard", "architecture")}>Architecture</a>
          <a href="#alert-log" onClick={goTo("alerts")}>Reading Log</a>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="nav-live"><span /> SYSTEM ONLINE</div>
          <span style={{ color: "#7c8aa0", fontSize: 13 }}>{maskPhone(phone)}</span>
          <button
            onClick={logout}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid #22324a",
              background: "transparent",
              color: "#e8eef8",
              cursor: "pointer",
              fontSize: 13
            }}
          >
            Log out
          </button>
        </div>
      </header>

      <main className="container">
        {page === "alerts" ? (
          <AlertLog alerts={logRows} onClearAll={clearAllAlerts} />
        ) : (
          <>
            <Dashboard
              gasLevel={gasLevel}
              threshold={THRESHOLD}
              running={running}
              chartData={chartData}
              alerts={todaysAlerts}
              sensorStatus={running ? "ACTIVE" : "PAUSED"}
              smsStatus={smsStatus}
              numbers={numbers}
              recipientId={recipientId}
              onRecipientChange={changeRecipient}
              lastUpdated={lastUpdated}
              onStart={start}
              onPause={pause}
              onReset={reset}
              onLeak={leak}
              onRecover={recover}
              onSlider={slider}
              onClear={() => setHiddenBefore(new Date().toISOString())}
            />

            <Circuit3D gasLevel={gasLevel} threshold={THRESHOLD} />
            <Architecture />

            <section className="section about">
              <div className="panel">
                <span className="eyebrow">ABOUT PROJECT</span>
                <h2>Virtual Gas Leakage Detection & Real-Time Call Alert System</h2>
                <p>
                  This project demonstrates a real-time IoT gas monitoring concept
                  using a software-based virtual gas sensor. The simulated readings
                  are continuously monitored and an automatic phone call alert is made
                  when the danger threshold is crossed.
                </p>
                <p className="notice">
                  IMPORTANT: This is a simulation. It does not physically measure
                  gas concentration. A future hardware version can connect an
                  ESP32 and MQ-series gas sensor.
                </p>
              </div>
            </section>
          </>
        )}
      </main>

      <footer>
        <span>GASGUARD</span> · Virtual IoT Gas Monitoring System · Simulation Mode
      </footer>
    </div>
  );
}