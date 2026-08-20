import { useAdmin } from "./AdminLayout";

export default function SettingsPage() {
  const { me } = useAdmin();
  return (
    <>
      <div className="adm-top"><h3>Settings</h3></div>
      <div className="adm-scroll">
        <div className="adm-card">
          <h4>Your account</h4>
          <p>{me.name} · {me.email} · {me.role}</p>
        </div>
        <div className="adm-card">
          <h4>Weekly digest email</h4>
          <p>A summary of new submissions is emailed to staff weekly. Configure the schedule and recipients on the backend (V1: cron + SMTP env vars; see backend README).</p>
        </div>
        <div className="adm-card">
          <h4>Chat answer engine</h4>
          <p>The public “Ask the archive” chat answers only from the interview corpus. When an <code>ANTHROPIC_API_KEY</code> is configured on the server, answers are composed by Claude constrained to retrieved excerpts; otherwise they are quoted extractively. Either way every answer cites its source stories.</p>
        </div>
      </div>
    </>
  );
}
