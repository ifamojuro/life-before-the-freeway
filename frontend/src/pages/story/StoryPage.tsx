/**
 * Story pin — playback. One location, its clips as side-by-side
 * "perspectives", a share CTA, and an open reflections thread.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader";
import { useToast } from "../../components/Toast";
import { api } from "../../lib/api";
import type { LocationDetail, Story } from "../../lib/types";
import { fmtTime, initials, timeAgo } from "../../lib/util";

function PerspectiveCard({ s }: { s: Story }) {
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const hasSpan = s.start_s != null && s.end_s != null;

  const play = () => {
    const v = vid.current;
    if (!v) return;
    if (hasSpan && (v.currentTime < (s.start_s as number) || v.currentTime >= (s.end_s as number))) v.currentTime = s.start_s as number;
    void v.play();
  };
  // Stop at the end of the tagged span (clips that carry several places share one file)
  const onTime = () => {
    const v = vid.current;
    if (v && hasSpan && v.currentTime >= (s.end_s as number)) { v.pause(); v.currentTime = s.start_s as number; }
  };
  return (
    <article className="persp">
      <div className="persp-tag">
        <span className="av" style={{ background: s.avatar_color }}>{s.initials || initials(s.contributor_name)}</span>
        <span className="nm">{s.contributor_name}<span>{s.contributor_detail}</span></span>
      </div>
      <div className="persp-video" style={!s.video_url ? undefined : undefined}>
        {s.video_url ? (
          <>
            <video ref={vid} src={s.video_url} playsInline preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={onTime} onClick={() => (playing ? vid.current?.pause() : play())} />
            {!playing && <button type="button" className="play" onClick={play} aria-label={`Play ${s.contributor_name}'s story`} />}
            {hasSpan && <span className="span-note">{fmtTime(s.start_s)}–{fmtTime(s.end_s)}</span>}
          </>
        ) : (
          <div className="ph" style={{ position: "absolute", inset: 0 }}>
            <span className="ph-cap">selfie video · to be digitized</span>
          </div>
        )}
        <span className="dur">{fmtTime(s.duration_s)}</span>
      </div>
      <div className="persp-cap"><p><span className="qmark">“</span>{s.caption}”</p></div>
    </article>
  );
}

export default function StoryPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const [loc, setLoc] = useState<LocationDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [who, setWho] = useState(() => localStorage.getItem("lbtf.commentName") ?? "");
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    setLoc(null);
    api.location(id!).then(setLoc).catch((e) => setErr(e.message));
    window.scrollTo(0, 0);
  }, [id]);

  const close = () => nav(`/?pin=${id}`);

  const share = async (kind: string) => {
    const url = window.location.href;
    const title = loc ? `${loc.name} — Life Before the Freeway` : "Life Before the Freeway";
    if (kind === "link" || kind === "native") {
      if (kind === "native" && navigator.share) { try { await navigator.share({ title, url }); return; } catch { /* cancelled */ } }
      try { await navigator.clipboard.writeText(url); toast("Link copied"); } catch { toast(url); }
      return;
    }
    const enc = encodeURIComponent;
    const targets: Record<string, string> = {
      fb: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
      x: `https://twitter.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`,
      ig: "", // Instagram has no web share intent — copy link instead
    };
    if (targets[kind]) window.open(targets[kind], "_blank", "noopener,width=600,height=520");
    else { try { await navigator.clipboard.writeText(url); toast("Link copied — paste it into Instagram"); } catch { toast(url); } }
  };

  const post = async (e: FormEvent) => {
    e.preventDefault();
    if (!loc || !text.trim() || !who.trim()) return;
    setPosting(true);
    try {
      const c = await api.addComment(loc.id, who.trim(), text.trim());
      localStorage.setItem("lbtf.commentName", who.trim());
      setLoc({ ...loc, comments: [c, ...loc.comments] });
      setText("");
    } catch (er) {
      toast((er as Error).message, "err");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="story-page">
      <AppHeader />
      <div className="story-wrap">
        <div className="s2" role="dialog" aria-label={loc?.name ?? "Story"}>
          <div className="s2-topbar">
            <div className="s2-loc">
              <h3>{loc?.name ?? (err ? "Not found" : "Loading…")}</h3>
              {loc && <div className="cross">{loc.cross_street}<span className="era-tag">Story era: {loc.era_range}</span></div>}
            </div>
            <button type="button" className="s2-close" onClick={close} aria-label="Close and return to map">✕</button>
          </div>
          {err && <div className="s2-body"><div className="err-note">{err}</div></div>}
          {loc && (
            <div className="s2-body">
              {loc.stories.length > 1 ? (
                <div className="persp-lbl">
                  <span className="wlabel">Multiple perspectives</span>
                  <span className="rule" />
                  <small>{loc.stories.length === 2 ? "Two residents remember this block differently — both are shown." : `${loc.stories.length} residents remember this place — every account is shown.`}</small>
                </div>
              ) : (
                <div className="persp-lbl"><span className="wlabel">One account so far</span><span className="rule" /><small>Remember this place differently? Leave a story and it'll sit beside this one.</small></div>
              )}
              <div className="persp-grid">
                {loc.stories.map((s) => <PerspectiveCard key={s.id} s={s} />)}
              </div>

              <div className="s2-share">
                <div className="st"><b>Carry this story forward</b><span>Sharing helps us reach more elders before these memories are lost.</span></div>
                <div className="share-btns">
                  <button type="button" className="share-ic" onClick={() => share("ig")} aria-label="Share to Instagram (copies link)">IG</button>
                  <button type="button" className="share-ic" onClick={() => share("fb")} aria-label="Share to Facebook">FB</button>
                  <button type="button" className="share-ic" onClick={() => share("x")} aria-label="Share to X">✕</button>
                  <button type="button" className="share-ic" onClick={() => share(typeof navigator.share === "function" ? "native" : "link")} aria-label="Copy link">🔗</button>
                </div>
              </div>

              <section className="comments">
                <h4>Reflections · {loc.comments.length}</h4>
                {loc.comments.map((c) => (
                  <div className="comment" key={c.id}>
                    <div className="cav">{initials(c.author)}</div>
                    <div className="cbody">
                      <div className="cmeta"><b>{c.author}</b> · {timeAgo(c.created_at)}</div>
                      <div className="ctext">{c.text}</div>
                    </div>
                  </div>
                ))}
                <form className="comment-add" onSubmit={post}>
                  <input className="who" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Your name" aria-label="Your name" required />
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a reflection…" aria-label="Your reflection" required />
                  <button type="submit" className="wbtn primary" disabled={posting || !text.trim() || !who.trim()}>Post</button>
                </form>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
