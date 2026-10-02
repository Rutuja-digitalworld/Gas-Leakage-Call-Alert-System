import { initializeApp, getApps } from "firebase/app";
import { getDatabase, ref, push, set } from "firebase/database";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const configured = Object.values(firebaseConfig).every(Boolean);

let database = null;

if (configured) {
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  database = getDatabase(app);
}

export function isFirebaseConfigured() {
  return Boolean(database);
}

export async function saveReading(reading) {
  if (!database) return;

  const readingRef = push(ref(database, "gasReadings"));
  await set(readingRef, reading);
}

export async function saveAlert(alert) {
  if (!database) return;

  const alertRef = push(ref(database, "alerts"));
  await set(alertRef, alert);
}