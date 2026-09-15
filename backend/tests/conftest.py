import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp()
# Default: a throwaway SQLite file. Set LBTF_TEST_DATABASE_URL to run the same
# suite against a real (empty) Postgres, as CI does.
os.environ["LBTF_DATABASE_URL"] = os.environ.get("LBTF_TEST_DATABASE_URL") or f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["LBTF_UPLOAD_DIR"] = str(Path(_tmp) / "uploads")
os.environ["LBTF_USE_CLAUDE"] = "0"

import pytest
from fastapi.testclient import TestClient

from app.main import app

if os.environ.get("LBTF_TEST_DATABASE_URL"):
    # A shared Postgres keeps state between runs (unlike the temp SQLite file);
    # start each session from an empty schema so runs are repeatable.
    from app.db import Base, engine

    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/admin/login", json={"email": "randolph@lbtf.org", "password": "admin"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
