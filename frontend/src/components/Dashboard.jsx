import GasGauge from "./GasGauge";
import GasChart from "./GasChart";
import AlertHistory from "./AlertHistory";
import SimulationControls from "./SimulationControls";

export default function Dashboard(props) {
  const {
    gasLevel,
    threshold,
    running,
    chartData,
    alerts,
    sensorStatus,
    smsStatus,
    numbers,
    recipientId,
    onRecipientChange,
    lastUpdated,
    onStart,
    onPause,
    onReset,
    onLeak,
    onRecover,
    onSlider,
    onClear
  } = props;

  const status = gasLevel >= threshold ? "DANGER" : gasLevel >= 40 ? "WARNING" : "SAFE";

  return (
    <>
      <section id="dashboard" className="hero">
        <div>
          <span className="eyebrow">REAL-TIME IOT SIMULATION</span>
          <h1>Gas Leakage<br /><span>Monitoring System</span></h1>
          <p className="hero-text">
            A software-based virtual gas sensor continuously monitors simulated
            gas concentration and automatically triggers a phone call alert when the
            configured danger threshold is crossed.
          </p>
        </div>

        <div className="hero-status">
          <div className="mini-status">
            <span className="pulse" /> VIRTUAL SENSOR
          </div>
          <strong>{sensorStatus}</strong>
          <small>Last update: {lastUpdated}</small>
        </div>
      </section>

      <section className="stats-grid">
        <div className="stat-card">
          <span>Current Gas</span>
          <strong>{gasLevel.toFixed(1)}%</strong>
        </div>
        <div className="stat-card">
          <span>Status</span>
          <strong className={`text-${status.toLowerCase()}`}>{status}</strong>
        </div>
        <div className="stat-card">
          <span>Threshold</span>
          <strong>{threshold}%</strong>
        </div>
        <div className="stat-card">
          <span>Call Status</span>
          <strong>{smsStatus}</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <GasGauge value={gasLevel} threshold={threshold} />
        <GasChart data={chartData} />
      </section>

      <SimulationControls
        running={running}
        value={gasLevel}
        onStart={onStart}
        onPause={onPause}
        onReset={onReset}
        onLeak={onLeak}
        onRecover={onRecover}
        onSlider={onSlider}
        onClear={onClear}
        numbers={numbers}
        recipientId={recipientId}
        onRecipientChange={onRecipientChange}
      />

      <section id="alerts" className="section">
        <AlertHistory alerts={alerts} />
      </section>
    </>
  );
}