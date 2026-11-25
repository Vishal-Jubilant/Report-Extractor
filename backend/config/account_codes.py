"""
Account holder name -> Account code mapping.
PostgreSQL-backed single source of truth using SQLAlchemy 2.0 and Psycopg 3.
Maintains in-memory HOLDER_TO_CODE cache updated only after successful database commits.
"""
from backend.database import get_worker_session
from backend.database.models import AccountCode


def load_account_codes() -> dict:
    """Fetch all account codes directly from PostgreSQL."""
    try:
        with get_worker_session() as session:
            records = session.query(AccountCode).order_by(AccountCode.id).all()
            return {r.holder_name: r.account_code for r in records}
    except Exception as e:
        print(f"[ERROR] Failed to load account codes from PostgreSQL: {e}")
        return {}


def save_account_codes(data: dict) -> None:
    """
    Bulk update or populate account codes in PostgreSQL.
    Refreshes in-memory cache only after successful database commit.
    """
    with get_worker_session() as session:
        for raw_holder, raw_code in data.items():
            holder_key = raw_holder.strip().upper()
            code_val = raw_code.strip().upper()

            existing = session.query(AccountCode).filter_by(holder_name=holder_key).first()
            if existing:
                existing.account_code = code_val
            else:
                session.add(AccountCode(holder_name=holder_key, account_code=code_val))

        session.commit()

        # Update in-memory cache only after commit succeeds
        global HOLDER_TO_CODE
        HOLDER_TO_CODE.clear()
        records = session.query(AccountCode).all()
        HOLDER_TO_CODE.update({r.holder_name: r.account_code for r in records})


def add_account_code(holder: str, code: str) -> tuple[bool, str]:
    """
    Safely adds or updates an account code mapping directly in PostgreSQL.
    Guarantees session isolation and refreshes in-memory cache only after commit.
    Returns (is_new, status_message).
    """
    holder_key = holder.strip().upper()
    code_val = code.strip().upper()

    with get_worker_session() as session:
        existing = session.query(AccountCode).filter_by(holder_name=holder_key).first()
        is_existing = existing is not None

        if is_existing:
            existing.account_code = code_val
        else:
            session.add(AccountCode(holder_name=holder_key, account_code=code_val))

        session.commit()

        # Refresh in-memory cache only after successful commit
        global HOLDER_TO_CODE
        HOLDER_TO_CODE[holder_key] = code_val

    if is_existing:
        return False, f"Account '{holder_key}' updated to '{code_val}' in PostgreSQL"
    return True, f"Added '{holder_key}' -> '{code_val}' successfully"


# Export backward-compatible dictionary initialized from PostgreSQL
HOLDER_TO_CODE = load_account_codes()
