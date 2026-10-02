export default function GasGauge({ value, threshold }) {
  const status = value >= threshold ? "DANGER" : value >= 40 ? "WARNING" : "SAFE";
  const rotation = -135 + (Math.min(value, 100) / 100) * 270;

  return (
    <div className="gauge-card">
      <div className="gauge">
        <div className="gauge-track" />
        <div
          className="gauge-progress"
          style={{ transform: `rotate(${rotation}deg)` }}
        />
        <div className="gauge-center">
          <strong>{value.toFixed(1)}%</strong>
          <span>GAS LEVEL</span>
        </div>
      </div>
      <div className={`status-pill ${status.toLowerCase()}`}>
        {status === "DANGER" ? "● GAS LEAKAGE DETECTED" : `● ${status}`}
      </div>
      <p className="muted">Danger threshold: {threshold}%</p>
    </div>
  );
}