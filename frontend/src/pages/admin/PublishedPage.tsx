import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import type { PublishedStory } from "../../lib/types";
import { fmtDate, fmtTime } from "../../lib/util";

export default function PublishedPage() {
  const toast = useToast();
  const [rows, setRows] = useState<PublishedStory[] | null>(null);
  const load = () => api.published().then(setRows).catch((e) => toast(e.message, "err"));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const unpublish = async (s: PublishedStory) => {
    if (!confirm(`Unpublish “${s.location_name} — ${s.contributor_name}”? This removes it from the public map (logged).`)) return;
    try { await api.unpublish(s.id); toast("Unpublished"); load(); } catch (e) { toast((e as Error).message, "err"); }
  };

  return (
    <>
      <div className="adm-top"><h3>Published stories<span>{rows ? `${rows.length} live on the map` : "…"}</span></h3></div>
      <div className="adm-scroll">
        <div className="audit">
          <div className="audit-wrap">
            <table className="audit-table stories-table">
              <thead><tr><th>Location</th><th>Contributor</th><th>Era</th><th>Source</th><th>Length</th><th>Published</th><th /></tr></thead>
              <tbody>
                {rows?.map((s) => (
                  <tr key={s.id}>
                    <td><Link to={`/story/${s.location_id}`} target="_blank" style={{ color: "#16202b", fontWeight: 600 }}>{s.location_name}</Link><div style={{ fontSize: 10.5, color: "#6b7680" }}>{s.cross_street}</div></td>
                    <td>{s.contributor_name}</td>
                    <td>{s.era_label}</td>
                    <td><span className="src">{s.source}</span></td>
                    <td><span className="ts">{fmtTime(s.duration_s)}</span></td>
                    <td><span className="ts">{fmtDate(s.published_at)}</span></td>
                    <td><button type="button" className="adm-btn" onClick={() => void unpublish(s)}>Unpublish</button></td>
                  </tr>
                ))}
                {rows && rows.length === 0 && <tr><td colSpan={7} style={{ fontStyle: "italic", color: "#98a2aa" }}>Nothing published yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
