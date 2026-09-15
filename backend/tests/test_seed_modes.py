"""LBTF_SEED modes and startup validation (config.validate)."""
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app import config
from app.db import Base
from app.models import Location, Prompt, Staff
from app.seed import seed


def _fresh_db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'seed.db'}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    return Session(engine)


def test_base_seed_is_prompts_and_admin_only(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SEED", "base")
    monkeypatch.setattr(config, "ADMIN_EMAIL", "ops@example.org")
    monkeypatch.setattr(config, "ADMIN_PASSWORD", "hunter2")
    with _fresh_db(tmp_path) as db:
        seed(db)
        assert db.scalar(select(Prompt.id).limit(1)) is not None
        assert db.execute(select(Location.id).limit(1)).first() is None  # no sample archive
        staff = db.execute(select(Staff)).scalars().all()
        assert [s.email for s in staff] == ["ops@example.org"]
        assert staff[0].role == "super-admin"
        # idempotent: a second start adds nothing
        seed(db)
        assert len(db.execute(select(Staff)).scalars().all()) == 1
        assert len(db.execute(select(Prompt)).scalars().all()) == 7


def test_sample_seed_includes_archive(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SEED", "sample")
    with _fresh_db(tmp_path) as db:
        seed(db)
        assert db.execute(select(Location.id).limit(1)).first() is not None
        assert db.scalar(select(Prompt.id).limit(1)) is not None


def test_none_seed_touches_nothing(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SEED", "none")
    with _fresh_db(tmp_path) as db:
        seed(db)
        assert db.execute(select(Prompt.id).limit(1)).first() is None
        assert db.execute(select(Staff.id).limit(1)).first() is None


def test_validate_requires_admin_for_base(monkeypatch):
    monkeypatch.setattr(config, "SEED", "base")
    monkeypatch.setattr(config, "ADMIN_EMAIL", "")
    monkeypatch.setattr(config, "ADMIN_PASSWORD", "")
    problems = config.validate()
    assert any("LBTF_ADMIN_EMAIL" in p for p in problems)
    assert any("LBTF_ADMIN_PASSWORD" in p for p in problems)


def test_validate_rejects_unknown_mode(monkeypatch):
    monkeypatch.setattr(config, "SEED", "staging")
    assert any("LBTF_SEED" in p for p in config.validate())


def test_validate_passes_for_sample(monkeypatch):
    monkeypatch.setattr(config, "SEED", "sample")
    assert config.validate() == []


def test_describe_names_db_and_mode(monkeypatch):
    monkeypatch.setattr(config, "SEED", "base")
    monkeypatch.setattr(config, "SITE_PASSWORD", "x")
    line = config.describe()
    assert "seed=base" in line and "gate=on" in line and "db=" in line


def test_env_file_with_ampersand_url_loads(tmp_path):
    """Neon URLs contain '&'; the profile must be parsed by dotenv, not the shell."""
    import subprocess, sys
    from pathlib import Path
    env_file = tmp_path / "profile.env"
    env_file.write_text("LBTF_DATABASE_URL=postgresql://u:p@example.neon.tech/db?sslmode=require&channel_binding=require\nLBTF_SEED=none\n")
    code = "from app import config; print(config.DATABASE_URL); print(config.SEED)"
    out = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True,
                         env={"LBTF_ENV_FILE": str(env_file)}, cwd=str(Path(__file__).resolve().parents[1]))
    assert out.returncode == 0, out.stderr
    assert "channel_binding=require" in out.stdout and "postgresql+psycopg://" in out.stdout
    assert out.stdout.strip().endswith("none")
