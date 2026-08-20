import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import type { AuditEntry, Queue, Staff, SubmissionCard } from "../../lib/types";
import { cx, fmtDate, fmtDateTime, fmtTime } from "../../lib/util";
import { useAdmin } from "./AdminLayout";

const TABS = [["pending", "Pending"], ["flagged", "Flagged"], ["approved", "Approved"], ["rejected", "Rejected"]] as const;

export function ActionPill({ action }: { action: string }) {
  const label: Record<string, string> = { approved: "Approved", rejected: "Rejected", published_field: "Published (field)", unpublished: "Unpublished" };
  return <span className={cx("act-pill", action)}>{label[action] ?? action}</span>;
}

export function AuditTable({ rows, staff }: { rows: AuditEntry[]; staff?: Staff[] }) {
  return (
    <div className="audit">
      <div className="audit-head">
        <h4>Recent moderation activity</h4>
        {staff && (
          <div className="staff">
            {staff.map((s) => <span key={s.id} className="staff-chip"><i style={{ background: s.color }} />{s.role === "intern" ? "Intern · " : ""}{s.name}</span>)}
          </div>
        )}
      </div>
      <div className="audit-wrap">
        <table className="audit-table">
          <thead><tr><th style={{ width: "34%" }}>Submission</th><th>Action</th><th>Reviewer</th><th>When</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={{ color: "#98a2aa", fontStyle: "italic" }}>No activity yet</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.submission_id ? <Link to={`/admin/submissions/${r.submission_id}`} style={{ color: "#16202b" }}>{r.submission_label}</Link> : r.submission_label}{r.detail && <div style={{ fontSize: 11, color: "#6b7680", marginTop: 2 }}>{r.detail}</div>}</td>
                <td><ActionPill action={r.action} /></td>
                <td>{r.reviewer_name}</td>
                <td><span className="ts">{fmtDateTime(r.at)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QCard({ s, onDecide, busy }: { s: SubmissionCard; onDecide: (id: number, d: "approve" | "reject") => void; busy: boolean }) {
  const nav = useNavigate();
  const open = () => nav(`/admin/submissions/${s.id}`);
  const flagged = s.flag_count > 0;
  return (
    <article className={cx("qcard", flagged && s.status === "pending" && "flagged")}>
      <div className="qthumb" onClick={open}>
        {s.video_url && <video src={`${s.video_url}#t=0.5`} muted preload="metadata" playsInline />}
        {flagged && <span className="flag-badge">Language flag</span>}
        <div className="qplay" />
        <span className="qdur">{fmtTime(s.duration_s)}</span>
      </div>
      <div className="qmeta" onClick={open}>
        <div className="qloc">{s.primary_label}</div>
        <div className="qsub"><span>{fmtDate(s.created_at)}</span><span>{s.source === "field" ? "Field capture" : "Public submission"}</span><span>{s.method}</span></div>
        {flagged && s.status === "pending" && <div className="qflagtext">Auto-transcript flagged {s.flag_count} term{s.flag_count > 1 ? "s" : ""} — review before publishing.</div>}
        {s.status !== "pending" && <div className="qsub"><span>{s.status} by {s.reviewer_name ?? "—"}{s.reviewed_at ? ` · ${fmtDate(s.reviewed_at)}` : ""}</span></div>}
      </div>
      <div className="qactions">
        {s.status === "pending" ? (
          <>
            <button type="button" className="qbtn approve" disabled={busy} onClick={() => onDecide(s.id, "approve")}>Approve</button>
            <button type="button" className="qbtn reject" disabled={busy} onClick={() => onDecide(s.id, "reject")}>Reject</button>
          </>
        ) : (
          <button type="button" className="qbtn review" onClick={open}>Open</button>
        )}
      </div>
    </article>
  );
}

export default function QueuePage() {
  const { refreshCounts } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("pending");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("oldest");
  const [data, setData] = useState<Queue | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    api.queue(tab, q, sort).then(setData).catch((e) => setErr(e.message));
    api.audit(6).then(setAudit).catch(() => {});
  }, [tab, q, sort]);
  useEffect(() => { load(); api.staff().then(setStaff).catch(() => {}); }, [load]);

  const decide = async (id: number, d: "approve" | "reject") => {
    if (d === "reject" && !confirm("Reject this submission? The contributor will not be notified automatically.")) return;
    setBusy(true);
    try {
      if (d === "approve") await api.approve(id);
      else await api.reject(id, "");
      toast(d === "approve" ? "Approved & published to the map" : "Rejected");
      load();
      refreshCounts();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally { setBusy(false); }
  };

  const counts = data?.counts ?? {};
  const title = tab === "pending" ? `${counts.pending ?? 0} submissions awaiting review` : tab === "flagged" ? `${counts.flagged ?? 0} flagged · review before publishing` : `${counts[tab] ?? 0} ${tab}`;

  return (
    <>
      <div className="adm-top">
        <h3>Moderation queue<span>{title}</span></h3>
        <div className="tools">
          <input className="adm-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search location or contributor…" aria-label="Search" />
          <select className="adm-filter" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
            <option value="oldest">Sort: Oldest first ▾</option>
            <option value="newest">Sort: Newest first ▾</option>
          </select>
        </div>
      </div>
      <div className="adm-scroll">
        <div className="adm-tabs" role="tablist">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx("adm-tab", tab === k && "active")} onClick={() => setTab(k)}>
              {label} <span className="c">{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
        {err && <div className="adm-err">{err}</div>}
        {!data ? <div className="empty-note"><span className="spinner" /></div> : data.items.length === 0 ? (
          <div className="empty-note">Nothing {tab === "pending" ? "waiting for review" : `in ${tab}`}{q ? ` matching “${q}”` : ""}.</div>
        ) : (
          <div className="queue">{data.items.map((s) => <QCard key={s.id} s={s} onDecide={decide} busy={busy} />)}</div>
        )}

        <div className="field-cap">
          <div className="fc-txt">
            <div className="fk">Staff-recorded · bypasses the queue</div>
            <h4>Field Interview Capture</h4>
            <p>Record or upload an interview you conducted in person. Because it's staff-vouched, it publishes straight to the map — same prompt bank and location tagging, no moderation step.</p>
          </div>
          <Link to="/admin/field-capture" className="fc-btn">＋ Start a field capture</Link>
        </div>

        <AuditTable rows={audit} staff={staff} />
      </div>
    </>
  );
}
