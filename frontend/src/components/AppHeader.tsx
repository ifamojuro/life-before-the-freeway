import { Link, NavLink } from "react-router-dom";

export function AppHeader({ variant = "site", subtitle }: { variant?: "site" | "intake"; subtitle?: string }) {
  if (variant === "intake") {
    return (
      <header className="app-header">
        <Link to="/" className="app-brand">
          <span className="app-mark" />
          <span className="app-wordmark">
            Leave a Story<small>{subtitle ?? "Contributor intake"}</small>
          </span>
        </Link>
        <nav className="app-nav">
          <Link to="/">Save &amp; exit</Link>
        </nav>
      </header>
    );
  }
  return (
    <header className="app-header">
      <Link to="/" className="app-brand">
        <span className="app-mark" />
        <span className="app-wordmark">
          Life Before the Freeway<small>West Oakland Oral History</small>
        </span>
      </Link>
      <nav className="app-nav">
        <NavLink to="/" end>Explore</NavLink>
        <NavLink to="/project">The Project</NavLink>
        <NavLink to="/about-980">About I-980</NavLink>
        <Link to="/contribute" className="app-cta">Leave a Story</Link>
      </nav>
    </header>
  );
}
