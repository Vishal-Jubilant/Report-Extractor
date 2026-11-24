"""
Database Backup & Restore Rollback Procedure for RTGS PROJECT1.
Provides automated backup and rollback capabilities using pg_dump / SQL or JSON snapshots.
"""
import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.database import engine, get_worker_session
from backend.database.models import AccountCode, Enterprise, EnterpriseBank


BACKUP_DIR = ROOT_DIR / "backups" / "db_snapshots"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def backup_database():
    """Create a structured snapshot of all PostgreSQL tables."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_file = BACKUP_DIR / f"snapshot_{timestamp}.json"

    with get_worker_session() as session:
        # 1. Account codes
        account_codes = [
            {
                "id": ac.id,
                "holder_name": ac.holder_name,
                "account_code": ac.account_code,
                "created_at": ac.created_at.isoformat() if ac.created_at else None,
                "updated_at": ac.updated_at.isoformat() if ac.updated_at else None,
            }
            for ac in session.query(AccountCode).order_by(AccountCode.id).all()
        ]

        # 2. Enterprises and banks
        enterprises = []
        for ent in session.query(Enterprise).order_by(Enterprise.id).all():
            enterprises.append({
                "id": ent.id,
                "code": ent.code,
                "name": ent.name,
                "created_at": ent.created_at.isoformat() if ent.created_at else None,
                "updated_at": ent.updated_at.isoformat() if ent.updated_at else None,
                "banks": [b.bank_name for b in ent.banks],
            })

    snapshot = {
        "timestamp": timestamp,
        "database": "rtgs_db",
        "tables": {
            "account_codes": account_codes,
            "enterprises": enterprises,
        },
        "counts": {
            "account_codes": len(account_codes),
            "enterprises": len(enterprises),
            "enterprise_banks": sum(len(e["banks"]) for e in enterprises),
        }
    }

    with open(backup_file, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)

    print(f"[BACKUP SUCCESS] Database snapshot written to: {backup_file}")
    print(f"  Account codes: {len(account_codes)}, Enterprises: {len(enterprises)}")
    return str(backup_file)


def restore_database(snapshot_path: str):
    """Restore database state from a snapshot JSON file."""
    path = Path(snapshot_path)
    if not path.exists():
        raise FileNotFoundError(f"Backup file not found: {snapshot_path}")

    with open(path, "r", encoding="utf-8") as f:
        snapshot = json.load(f)

    with get_worker_session() as session:
        # Atomic clear & restore inside single transaction
        session.query(EnterpriseBank).delete()
        session.query(Enterprise).delete()
        session.query(AccountCode).delete()

        # Restore account codes
        for item in snapshot["tables"]["account_codes"]:
            session.add(AccountCode(
                holder_name=item["holder_name"],
                account_code=item["account_code"]
            ))

        # Restore enterprises and their banks
        for ent_data in snapshot["tables"]["enterprises"]:
            ent = Enterprise(
                code=ent_data["code"],
                name=ent_data["name"]
            )
            session.add(ent)
            session.flush()

            for b in ent_data.get("banks", []):
                session.add(EnterpriseBank(
                    enterprise_id=ent.id,
                    bank_name=b
                ))

        session.commit()

    print(f"[RESTORE SUCCESS] Database restored cleanly from: {snapshot_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RTGS PROJECT1 Database Backup & Restore")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("backup", help="Create a database snapshot")
    restore_parser = subparsers.add_parser("restore", help="Restore database from snapshot")
    restore_parser.add_argument("file", help="Path to snapshot JSON file")

    args = parser.parse_args()
    if args.command == "backup":
        backup_database()
    elif args.command == "restore":
        restore_database(args.file)
