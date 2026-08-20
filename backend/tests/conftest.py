import os
import tempfile
from pathlib import Path

_tmp = tempfile.mkdtemp()
os.environ["LBTF_DATABASE_URL"] = f"sqlite:///{Path(_tmp) / 'test.db'}"
os.environ["LBTF_UPLOAD_DIR"] = str(Path(_tmp) / "uploads")
os.environ["LBTF_USE_CLAUDE"] = "0"

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def admin(client):
    r = client.post("/api/admin/login", json={"email": "randolph@lbtf.org", "password": "admin"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}
