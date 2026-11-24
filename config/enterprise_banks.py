"""
Enterprise bank statement requirements mapping.
PostgreSQL-backed single source of truth using SQLAlchemy 2.0 and Psycopg 3.
Reads and writes directly to PostgreSQL tables 'enterprises' and 'enterprise_banks'.
"""
from typing import List, Optional
from backend.database import get_worker_session
from backend.database.models import Enterprise, EnterpriseBank


def load_enterprise_banks() -> dict:
    """Fetch all enterprises and their required banks directly from PostgreSQL."""
    try:
        with get_worker_session() as session:
            ents = session.query(Enterprise).order_by(Enterprise.id).all()
            return {
                e.code: {
                    "code": e.code,
                    "name": e.name,
                    "banks": [b.bank_name for b in e.banks],
                }
                for e in ents
            }
    except Exception as e:
        print(f"[ERROR] Failed to load enterprises from PostgreSQL: {e}")
        return {}


def save_enterprise_banks(data: dict) -> None:
    """
    Persist enterprise bank requirements into PostgreSQL inside an atomic transaction.
    """
    with get_worker_session() as session:
        for ent_key, ent_obj in data.items():
            code = (ent_obj.get("code") or ent_key).strip().upper()
            name = (ent_obj.get("name") or code).strip().upper()
            banks = [b.strip().upper() for b in ent_obj.get("banks", []) if b.strip()]

            ent = session.query(Enterprise).filter_by(code=code).first()
            if ent:
                ent.name = name
                # Replace banks
                session.query(EnterpriseBank).filter_by(enterprise_id=ent.id).delete()
            else:
                ent = Enterprise(code=code, name=name)
                session.add(ent)
                session.flush()

            for b in banks:
                session.add(EnterpriseBank(enterprise_id=ent.id, bank_name=b))

        session.commit()


def create_or_update_enterprise(code: str, name: str, banks: List[str]) -> dict:
    """Create or update an enterprise and its required bank statements in PostgreSQL."""
    code_val = code.strip().upper()
    name_val = name.strip().upper() or code_val
    clean_banks = [b.strip().upper() for b in banks if b.strip()]

    with get_worker_session() as session:
        ent = session.query(Enterprise).filter_by(code=code_val).first()
        if ent:
            ent.name = name_val
            session.query(EnterpriseBank).filter_by(enterprise_id=ent.id).delete()
        else:
            ent = Enterprise(code=code_val, name=name_val)
            session.add(ent)
            session.flush()

        for b in clean_banks:
            session.add(EnterpriseBank(enterprise_id=ent.id, bank_name=b))

        session.commit()

        return {
            "code": ent.code,
            "name": ent.name,
            "banks": clean_banks,
        }


def delete_enterprise(code: str) -> bool:
    """Delete an enterprise by code from PostgreSQL (cascades to enterprise_banks)."""
    code_val = code.strip().upper()
    with get_worker_session() as session:
        ent = session.query(Enterprise).filter_by(code=code_val).first()
        if not ent:
            return False

        session.delete(ent)
        session.commit()
        return True


def get_enterprise_banks(code_or_name: str) -> list:
    """Find expected banks by code or name (case-insensitive) directly from PostgreSQL."""
    key = (code_or_name or "").strip().upper()
    if not key:
        return []

    with get_worker_session() as session:
        # Match by code
        ent = session.query(Enterprise).filter_by(code=key).first()
        if ent:
            return [b.bank_name for b in ent.banks]

        # Match by exact name
        ent = session.query(Enterprise).filter_by(name=key).first()
        if ent:
            return [b.bank_name for b in ent.banks]

        # Match by name containment
        for e in session.query(Enterprise).all():
            if key in e.name.upper():
                return [b.bank_name for b in e.banks]

    return []
