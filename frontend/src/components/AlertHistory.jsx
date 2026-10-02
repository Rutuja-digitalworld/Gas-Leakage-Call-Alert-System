export default function AlertHistory({ alerts }) {
  return (
    <div className="panel">
      <div className="panel-title">
        <div>
          <h3>Alert History</h3>
          <p>Automatic threshold-crossing events</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="empty">No alerts yet. Start a gas-leak simulation.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Gas Level</th>
                <th>Status</th>
                <th>Call</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td>{alert.time}</td>
                  <td>{alert.gasLevel}%</td>
                  <td><span className="table-danger">DANGER</span></td>
                  <td>{alert.smsStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}