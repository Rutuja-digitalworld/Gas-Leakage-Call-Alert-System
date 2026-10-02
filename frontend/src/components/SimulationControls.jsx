export default function SimulationControls({
  running,
  onStart,
  onPause,
  onReset,
  onLeak,
  onRecover,
  value,
  onSlider,
  onClear,
  numbers = [],
  recipientId = "0",
  onRecipientChange = () => {}
}) {
  return (
    <div className="panel">
      <div className="panel-title">
        <div>
          <h3>Simulation Controls</h3>
          <p>Software-based virtual sensor</p>
        </div>
        <span className="demo-badge">DEMO / SIMULATION</span>
      </div>

      <div className="control-row">
        <button className="btn primary" onClick={onStart} disabled={running}>▶ Start</button>
        <button className="btn" onClick={onPause} disabled={!running}>Ⅱ Pause</button>
        <button className="btn" onClick={onReset}>↻ Reset</button>
        <button className="btn danger-btn" onClick={onLeak}>🔥 Simulate Gas Leak</button>
        <button className="btn warning-btn" onClick={onRecover}>↓ Recover</button>
        <button className="btn" onClick={onClear}>Clear Alerts</button>
      </div>

      <div className="recipient-row">
        <label htmlFor="recipient">Call alert to:</label>
        <select
          id="recipient"
          className="recipient-select"
          value={recipientId}
          onChange={(e) => onRecipientChange(e.target.value)}
          disabled={numbers.length === 0}
        >
          {numbers.length === 0 && <option value="0">No numbers (backend offline?)</option>}
          {numbers.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label} ({n.masked})
            </option>
          ))}
          {numbers.length > 1 && <option value="all">All numbers</option>}
        </select>
      </div>

      <label className="slider-label">
        Test gas level: <strong>{value.toFixed(0)}%</strong>
      </label>
      <input
        className="range"
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onSlider(Number(e.target.value))}
      />
    </div>
  );
}