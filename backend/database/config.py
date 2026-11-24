"""
Database configuration and SQLAlchemy 2.0 engine setup with Psycopg 3.
Loads credentials strictly from environment variables via python-dotenv.
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Locate and load .env file from project root
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()


def get_database_url() -> str:
    """Build or retrieve database URL using postgresql+psycopg://."""
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        # Ensure it uses postgresql+psycopg:// (Psycopg 3)
        if explicit_url.startswith("postgresql://"):
            return explicit_url.replace("postgresql://", "postgresql+psycopg://", 1)
        if explicit_url.startswith("postgresql+psycopg2://"):
            return explicit_url.replace("postgresql+psycopg2://", "postgresql+psycopg://", 1)
        return explicit_url

    user = os.getenv("DB_USER", "postgres")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    db_name = os.getenv("DB_NAME", "rtgs_db")
    return f"postgresql+psycopg://{user}:{password}@{host}:{port}/{db_name}"


DATABASE_URL = get_database_url()

# SQLAlchemy 2.0 engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

# Standard sessionmaker for application sessions
SessionFactory = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)
