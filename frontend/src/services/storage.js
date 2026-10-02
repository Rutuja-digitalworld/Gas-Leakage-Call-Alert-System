// All data is stored per phone number, so logging out never deletes it.
const SESSION_KEY = "gasguard:session";
const alertsKey = (phone) => `gasguard:alerts:${phone}`;
const readingsKey = (phone) => `gasguard:readings:${phone}`;

export const MAX_ALERTS = 1000;
export const MAX_POINTS = 5000; // about 2 hours of readings at 1.5s each

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked */
  }
}

export function getSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSession(phone) {
  try {
    localStorage.setItem(SESSION_KEY, phone);
  } catch {
    /* ignore */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export const loadAlerts = (phone) => read(alertsKey(phone), []);

export const saveAlerts = (phone, alerts) =>
  write(alertsKey(phone), alerts.slice(0, MAX_ALERTS));

// Readings are stored as compact [timestampMs, gas] pairs
export const loadReadings = (phone) =>
  read(readingsKey(phone), []).map(([ts, gas]) => ({ ts, gas }));

export const saveReadings = (phone, readings) =>
  write(
    readingsKey(phone),
    readings.slice(-MAX_POINTS).map((r) => [r.ts, Math.round(r.gas * 10) / 10])
  );

export const isToday = (iso) =>
  !!iso && new Date(iso).toDateString() === new Date().toDateString();
export const MAX_LOG = 10000;
const LOG_KEY = (p) => `gasguard_log_${p}`;

export const loadLog = (p) => {
  try { return JSON.parse(localStorage.getItem(LOG_KEY(p))) || []; }
  catch { return []; }
};

export const saveLog = (p, rows) => {
  try { localStorage.setItem(LOG_KEY(p), JSON.stringify(rows)); } catch {}
};