"""
Account holder name -> Account code mapping.
Persisted safely in config/account_codes.json with backward-compatible HOLDER_TO_CODE dict export.
"""
import json
import os
import threading

CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(CONFIG_DIR, "account_codes.json")

DEFAULT_HOLDER_TO_CODE = {
    "SUDHAKAR S": "SS",
    "NIRMALA S": "SN",
    "ROHIT ENTERPRISES": "RE",
    "JUBILANT CAPITAL": "JC",
    "A SQUARE ENTERPRISES": "ASQ",
    "ACE ENTERPRISES": "ACE",
}

_lock = threading.Lock()


def load_account_codes() -> dict:
    if not os.path.exists(JSON_PATH):
        save_account_codes(DEFAULT_HOLDER_TO_CODE)
        return dict(DEFAULT_HOLDER_TO_CODE)

    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else dict(DEFAULT_HOLDER_TO_CODE)
    except Exception:
        return dict(DEFAULT_HOLDER_TO_CODE)


def save_account_codes(data: dict) -> None:
    with _lock:
        temp_file = JSON_PATH + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, JSON_PATH)


def add_account_code(holder: str, code: str) -> tuple[bool, str]:
    """
    Safely adds or updates an account code mapping.
    Returns (is_new, status_message).
    """
    holder_key = holder.strip().upper()
    code_val = code.strip().upper()

    with _lock:
        data = load_account_codes()
        is_existing = holder_key in data
        data[holder_key] = code_val

        temp_file = JSON_PATH + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, JSON_PATH)

        # Update module global dictionary in place
        global HOLDER_TO_CODE
        HOLDER_TO_CODE.clear()
        HOLDER_TO_CODE.update(data)

    if is_existing:
        return False, f"Account '{holder_key}' updated to '{code_val}' in configuration"
    return True, f"Added '{holder_key}' -> '{code_val}' successfully"


# Export backward-compatible dictionary
HOLDER_TO_CODE = load_account_codes()
