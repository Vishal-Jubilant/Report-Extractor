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
                    "group_name": e.group_name or e.code,
                    "banks": [b.bank_name for b in e.banks],
                }
                for e in ents
            }
    except Exception as e:
        print(f"[ERROR] Failed to load enterprises from PostgreSQL: {e}")
        return {}


def load_groups() -> list:
    """Fetch all groups with their nested enterprises."""
    try:
        with get_worker_session() as session:
            ents = session.query(Enterprise).order_by(Enterprise.id).all()
            groups_dict = {}
            for e in ents:
                if not e.group_name or not e.group_name.strip():
                    continue
                grp = e.group_name.strip().upper()
                if grp not in groups_dict:
                    groups_dict[grp] = {
                        "group_name": grp,
                        "enterprises": []
                    }
                groups_dict[grp]["enterprises"].append({
                    "code": e.code,
                    "name": e.name,
                    "banks": [b.bank_name for b in e.banks],
                })
            return list(groups_dict.values())
    except Exception as e:
        print(f"[ERROR] Failed to load groups from PostgreSQL: {e}")
        return []


def save_group(group_name: str, enterprises_list: List[dict], old_group_name: Optional[str] = None) -> dict:
    """Save or update a group and all its associated enterprises."""
    grp = group_name.strip().upper()
    old_grp = (old_group_name or grp).strip().upper()

    with get_worker_session() as session:
        # Find existing enterprises belonging to old_grp
        existing_ents = session.query(Enterprise).filter(
            Enterprise.group_name == old_grp
        ).all()

        incoming_codes = set()
        for item in enterprises_list:
            raw_name = item.get("name", "").strip().upper()
            raw_code = (item.get("code") or raw_name).strip().upper()
            if raw_code:
                incoming_codes.add(raw_code)

        # Unassign group_name for any enterprise removed from this group (preserve enterprise entity)
        for e in existing_ents:
            if e.code not in incoming_codes:
                e.group_name = None

        session.flush()

        saved_items = []
        for item in enterprises_list:
            name = item.get("name", "").strip().upper()
            code = (item.get("code") or name).strip().upper()
            banks = [b.strip().upper() for b in item.get("banks", []) if b.strip()]
            if not code:
                continue

            ent = session.query(Enterprise).filter_by(code=code).first()
            if ent:
                ent.group_name = grp
                ent.name = name
                session.query(EnterpriseBank).filter_by(enterprise_id=ent.id).delete()
            else:
                ent = Enterprise(group_name=grp, code=code, name=name)
                session.add(ent)
                session.flush()

            for b in banks:
                session.add(EnterpriseBank(enterprise_id=ent.id, bank_name=b))

            saved_items.append({
                "code": code,
                "name": name,
                "banks": banks
            })

            # Auto-sync with account_codes
            from backend.database.models import AccountCode
            existing_ac = session.query(AccountCode).filter_by(holder_name=name).first()
            if existing_ac:
                existing_ac.account_code = code
            else:
                session.add(AccountCode(holder_name=name, account_code=code))

        session.commit()

        return {
            "group_name": grp,
            "enterprises": saved_items
        }


def delete_group(group_name: str) -> bool:
    """Delete a group without deleting the underlying enterprises."""
    grp = group_name.strip().upper()
    with get_worker_session() as session:
        ents = session.query(Enterprise).filter(
            Enterprise.group_name == grp
        ).all()
        if not ents:
            return False
        # Remove group association from all enterprises in this group (preserves enterprise entities)
        for e in ents:
            e.group_name = None
        session.commit()
        return True


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
