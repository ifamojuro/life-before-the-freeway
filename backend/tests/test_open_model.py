"""Open-weight chat model (LBTF_LLM_BASE_URL): answers via an OpenAI-compatible
server, falling back to the extractive answer whenever that server fails."""
import httpx
import pytest

from app import config
from app.services import rag

QUESTION = {"question": "What was on 7th Street?"}


@pytest.fixture
def open_model(monkeypatch):
    monkeypatch.setattr(config, "LLM_BASE_URL", "http://model.test/v1")
    monkeypatch.setattr(config, "LLM_MODEL", "qwen3.5:9b")
    monkeypatch.setattr(config, "LLM_HEADERS", {"Modal-Key": "k", "Modal-Secret": "s"})
    calls = []

    def respond_with(handler):
        def fake_post(url, **kwargs):
            calls.append((url, kwargs))
            return handler(httpx.Request("POST", url))

        monkeypatch.setattr(rag.httpx, "post", fake_post)

    return respond_with, calls


def test_answer_comes_from_the_open_model(client, open_model):
    respond_with, calls = open_model
    respond_with(lambda req: httpx.Response(
        200, request=req, json={"choices": [{"message": {"content": "Ms. Carter remembers the bank."}}]},
    ))
    r = client.post("/api/chat", json=QUESTION).json()
    assert r["mode"] == "llm"
    assert r["answer"] == "Ms. Carter remembers the bank."
    assert r["citations"]

    url, kwargs = calls[0]
    assert url == "http://model.test/v1/chat/completions"
    assert kwargs["headers"] == {"Modal-Key": "k", "Modal-Secret": "s"}
    body = kwargs["json"]
    assert body["model"] == "qwen3.5:9b"
    assert body["messages"][0] == {"role": "system", "content": rag.SYSTEM}
    assert "Interview excerpts" in body["messages"][-1]["content"]


@pytest.mark.parametrize("failure", [
    lambda req: (_ for _ in ()).throw(httpx.ReadTimeout("slow", request=req)),
    lambda req: httpx.Response(503, request=req),
    lambda req: httpx.Response(200, request=req, json={"choices": [{"message": {"content": ""}}]}),
    lambda req: httpx.Response(200, request=req, json={"error": "no such model"}),
    lambda req: httpx.Response(200, request=req, json={"choices": None}),
    lambda req: httpx.Response(200, request=req, json={"choices": [{"message": None}]}),
])
def test_model_failure_falls_back_to_extractive(client, open_model, failure):
    respond_with, _ = open_model
    respond_with(failure)
    r = client.post("/api/chat", json=QUESTION).json()
    assert r["mode"] == "extractive"
    assert r["citations"]


def test_model_is_not_called_without_passages(client, open_model):
    respond_with, calls = open_model
    respond_with(lambda req: pytest.fail("the model should not be called"))
    r = client.post("/api/chat", json={"question": "zebra quantum spreadsheet"}).json()
    assert r["mode"] == "extractive"
    assert "don't cover" in r["answer"]
    assert calls == []


def test_validate_requires_a_model_name(monkeypatch):
    monkeypatch.setattr(config, "LLM_BASE_URL", "http://model.test/v1")
    monkeypatch.setattr(config, "LLM_MODEL", "")
    assert any("LBTF_LLM_MODEL" in p for p in config.validate())


def test_warm_is_a_no_op_without_a_model(client):
    assert client.post("/api/chat/warm").json() == {"warming": False}


def test_warm_loads_the_model_at_most_once_a_minute(client, open_model, monkeypatch):
    respond_with, calls = open_model
    respond_with(lambda req: httpx.Response(200, request=req, json={}))
    monkeypatch.setattr(rag, "_last_warm", 0.0)
    monkeypatch.setattr(rag.time, "monotonic", lambda: 1000.0)

    r = client.post("/api/chat/warm")
    assert r.status_code == 202 and r.json() == {"warming": True}
    assert calls[0][1]["json"]["max_tokens"] == 1

    assert client.post("/api/chat/warm").json() == {"warming": False}
    assert len(calls) == 1
