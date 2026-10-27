/**
 * "Ask the archive" — RAG-scoped chat. Shared by the desktop pane and the
 * mobile sheet; the `compact` flag switches to the sheet's smaller styles.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { ChatAnswer, ChatMessage, Citation } from "../lib/types";

export const SUGGESTIONS = [
  "What was on 7th Street?",
  "Tell me about the churches that were here",
  "Where were the three banks?",
];

// Kept in sessionStorage so the conversation survives opening a cited story
// (which unmounts the home page) and coming back to ask a follow-up.
const CHAT_KEY = "lbtf.chat";

function loadChat(): { messages: ChatMessage[]; mode: ChatAnswer["mode"] | null } {
  try {
    const s = JSON.parse(sessionStorage.getItem(CHAT_KEY) ?? "null");
    if (s && Array.isArray(s.messages)) return { messages: s.messages, mode: s.mode ?? null };
  } catch { /* storage blocked or data damaged: start empty */ }
  return { messages: [], mode: null };
}

export function useArchiveChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadChat().messages);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<ChatAnswer["mode"] | null>(() => loadChat().mode);

  useEffect(() => {
    // A question still loading can't be answered once the page is left, so don't save it.
    const done = messages[messages.length - 1]?.pending ? messages.slice(0, -2) : messages;
    try { sessionStorage.setItem(CHAT_KEY, JSON.stringify({ messages: done, mode })); } catch { /* ignore */ }
  }, [messages, mode]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history = messages;
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "", pending: true }]);
    setBusy(true);
    try {
      const res = await api.chat(question, history);
      setMode(res.mode);
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: res.answer, citations: res.citations }]);
    } catch (e) {
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: `Sorry — the archive didn't answer (${(e as Error).message}). Try again in a moment.` }]);
    } finally {
      setBusy(false);
    }
  };
  return { messages, busy, mode, ask };
}

export function CitationList({ citations, compact }: { citations: Citation[]; compact?: boolean }) {
  const nav = useNavigate();
  if (!citations.length) return null;
  if (compact) {
    return (
      <>
        {citations.map((c) => (
          <button key={c.story_id} type="button" className="m1-cite" onClick={() => nav(`/story/${c.location_id}?from=chat`)}>
            <span className="cp" />
            <span className="ct">{c.location_name}<span>{c.cross_street} · {c.contributor_name}</span></span>
          </button>
        ))}
      </>
    );
  }
  return (
    <div className="cite">
      <div className="cite-lbl">Drawn from these stories</div>
      {citations.map((c) => (
        <button key={c.story_id} type="button" className="cite-pin" onClick={() => nav(`/story/${c.location_id}?from=chat`)}>
          <span className="pn" />
          <span className="ct"><b>{c.location_name}</b><span>{c.cross_street} · {c.contributor_name}, {c.era_label}</span></span>
        </button>
      ))}
    </div>
  );
}

export function ChatPanel({ chat }: { chat: ReturnType<typeof useArchiveChat> }) {
  const { messages, busy, mode, ask } = chat;
  const [input, setInput] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void ask(input);
    setInput("");
  };

  return (
    <section className="s1-chat" aria-label="Ask the archive">
      <div className="chat-head">
        <div>
          <h3>Ask the archive</h3>
          <p>Answers come only from the elders we interviewed.</p>
        </div>
        {mode && <span className="chat-mode" title="How answers are composed">{mode !== "extractive" ? "AI-composed · interviews only" : "Quoted from interviews"}</span>}
      </div>
      <div className="chat-scroll" ref={scroller}>
        {messages.length === 0 && (
          <>
            <div className="chat-empty">Ask about a street,<br />a business, a memory…</div>
            <div className="chip-row">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void ask(s)}>{s}</button>
              ))}
            </div>
          </>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="msg user">{m.content}</div>
          ) : (
            <div key={i} className="msg bot">
              <div className="bot-role">◆ From the interviews</div>
              <div className="bot-body">
                {m.pending ? (
                  <div className="thinking" aria-label="Searching the interviews"><i /><i /><i /></div>
                ) : (
                  <>
                    {m.content.split(/\n+/).map((p, j) => <p key={j}>{p}</p>)}
                    {m.citations && <CitationList citations={m.citations} />}
                  </>
                )}
              </div>
            </div>
          ),
        )}
      </div>
      <form className="chat-input" onSubmit={submit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={messages.length ? "Ask a follow-up…" : "Ask about a place or a memory…"} aria-label="Your question" />
        <button type="submit" className="chat-send" disabled={busy || !input.trim()} aria-label="Send">↑</button>
      </form>
    </section>
  );
}
