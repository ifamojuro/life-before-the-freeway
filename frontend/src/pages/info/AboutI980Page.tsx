import { AppHeader } from "../../components/AppHeader";
import { ERAS } from "../../lib/types";

export default function AboutI980Page() {
  return (
    <div className="page-shell">
      <AppHeader />
      <div className="page-body">
        <h1>About I-980</h1>
        <p className="lede">A short history of the corridor this archive is built around.</p>
        <p>Planned in the era of urban renewal and completed in 1985, Interstate 980 cut a trench between West Oakland and downtown. The route required the taking of hundreds of properties — homes, storefronts on and around 7th Street, and several of the churches that anchored the neighborhood's civic life. Residents remember the takings beginning in the mid-1960s: letters, offers, deadlines, and then the demolition crews. One resident called the cleared right-of-way “a giant scar.”</p>
        <h2>The three eras on the map</h2>
        <ul>
          {ERAS.map((e) => <li key={e.key}><b>{e.year} — {e.label}.</b> {e.detail}</li>)}
        </ul>
        <p>7th Street before the freeway was one of the West Coast's great Black commercial strips — banks, record stores, and clubs where touring musicians played. Much of what this archive records lived on those blocks.</p>
        <h2>Why it matters now</h2>
        <p>Conversations about removing or capping I-980 continue today. Whatever the corridor's future, the memory of what stood there belongs to the people who lived it — and that memory is the point of this project.</p>
      </div>
    </div>
  );
}
