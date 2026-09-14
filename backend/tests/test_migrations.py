"""Startup migrations (app.migrate.run_migrations)."""
from sqlalchemy import create_engine, inspect, text

from app.db import Base
from app.migrate import BASELINE_REVISION, run_migrations
from app import config


def _engine(tmp_path, monkeypatch, name):
    url = f"sqlite:///{tmp_path / name}"
    monkeypatch.setattr(config, "MIGRATE_DATABASE_URL", url)
    return create_engine(url, connect_args={"check_same_thread": False})


def _version(engine):
    with engine.connect() as c:
        return c.execute(text("select version_num from alembic_version")).scalar()


def test_fresh_db_is_created_by_migrations(tmp_path, monkeypatch):
    engine = _engine(tmp_path, monkeypatch, "fresh.db")
    run_migrations(engine)
    tables = set(inspect(engine).get_table_names())
    assert {"locations", "stories", "submissions", "staff", "alembic_version"} <= tables
    assert _version(engine) is not None


def test_pre_alembic_db_is_stamped_not_recreated(tmp_path, monkeypatch):
    engine = _engine(tmp_path, monkeypatch, "legacy.db")
    Base.metadata.create_all(engine)  # how every DB was made before this change
    assert "alembic_version" not in inspect(engine).get_table_names()
    run_migrations(engine)  # would fail with "table already exists" without the stamp
    assert _version(engine) is not None
    run_migrations(engine)  # and it's idempotent


def test_baseline_matches_models(tmp_path, monkeypatch):
    """Autogenerate against a migrated DB should find nothing to do."""
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext

    engine = _engine(tmp_path, monkeypatch, "compare.db")
    run_migrations(engine)
    with engine.connect() as c:
        diff = compare_metadata(MigrationContext.configure(c), Base.metadata)
    assert diff == [], diff
