"""The optional site-wide password gate (LBTF_SITE_PASSWORD)."""
import base64


def _auth(password: str, user: str = "tester") -> dict[str, str]:
    raw = base64.b64encode(f"{user}:{password}".encode()).decode()
    return {"Authorization": f"Basic {raw}"}


def test_open_when_unset(client, monkeypatch):
    monkeypatch.delenv("LBTF_SITE_PASSWORD", raising=False)
    assert client.get("/api/eras").status_code == 200


def test_blocks_without_credentials(client, monkeypatch):
    monkeypatch.setenv("LBTF_SITE_PASSWORD", "s3cret")
    r = client.get("/api/eras")
    assert r.status_code == 401
    assert r.headers.get("WWW-Authenticate", "").startswith("Basic")


def test_blocks_wrong_password(client, monkeypatch):
    monkeypatch.setenv("LBTF_SITE_PASSWORD", "s3cret")
    assert client.get("/api/eras", headers=_auth("wrong")).status_code == 401


def test_allows_correct_password(client, monkeypatch):
    monkeypatch.setenv("LBTF_SITE_PASSWORD", "s3cret")
    assert client.get("/api/eras", headers=_auth("s3cret")).status_code == 200


def test_health_stays_open_when_gated(client, monkeypatch):
    monkeypatch.setenv("LBTF_SITE_PASSWORD", "s3cret")
    assert client.get("/api/health").status_code == 200
