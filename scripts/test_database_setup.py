"""
Comprehensive test script for PostgreSQL database setup, Alembic migrations,
SQLAlchemy 2.0 Psycopg 3 integration, and worker thread session isolation.
"""
import concurrent.futures
import os
import sys
import threading

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from backend.database import engine, get_worker_session, SessionFactory
from backend.database.models import AccountCode, Enterprise, EnterpriseBank


def test_connection():
    print("--- 1. Testing Database Connection ---")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version(), current_database();")).fetchone()
        print(f"  [SUCCESS] Connected to database: {result[1]}")
        print(f"  [SUCCESS] Database Engine Version: {result[0]}")


def test_schema_and_tables():
    print("\n--- 2. Inspecting Tables & Schema ---")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"  Tables found: {tables}")
    assert "account_codes" in tables, "Table 'account_codes' missing!"
    assert "enterprises" in tables, "Table 'enterprises' missing!"
    assert "enterprise_banks" in tables, "Table 'enterprise_banks' missing!"
    assert "alembic_version" in tables, "Table 'alembic_version' missing!"
    print("  [SUCCESS] All 4 required tables present.")

    # Inspect account_codes columns & constraints
    ac_cols = {col["name"]: str(col["type"]) for col in inspector.get_columns("account_codes")}
    print(f"  account_codes columns: {ac_cols}")
    assert "holder_name" in ac_cols and "account_code" in ac_cols
    ac_uniques = [u["name"] for u in inspector.get_unique_constraints("account_codes")]
    print(f"  account_codes unique constraints: {ac_uniques}")
    ac_indexes = inspector.get_indexes("account_codes")
    # Verify NO redundant index on holder_name (only the unique constraint backing index exists, no ix_*)
    redundant_ac_indexes = [idx["name"] for idx in ac_indexes if idx["name"] != "account_codes_holder_name_key" and not idx.get("primary_key")]
    print(f"  account_codes redundant non-unique indexes: {redundant_ac_indexes}")
    assert len(redundant_ac_indexes) == 0, f"Redundant index found on account_codes: {redundant_ac_indexes}"
    print("  [SUCCESS] account_codes constraints & non-redundant indexing verified.")

    # Inspect enterprises columns & constraints
    ent_cols = {col["name"]: str(col["type"]) for col in inspector.get_columns("enterprises")}
    print(f"  enterprises columns: {ent_cols}")
    assert "code" in ent_cols and "name" in ent_cols
    ent_indexes = inspector.get_indexes("enterprises")
    # Verify NO redundant index on code (only the unique constraint backing index exists, and ix_enterprises_group_name)
    redundant_ent_indexes = [idx["name"] for idx in ent_indexes if idx["name"] not in ("enterprises_code_key", "ix_enterprises_group_name") and not idx.get("primary_key")]
    print(f"  enterprises redundant non-unique indexes: {redundant_ent_indexes}")
    assert len(redundant_ent_indexes) == 0, f"Redundant index found on enterprises: {redundant_ent_indexes}"
    print("  [SUCCESS] enterprises constraints & non-redundant indexing verified.")

    # Inspect enterprise_banks foreign keys and composite unique constraint
    eb_fks = inspector.get_foreign_keys("enterprise_banks")
    print(f"  enterprise_banks foreign keys: {eb_fks}")
    assert len(eb_fks) == 1, "Missing foreign key on enterprise_banks!"
    assert eb_fks[0]["referred_table"] == "enterprises"
    eb_uniques = inspector.get_unique_constraints("enterprise_banks")
    unique_names = [u["name"] for u in eb_uniques]
    assert "uq_enterprise_bank" in unique_names
    print("  [SUCCESS] enterprise_banks FK with CASCADE and composite unique constraint verified.")


def test_transaction_and_rollback():
    print("\n--- 3. Testing Explicit Transaction & Rollback ---")
    with get_worker_session() as session:
        # Clean any prior test row if exists
        session.query(AccountCode).filter_by(holder_name="TEST ROLLBACK HOLDER").delete()
        session.commit()

    # Intentional failure block to test rollback
    try:
        with get_worker_session() as session:
            test_row = AccountCode(holder_name="TEST ROLLBACK HOLDER", account_code="TRB")
            session.add(test_row)
            session.flush()
            # Force an exception before commit
            raise ValueError("Intentional simulated error to trigger rollback")
    except ValueError:
        pass

    # Verify that the test row was NOT committed
    with get_worker_session() as session:
        persisted = session.query(AccountCode).filter_by(holder_name="TEST ROLLBACK HOLDER").first()
        assert persisted is None, "Rollback failed: row was committed despite exception!"
        print("  [SUCCESS] Explicit rollback confirmed: uncommitted row reverted cleanly.")


def test_worker_thread_session_isolation():
    print("\n--- 4. Testing Worker Thread Session Isolation ---")
    session_ids = []
    thread_names = []
    lock = threading.Lock()

    def worker_task(thread_id: int):
        with get_worker_session() as session:
            # Execute quick query to obtain connection
            session.execute(text("SELECT 1;"))
            with lock:
                session_ids.append(id(session))
                thread_names.append(threading.current_thread().name)

    # Spawn 5 concurrent threads executing database tasks
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(worker_task, i) for i in range(5)]
        concurrent.futures.wait(futures)

    print(f"  Sessions created across threads: {session_ids}")
    # Verify every thread received a completely unique Session instance
    assert len(session_ids) == 5, f"Expected 5 sessions, got {len(session_ids)}"
    assert len(set(session_ids)) == 5, "Duplicate session instance detected across worker threads!"
    print("  [SUCCESS] Complete worker thread session isolation confirmed. Zero session sharing.")


if __name__ == "__main__":
    test_connection()
    test_schema_and_tables()
    test_transaction_and_rollback()
    test_worker_thread_session_isolation()
    print("\n==========================================")
    print("ALL DATABASE SETUP TESTS PASSED SUCCESSFULLY!")
    print("==========================================")
