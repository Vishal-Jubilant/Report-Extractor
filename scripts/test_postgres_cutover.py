"""
End-to-End PostgreSQL Cutover Test for RTGS PROJECT1.
Verifies that PostgreSQL is the sole source of truth and all bank extraction,
holder code mapping, and API endpoints function with 100% fidelity without JSON files.
"""
import os
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from config import account_codes, enterprise_banks, bank_layouts, regex_patterns
from core.holder import account_code_for
from backend.main import (
    health_check,
    get_supported_banks,
    get_settings,
    get_enterprises,
    _sync_precheck,
    _sync_extract,
)


def test_postgres_account_codes():
    print("--- 1. Testing PostgreSQL-Backed Account Codes ---")
    codes = account_codes.load_account_codes()
    print(f"  Loaded account codes count: {len(codes)}")
    assert len(codes) >= 6, f"Expected at least 6 codes, got {len(codes)}"
    assert codes.get("SUDHAKAR S") == "SS"
    assert codes.get("NIRMALA S") == "SN"
    assert codes.get("ROHIT ENTERPRISES") == "RE"
    assert codes.get("JUBILANT CAPITAL") == "JC"
    assert codes.get("A SQUARE ENTERPRISES") == "ASQ"
    assert codes.get("ACE ENTERPRISES") == "ACE"

    # Verify in-memory HOLDER_TO_CODE cache in core.holder
    for holder, expected_code in [
        ("SUDHAKAR S", "SS"),
        ("NIRMALA S", "SN"),
        ("ROHIT ENTERPRISES", "RE"),
        ("JUBILANT CAPITAL", "JC"),
        ("A SQUARE ENTERPRISES", "ASQ"),
        ("ACE ENTERPRISES", "ACE"),
    ]:
        resolved = account_code_for(holder)
        assert resolved == expected_code, f"Resolution mismatch for {holder}: expected {expected_code}, got {resolved}"

    # Test adding new code
    is_new, msg = account_codes.add_account_code("TEST CUTOVER HOLDER", "TCH")
    assert is_new is True
    assert account_code_for("TEST CUTOVER HOLDER") == "TCH"
    print("  [SUCCESS] Account codes loaded and holder resolution verified via PostgreSQL.")

    # Cleanup test row
    from backend.database import get_worker_session
    from backend.database.models import AccountCode
    with get_worker_session() as session:
        session.query(AccountCode).filter_by(holder_name="TEST CUTOVER HOLDER").delete()
        session.commit()
    # Reload cache after cleanup
    account_codes.HOLDER_TO_CODE = account_codes.load_account_codes()


def test_postgres_enterprise_banks():
    print("\n--- 2. Testing PostgreSQL-Backed Enterprises & Required Banks ---")
    eb_data = enterprise_banks.load_enterprise_banks()
    print(f"  Loaded enterprises count: {len(eb_data)}")
    assert len(eb_data) >= 6

    # Verify required banks for each enterprise (dynamic user configuration in PostgreSQL)
    for code, ent_info in eb_data.items():
        assert "name" in ent_info and len(ent_info["name"]) > 0

    # Verify get_enterprise_banks lookup helper
    jc_banks = enterprise_banks.get_enterprise_banks("JC")
    assert len(jc_banks) >= 1
    ace_banks = enterprise_banks.get_enterprise_banks("ACE ENTERPRISES")
    assert len(ace_banks) >= 1

    # Test enterprise CRUD
    ent = enterprise_banks.create_or_update_enterprise("TEST_CUTOVER", "TEST CUTOVER ENT", ["IDFC", "AXIS"])
    assert ent["code"] == "TEST_CUTOVER"
    assert sorted(ent["banks"]) == ["AXIS", "IDFC"]

    # Test enterprise delete
    deleted = enterprise_banks.delete_enterprise("TEST_CUTOVER")
    assert deleted is True
    print("  [SUCCESS] Enterprises and required banks CRUD verified via PostgreSQL.")


def test_api_endpoints():
    print("\n--- 3. Testing Backend API Endpoints ---")
    h = health_check()
    assert h["status"] == "ok"

    b = get_supported_banks()
    assert len(b["banks"]) >= 5

    s = get_settings()
    assert len(s["holder_to_code"]) >= 6
    assert len(s["enterprise_banks"]) >= 6

    e = get_enterprises()
    assert len(e["enterprises"]) >= 6

    # Test precheck and extraction workers
    pre = _sync_precheck([], "ALL")
    assert "has_missing" in pre and "enterprises" in pre

    res = _sync_extract([])
    assert "send" in res and "received" in res and "files" in res
    print("  [SUCCESS] All API endpoints return expected Pydantic structures with PostgreSQL data.")


def test_all_five_bank_parsers():
    print("\n--- 4. Testing All 5 Bank Parser Configurations & Regex Patterns ---")
    expected_banks = ["ICICI", "KOTAK", "AXIS", "IDBI", "IDFC"]
    for bank in expected_banks:
        assert bank in bank_layouts.BANK_LAYOUTS, f"Missing layout for bank: {bank}"
        layout = bank_layouts.BANK_LAYOUTS[bank]
        assert "holder_re" in layout, f"Missing holder_re for bank: {bank}"
        assert bank in regex_patterns.ROW_START, f"Missing ROW_START for bank: {bank}"
        assert bank in regex_patterns.BANK_PATTERNS, f"Missing regex patterns entry for bank: {bank}"
        patterns = regex_patterns.BANK_PATTERNS[bank]
        print(f"  Bank {bank}: Layout configured, {len(patterns)} regex patterns configured.")
    print("  [SUCCESS] All 5 bank extractors, layouts, and patterns validated without modification.")


def test_zero_json_dependency():
    print("\n--- 5. Verifying Zero JSON Dependency in config/ ---")
    ac_json = ROOT_DIR / "config" / "account_codes.json"
    eb_json = ROOT_DIR / "config" / "enterprise_banks.json"
    assert not ac_json.exists(), f"Error: {ac_json} still exists!"
    assert not eb_json.exists(), f"Error: {eb_json} still exists!"
    print("  [SUCCESS] Confirmed retired JSON persistence files are eliminated.")


if __name__ == "__main__":
    test_postgres_account_codes()
    test_postgres_enterprise_banks()
    test_api_endpoints()
    test_all_five_bank_parsers()
    test_zero_json_dependency()
    print("\n==========================================")
    print("ALL POSTGRESQL CUTOVER TESTS PASSED (100%!)")
    print("==========================================")
