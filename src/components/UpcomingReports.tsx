import { nextReport } from "../calendar";
import { timeIST } from "../format";

export function UpcomingReports() {
  const reports = [
    { label: "EIA Natural Gas Storage", report: nextReport("gas") },
    { label: "EIA Crude Oil Inventories", report: nextReport("crude") },
  ];
  return (
    <section className="panel next-panel">
      <div className="panel-head">
        <div>
          <div className="eyebrow">U.S. RELEASE CALENDAR</div>
          <h2>
            Upcoming reports <small>(IST)</small>
          </h2>
        </div>
      </div>
      <div className="next-grid">
        {reports.map(({ label, report }) => (
          <div key={label} className="next-report">
            <span className="next-time">
              {report ? timeIST(report.when) : "Schedule unavailable"}
            </span>
            <div>
              <b>{label}</b>
              <small>U.S. Energy Information Administration</small>
            </div>
            {report?.source && (
              <a href={report.source} target="_blank" rel="noreferrer">
                Verify schedule ↗
              </a>
            )}
          </div>
        ))}
      </div>
      <p className="fineprint">
        Times are converted from U.S. Eastern time. Check the official schedule
        for holiday changes.
      </p>
    </section>
  );
}
