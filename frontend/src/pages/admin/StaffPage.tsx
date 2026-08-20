import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Staff } from "../../lib/types";
import { initials } from "../../lib/util";
import { useAdmin } from "./AdminLayout";

export default function StaffPage() {
  const { me } = useAdmin();
  const [rows, setRows] = useState<Staff[] | null>(null);
  useEffect(() => { api.staff().then(setRows).catch(() => setRows([])); }, []);
  return (
    <>
      <div className="adm-top"><h3>Staff &amp; access<span>individual logins — every action is attributed</span></h3></div>
      <div className="adm-scroll">
        <div className="audit">
          <div className="audit-wrap">
            <table className="audit-table">
              <thead><tr><th>Staff member</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
              <tbody>
                {rows?.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}><span style={{ display: "inline-flex", width: 24, height: 24, borderRadius: "50%", background: s.color, color: "#fff", alignItems: "center", justifyContent: "center", fontSize: 10, marginRight: 8 }}>{initials(s.name)}</span>{s.name}{s.id === me.id && " (you)"}</td>
                    <td>{s.email}</td>
                    <td><span className="act-pill neutral">{s.role}</span></td>
                    <td>{s.active ? "Active" : "Disabled"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="adm-card" style={{ marginTop: 18 }}>
          <h4>Adding staff</h4>
          <p>New reviewer accounts are provisioned by a super-admin (seeded via the backend for now — a self-serve invite flow is a V1.1 item). Interns get the “intern” role: they can review the queue; only super-admins can manage staff.</p>
        </div>
      </div>
    </>
  );
}
