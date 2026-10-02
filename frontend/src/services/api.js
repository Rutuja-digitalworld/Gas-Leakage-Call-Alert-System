const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function getAlertNumbers() {
  const response = await fetch(`${API_BASE}/api/numbers`);
  if (!response.ok) throw new Error("Could not load numbers");
  const data = await response.json();
  return data.numbers || [];
}

export async function sendGasAlert({ gasLevel, timestamp, recipientId }) {
  const response = await fetch(`${API_BASE}/api/alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gasLevel, timestamp, recipientId })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Call request failed");
  }

  return data;
}