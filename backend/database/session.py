"""
Session management for FastAPI requests and background worker threads.
Guarantees thread isolation: worker threads NEVER share sessions.
"""
from typing import Generator
from contextlib import contextmanager
from sqlalchemy.orm import Session
from backend.database.config import SessionFactory


def get_db() -> Generator[Session, None, None]:
    """FastAPI request-scoped dependency yielding a managed session with rollback on exception."""
    session = SessionFactory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


@contextmanager
def get_worker_session() -> Generator[Session, None, None]:
    """
    Creates an isolated, thread-safe session specifically for worker threads.
    Ensures every background task/thread owns its own independent session.
    """
    session = SessionFactory()
    try:
        yield session
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
