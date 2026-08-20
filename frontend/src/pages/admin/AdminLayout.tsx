import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, getToken, setToken } from "../../lib/api";
import type { Staff } from "../../lib/types";
import { initials } from "../../lib/util";

interface AdminCtx {
  me: Staff;
  pendingCount: number;
  refreshCounts: () => void;
}
const Ctx = createContext<AdminCtx | null>(null);
export const useAdmin = () => useContext(Ctx)!;

export function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("randolph@lbtf.org");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (getToken()) return <Navigate to="/admin" replace />;
  const go = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await api.login(email, pw);
      setToken(r.token);
      nav("/admin", { replace: true });
    } catch (er) {
      setErr((er as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={go}>
        <div className="n">LBTF Admin</div>
        <span className="tag">Staff only</span>
        {err && <div className="adm-err">{err}</div>}
        <div className="adm-field"><label>Email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></div>
        <div className="adm-field"><label>Password</label><input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" autoFocus /></div>
        <button type="submit" className="adm-btn primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        <div className="hint">Seeded accounts: randolph@lbtf.org (super-admin), maya@lbtf.org, jordan@lbtf.org — password <code>admin</code>. Every approve/reject is logged under your name.</div>
      </form>
    </div>
  );
}

export function AdminLayout({ children }: { children?: ReactNode }) {
  const nav = useNavigate();
  const loc = useLocation();
  const [me, setMe] = useState<Staff | null>(null);
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const refreshCounts = () => { api.queue("pending").then((q) => setPending(q.counts.pending)).catch(() => {}); };

  useEffect(() => {
    if (!getToken()) { nav("/admin/login", { replace: true }); return; }
    api.me().then(setMe).catch((e) => {
      if (e.status === 401) { setToken(null); nav("/admin/login", { replace: true }); } else setErr(e.message);
    });
    refreshCounts();
  }, [nav, loc.pathname]);

  const logout = async () => { try { await api.logout(); } catch { /* ignore */ } setToken(null); nav("/admin/login", { replace: true }); };

  if (err) return <div className="adm-login"><div className="adm-login-card"><div className="adm-err">{err}</div></div></div>;
  if (!me) return <div className="adm-login"><span className="spinner" /></div>;

  return (
    <Ctx.Provider value={{ me, pendingCount: pending, refreshCounts }}>
      <div className="admin">
        <aside className="adm-side">
          <div className="adm-brand"><div className="n">LBTF Admin</div><span className="tag">Staff only</span></div>
          <nav className="adm-nav">
            <NavLink to="/admin" end>Moderation queue {pending > 0 && <span className="badge">{pending}</span>}</NavLink>
            <NavLink to="/admin/published">Published stories</NavLink>
            <NavLink to="/admin/field-capture">Field capture</NavLink>
            <div className="sect">Team</div>
            <NavLink to="/admin/staff">Staff &amp; access</NavLink>
            <NavLink to="/admin/audit">Audit log</NavLink>
            <NavLink to="/admin/settings">Settings</NavLink>
          </nav>
          <div className="adm-user">
            <span className="ua" style={{ background: me.color }}>{initials(me.name)}</span>
            <span className="ui">{me.name}<span>{me.role}</span></span>
            <button type="button" className="out" onClick={() => void logout()}>Sign out</button>
          </div>
        </aside>
        <div className="adm-main">{children ?? <Outlet />}</div>
      </div>
    </Ctx.Provider>
  );
}
