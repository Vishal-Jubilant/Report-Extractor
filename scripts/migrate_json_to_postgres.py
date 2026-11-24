"""
Idempotent JSON to PostgreSQL Migration Script for RTGS PROJECT1.
- Ingests config/account_codes.json and config/enterprise_banks.json.
- Detects conflicts instead of silently clobbering existing records.
- Verifies exact records and values after migration.
"""
import json
import os
import sys
from pathlib import Path

# Add project root to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from backend.database import get_worker_session
from backend.database.models import AccountCode, Enterprise, EnterpriseBank


ACCOUNT_CODES_JSON = ROOT_DIR / "config" / "account_codes.json"
ENTERPRISE_BANKS_JSON = ROOT_DIR / "config" / "enterprise_banks.json"


def migrate_account_codes(session) -> tuple[int, int, list]:
    """
    Migrates account_codes.json into account_codes table.
    Returns (inserted_count, skipped_count, conflicts_list).
    """
    if not ACCOUNT_CODES_JSON.exists():
        raise FileNotFoundError(f"Missing {ACCOUNT_CODES_JSON}")

    with open(ACCOUNT_CODES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    inserted = 0
    skipped = 0
    conflicts = []

    for raw_holder, raw_code in data.items():
        holder = raw_holder.strip().upper()
        code = raw_code.strip().upper()

        existing = session.query(AccountCode).filter_by(holder_name=holder).first()
        if existing:
            if existing.account_code == code:
                skipped += 1
            else:
                conflicts.append({
                    "holder_name": holder,
                    "existing_code": existing.account_code,
                    "incoming_code": code,
                })
        else:
            session.add(AccountCode(holder_name=holder, account_code=code))
            inserted += 1

    return inserted, skipped, conflicts


def migrate_enterprise_banks(session) -> tuple[int, int, list]:
    """
    Migrates enterprise_banks.json into enterprises and enterprise_banks tables.
    Returns (inserted_count, skipped_count, conflicts_list).
    """
    if not ENTERPRISE_BANKS_JSON.exists():
        raise FileNotFoundError(f"Missing {ENTERPRISE_BANKS_JSON}")

    with open(ENTERPRISE_BANKS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    inserted_ents = 0
    skipped_ents = 0
    conflicts = []

    for ent_key, ent_obj in data.items():
        code = (ent_obj.get("code") or ent_key).strip().upper()
        name = (ent_obj.get("name") or code).strip().upper()
        banks = [b.strip().upper() for b in ent_obj.get("banks", []) if b.strip()]

        existing_ent = session.query(Enterprise).filter_by(code=code).first()
        if existing_ent:
            existing_banks = {b.bank_name for b in existing_ent.banks}
            incoming_banks = set(banks)

            if existing_ent.name == name and existing_banks == incoming_banks:
                skipped_ents += 1
            else:
                conflicts.append({
                    "code": code,
                    "existing_name": existing_ent.name,
                    "incoming_name": name,
                    "existing_banks": sorted(list(existing_banks)),
                    "incoming_banks": sorted(list(incoming_banks)),
                })
        else:
            new_ent = Enterprise(code=code, name=name)
            session.add(new_ent)
            session.flush()  # populate new_ent.id for foreign keys

            for b in banks:
                session.add(EnterpriseBank(enterprise_id=new_ent.id, bank_name=b))
            inserted_ents += 1

    return inserted_ents, skipped_ents, conflicts


def verify_migrated_data(session):
    """Deep verification comparing PostgreSQL database rows with source JSON files."""
    print("\n--- Verifying Migrated Records & Values ---")

    # 1. Verify Account Codes
    with open(ACCOUNT_CODES_JSON, "r", encoding="utf-8") as f:
        json_codes = json.load(f)

    db_codes = {ac.holder_name: ac.account_code for ac in session.query(AccountCode).all()}
    print(f"  Account codes in JSON: {len(json_codes)} | in PostgreSQL: {len(db_codes)}")
    assert len(db_codes) >= len(json_codes), "Mismatch: fewer records in DB than in JSON!"

    for holder, code in json_codes.items():
        h = holder.strip().upper()
        c = code.strip().upper()
        assert h in db_codes, f"Missing holder in DB: {h}"
        assert db_codes[h] == c, f"Value mismatch for {h}: expected {c}, got {db_codes[h]}"
    print("  [SUCCESS] All account codes matched exactly (100% record and value equality).")

    # 2. Verify Enterprises & Required Banks
    with open(ENTERPRISE_BANKS_JSON, "r", encoding="utf-8") as f:
        json_ents = json.load(f)

    db_ents = session.query(Enterprise).all()
    db_ent_map = {e.code: (e.name, sorted([b.bank_name for b in e.banks])) for e in db_ents}
    print(f"  Enterprises in JSON: {len(json_ents)} | in PostgreSQL: {len(db_ent_map)}")
    assert len(db_ent_map) >= len(json_ents), "Mismatch: fewer enterprises in DB than in JSON!"

    total_expected_banks = 0
    total_db_banks = session.query(EnterpriseBank).count()

    for ent_key, ent_obj in json_ents.items():
        code = (ent_obj.get("code") or ent_key).strip().upper()
        name = (ent_obj.get("name") or code).strip().upper()
        banks = sorted([b.strip().upper() for b in ent_obj.get("banks", []) if b.strip()])
        total_expected_banks += len(banks)

        assert code in db_ent_map, f"Missing enterprise code in DB: {code}"
        db_name, db_banks = db_ent_map[code]
        assert db_name == name, f"Name mismatch for {code}: expected {name}, got {db_name}"
        assert db_banks == banks, f"Banks mismatch for {code}: expected {banks}, got {db_banks}"

    print(f"  Bank requirements in JSON: {total_expected_banks} | in PostgreSQL: {total_db_banks}")
    assert total_db_banks >= total_expected_banks, "Mismatch: fewer bank requirements in DB than in JSON!"
    print("  [SUCCESS] All enterprises and bank requirements matched exactly (100% record and value equality).")


def run_migration():
    print("==========================================")
    print("STARTING JSON TO POSTGRESQL DATA MIGRATION")
    print("==========================================")

    with get_worker_session() as session:
        # Migrate Account Codes
        ac_ins, ac_skip, ac_conflicts = migrate_account_codes(session)
        print(f"\nAccount Codes Migration:")
        print(f"  Inserted: {ac_ins}, Skipped (Already Present): {ac_skip}, Conflicts: {len(ac_conflicts)}")
        if ac_conflicts:
            print(f"  [CONFLICT WARNING]: {ac_conflicts}")
            raise ValueError(f"Conflicting account codes detected: {ac_conflicts}")

        # Migrate Enterprises & Banks
        eb_ins, eb_skip, eb_conflicts = migrate_enterprise_banks(session)
        print(f"\nEnterprises & Banks Migration:")
        print(f"  Inserted: {eb_ins}, Skipped (Already Present): {eb_skip}, Conflicts: {len(eb_conflicts)}")
        if eb_conflicts:
            print(f"  [CONFLICT WARNING]: {eb_conflicts}")
            raise ValueError(f"Conflicting enterprise definitions detected: {eb_conflicts}")

        # Commit all migrated records inside single transaction
        session.commit()
        print("\n[SUCCESS] Transaction committed successfully.")

        # Deep verification
        verify_migrated_data(session)

    print("\n==========================================")
    print("DATA MIGRATION & VERIFICATION COMPLETED SUCCESSFULLY!")
    print("==========================================")


if __name__ == "__main__":
    run_migration()
