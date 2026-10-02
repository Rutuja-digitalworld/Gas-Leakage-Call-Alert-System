const blocks = [
  ["01", "Virtual Gas Sensor", "Software generates continuous gas concentration readings."],
  ["02", "Real-Time Reading", "The dashboard receives a new value every 1.5 seconds."],
  ["03", "Threshold Detection", "The system compares the reading with the danger threshold."],
  ["04", "Backend Server", "The alert request is securely sent to the backend."],
  ["05", "SMS API", "Twilio sends the alert to the registered mobile number."],
  ["06", "Mobile Alert", "The registered user receives the gas leakage warning."]
];

export default function Architecture() {
  return (
    <section id="architecture" className="section">
      <div className="section-heading">
        <span className="eyebrow">SYSTEM DESIGN</span>
        <h2>How the System Works</h2>
      </div>

      <div className="architecture">
        {blocks.map(([number, title, text], index) => (
          <div className="arch-item" key={number}>
            <div className="arch-number">{number}</div>
            <div>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
            {index < blocks.length - 1 && <div className="arrow">↓</div>}
          </div>
        ))}
      </div>
    </section>
  );
}