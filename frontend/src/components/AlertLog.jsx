import { useMemo, useState } from "react";
import { isToday } from "../services/storage";

const C = {
  card: "#0e1520",
  border: "#1a2536",
  text: "#e8eef8",
  muted: "#7c8aa0",
  teal: "#25dbb0",
  red: "#ff4d5e",
  amber: "#ffb020"
};

const STATUS_COLOR = {
  SAFE: C.teal,
  WARNING: C.amber,
  DANGER: C.red
};

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const th = {
  textAlign: "left",
  padding: "12px 16px",
  color: C.muted,
  fontWeight: 600,
  fontSize: 13,
  borderBottom: `1px solid ${C.border}`
};

const td = { padding: "12px 16px", borderBottom: `1px solid ${C.border}`, fontSize: 14 };

const pill = (active) => ({
  padding: "8px 14px",
  borderRadius: 8,
  border: `1px solid ${active ? C.teal : C.border}`,
  background: active ? "rgba(37,219,176,0.12)" : "transparent",
  color: active ? C.teal : C.text,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600
});

export default function AlertLog({ alerts, onClearAll }) {
  const [range, setRange] = useState("today");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    const now = Date.now();
    return alerts.filter((a) => {
      const status = a.status || "DANGER";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (range === "today") return isToday(a.ts);
      if (range === "week") return now - new Date(a.ts).getTime() <= 7 * 86400000;
      return true;
    });
  }, [alerts, range, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map();
    filtered.forEach((a) => {
      const key = fmtDate(a.ts);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    });
    return [...map.entries()];
  }, [filtered]);

  const dangerCount = filtered.filter((a) => (a.status || "DANGER") === "DANGER").length;
  const peak = filtered.reduce((m, a) => Math.max(m, parseFloat(a.gasLevel)), 0);

  const exportCsv = () => {
    const rows = [
      ["Date", "Time", "Gas Level (%)", "Status", "Call"],
      ...filtered.map((a) => [
        fmtDate(a.ts),
        a.time,
        a.gasLevel,
        a.status || "DANGER",
        a.smsStatus
      ])
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `gasguard-log-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearAll = () => {
    if (window.confirm("Delete the entire log for this number? This cannot be undone.")) {
      onClearAll();
    }
  };

  const stat = (label, value) => (
    <div
      style={{
        flex: "1 1 160px",
        background: C.card,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: "16px 18px"
      }}
    >
      <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
      <div style={{ color: C.text, fontSize: 26, fontWeight: 700, marginTop: 6 }}>{value}</div>
    </div>
  );

  return (
    <section id="alert-log" className="section" style={{ color: C.text }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Reading Log</h2>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 14 }}>
            Danger alerts and periodic normal readings are saved to your number, including past days.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={pill(range === "today")} onClick={() => setRange("today")}>Today</button>
          <button style={pill(range === "week")} onClick={() => setRange("week")}>Last 7 days</button>
          <button style={pill(range === "all")} onClick={() => setRange("all")}>All</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        <button style={pill(statusFilter === "all")} onClick={() => setStatusFilter("all")}>All status</button>
        <button style={pill(statusFilter === "SAFE")} onClick={() => setStatusFilter("SAFE")}>Safe</button>
        <button style={pill(statusFilter === "WARNING")} onClick={() => setStatusFilter("WARNING")}>Warning</button>
        <button style={pill(statusFilter === "DANGER")} onClick={() => setStatusFilter("DANGER")}>Danger</button>
      </div>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "20px 0" }}>
        {stat("Alerts in view", dangerCount)}
        {stat("Readings in view", filtered.length)}
        {stat("Peak gas level", filtered.length ? `${peak.toFixed(1)}%` : "-")}
        {stat("Total stored", alerts.length)}
      </div>

      <div
        style={{
          background: C.card,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          overflowX: "auto"
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
          <thead>
            <tr>
              <th style={th}>Time</th>
              <th style={th}>Gas Level</th>
              <th style={th}>Status</th>
              <th style={th}>Call</th>
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...td, color: C.muted, textAlign: "center", padding: 32 }}>
                  No readings in this range. Normal readings are logged once a minute; danger alerts are logged when gas crosses the threshold.
                </td>
              </tr>
            )}
            {groups.map(([date, items]) => (
              <FragmentGroup key={date} date={date} items={items} />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button style={pill(false)} onClick={exportCsv} disabled={!filtered.length}>
          Download CSV
        </button>
        <button
          style={{ ...pill(false), color: C.red, borderColor: "#4a2029" }}
          onClick={clearAll}
          disabled={!alerts.length}
        >
          Clear entire log
        </button>
      </div>
    </section>
  );
}

function FragmentGroup({ date, items }) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          style={{ ...td, background: "#0a111b", color: C.muted, fontWeight: 600, fontSize: 13 }}
        >
          {date}
        </td>
      </tr>
      {items.map((a) => {
        const status = a.status || "DANGER";
        return (
          <tr key={a.id}>
            <td style={td}>{a.time}</td>
            <td style={td}>{a.gasLevel}%</td>
            <td style={{ ...td, color: STATUS_COLOR[status] || C.text, fontWeight: 600 }}>{status}</td>
            <td style={{ ...td, color: a.smsStatus === "FAILED" ? C.red : C.text }}>{a.smsStatus}</td>
          </tr>
        );
      })}
    </>
  );
}