"""Bring the database schema to the current Alembic head at startup.

Replaces ``Base.metadata.create_all``: create_all only adds missing tables and
never alters existing ones, so once a database holds real data every schema
change has to be a migration. Running ``upgrade head`` here means a fresh
database, a year-old staging database, and the test suite all converge on the
same schema through the same path.

Databases created by create_all before Alembic existed have the tables but no
``alembic_version`` row; those get stamped at the baseline first so the upgrade
doesn't try to CREATE tables that are already there.
"""
from __future__ import annotations

import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from .config import BASE_DIR, MIGRATE_DATABASE_URL

BASELINE_REVISION = "d0c4d2a45cc5"
log = logging.getLogger("lbtf")


def alembic_config() -> Config:
    cfg = Config(str(BASE_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BASE_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", MIGRATE_DATABASE_URL.replace("%", "%%"))
    cfg.attributes["configure_logger"] = False  # keep alembic's logging.ini out of the app's logs
    return cfg


def run_migrations(engine: Engine) -> None:
    tables = set(inspect(engine).get_table_names())
    cfg = alembic_config()
    if "locations" in tables and "alembic_version" not in tables:
        log.info("schema predates alembic; stamping baseline %s", BASELINE_REVISION)
        command.stamp(cfg, BASELINE_REVISION)
    command.upgrade(cfg, "head")
