import { Link } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";

export default function ProjectPage() {
  return (
    <div className="page-shell">
      <AppHeader />
      <div className="page-body">
        <h1>The Project</h1>
        <p className="lede">Life Before the Freeway is a neighborhood oral-history platform built with West Oakland residents, EVOAK!, and OpenOakland volunteers.</p>
        <p>Between the 1950s and 1985, the construction of Interstate 980 cleared blocks of homes, churches, and businesses through the heart of West Oakland. The people who remember what stood there are in their 80s and 90s. This archive exists to record their memories — in their own voices, on their own terms — and to pin them back onto the map of the neighborhood.</p>
        <h2>How it works</h2>
        <ul>
          <li><b>Explore the map.</b> Every pin is a place someone remembered. Toggle between ~1950, 1965, and 1985 to see the neighborhood change.</li>
          <li><b>Ask the archive.</b> The chat answers only from the recorded interviews — never the open internet. Every answer cites the stories it drew from.</li>
          <li><b>Leave a story.</b> A ~30-second selfie video, guided by a prompt. A community moderator reviews every public submission before it appears.</li>
          <li><b>Multiple perspectives.</b> When residents remember a place differently, both accounts are shown side by side — never one canonical answer.</li>
        </ul>
        <h2>Who's behind it</h2>
        <p>EVOAK! leads the interviews and community moderation. OpenOakland — a Code for America brigade — builds and maintains the platform. The seed archive draws on 26 interviews recorded with neighborhood elders.</p>
        <p><Link to="/contribute" className="wbtn gold">Leave a Story</Link></p>
      </div>
    </div>
  );
}
