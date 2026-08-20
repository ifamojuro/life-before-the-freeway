"""RAG-scoped chat: answers come *only* from the recorded interviews.

1. Retrieve: score every published story's transcript + caption against the
   question (BM25-lite over tokens) and keep the top passages.
2. Compose: if an Anthropic credential is available, ask Claude to answer using
   only those passages (and to say so when they don't cover the question).
   Otherwise build an extractive answer from the passages themselves.
3. Cite: every answer carries the stories it drew from, so the UI can render
   "Drawn from these stories" pins that deep-link to the map.
"""
from __future__ import annotations

import math
import os
import re
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import CLAUDE_MODEL, USE_CLAUDE
from ..models import Location, Story

STOP = set(
    "the a an and or of to in on at was were is are be been what where who when how tell me about "
    "there here it its this that those these did do does with for from by as i you we they my our "
    "your their had have has not no yes any some all which".split()
)


def tokens(text: str) -> list[str]:
    return [t for t in re.findall(r"[a-z0-9']+", text.lower()) if t not in STOP and len(t) > 1]


@dataclass
class Passage:
    story: Story
    location: Location
    score: float
    excerpt: str


def retrieve(db: Session, question: str, k: int = 4) -> list[Passage]:
    rows = db.execute(select(Story, Location).join(Location, Story.location_id == Location.id)).all()
    docs: list[tuple[Story, Location, list[str], str]] = []
    for story, loc in rows:
        body = " ".join([story.transcript or "", story.caption or "", loc.name, loc.cross_street])
        docs.append((story, loc, tokens(body), body))
    if not docs:
        return []
    q = tokens(question)
    if not q:
        return []
    n = len(docs)
    df = Counter()
    for _, _, toks, _ in docs:
        for t in set(toks):
            df[t] += 1
    avgdl = sum(len(t) for _, _, t, _ in docs) / n
    k1, b = 1.5, 0.75
    out: list[Passage] = []
    for story, loc, toks, body in docs:
        tf = Counter(toks)
        score = 0.0
        for t in q:
            if t not in tf:
                # soft match on prefixes ("bank" ~ "banks")
                matches = [w for w in tf if w.startswith(t) or t.startswith(w)]
                if not matches:
                    continue
                f = sum(tf[w] for w in matches)
                d = max(df[w] for w in matches)
            else:
                f, d = tf[t], df[t]
            idf = math.log(1 + (n - d + 0.5) / (d + 0.5))
            score += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * len(toks) / avgdl))
        if score > 0:
            out.append(Passage(story, loc, score, _excerpt(body, q)))
    out.sort(key=lambda p: p.score, reverse=True)
    return out[:k]


def _excerpt(body: str, q: list[str], width: int = 220) -> str:
    low = body.lower()
    idx = min((low.find(t) for t in q if low.find(t) >= 0), default=0)
    start = max(0, idx - width // 3)
    snippet = body[start: start + width].strip()
    if start > 0:
        snippet = "…" + snippet
    if start + width < len(body):
        snippet += "…"
    return snippet


def _claude_enabled() -> bool:
    if USE_CLAUDE == "0":
        return False
    if USE_CLAUDE == "1":
        return True
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


SYSTEM = (
    "You are the archive guide for 'Life Before the Freeway', an oral-history project about West Oakland "
    "before, during, and after the I-980 freeway. Answer the visitor's question using ONLY the interview "
    "excerpts provided. Speak plainly and warmly, in two to four sentences. Attribute memories to the "
    "residents who shared them (e.g. 'Ms. Carter remembers…'). If the excerpts do not answer the question, "
    "say that the recorded interviews don't cover it yet and invite the visitor to leave a story. Never "
    "add outside facts."
)


def _compose_with_claude(question: str, history: list[dict], passages: list[Passage]) -> str | None:
    try:
        import anthropic
    except ImportError:  # pragma: no cover
        return None
    context = "\n\n".join(
        f"[{i + 1}] {p.location.name} ({p.location.cross_street}) — {p.story.contributor_name}, "
        f"{p.story.era_label or p.story.era}:\n{p.story.transcript or p.story.caption}"
        for i, p in enumerate(passages)
    )
    messages = [{"role": h["role"], "content": h["content"]} for h in history[-6:]]
    messages.append({
        "role": "user",
        "content": f"Interview excerpts:\n\n{context}\n\nVisitor question: {question}",
    })
    try:
        client = anthropic.Anthropic()
        # Server-side refusal fallback (Claude API only): if the primary model
        # declines, the same request is re-run on Anthropic's default fallback.
        resp = client.beta.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1024,
            system=SYSTEM,
            messages=messages,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if resp.stop_reason == "refusal":
            return None
        return "".join(b.text for b in resp.content if b.type == "text").strip() or None
    except Exception:
        return None


def _compose_extractive(question: str, passages: list[Passage]) -> str:
    if not passages:
        return (
            "The recorded interviews don't cover that yet. Try asking about a street, a business, "
            "or a memory — or leave a story of your own so the next person can find it."
        )
    lead = passages[0]
    parts = [f"{lead.story.contributor_name} remembers {lead.location.name} this way: “{_trim(lead.story.caption or lead.excerpt)}”"]
    for p in passages[1:3]:
        parts.append(f"{p.story.contributor_name} adds: “{_trim(p.story.caption or p.excerpt)}”")
    return " ".join(parts)


def _trim(s: str, n: int = 180) -> str:
    s = s.strip().strip("“”\"")
    return s if len(s) <= n else s[: n - 1].rstrip() + "…"


def answer(db: Session, question: str, history: list[dict]) -> tuple[str, list[Passage], str]:
    passages = retrieve(db, question)
    if passages and _claude_enabled():
        text = _compose_with_claude(question, history, passages)
        if text:
            return text, passages, "claude"
    return _compose_extractive(question, passages), passages, "extractive"
