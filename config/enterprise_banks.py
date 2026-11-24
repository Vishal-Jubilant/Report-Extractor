import json
import os
import threading

CONFIG_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_FILE = os.path.join(CONFIG_DIR, "enterprise_banks.json")

_lock = threading.Lock()

DEFAULT_ENTERPRISE_BANKS = {
    "JC": {
        "code": "JC",
        "name": "JC ENTERPRISE",
        "banks": ["KOTAK", "IDFC"],
    },
    "ACE": {
        "code": "ACE",
        "name": "ACE ENTERPRISES",
        "banks": ["IDBI"],
    },
    "RE": {
        "code": "RE",
        "name": "ROHIT ENTERPRISES",
        "banks": ["ICICI", "AXIS"],
    },
    "SS": {
        "code": "SS",
        "name": "SUDHAKAR S",
        "banks": ["ICICI"],
    },
    "SN": {
        "code": "SN",
        "name": "NIRMALA S",
        "banks": ["ICICI"],
    },
    "ASQ": {
        "code": "ASQ",
        "name": "A SQUARE ENTERPRISES",
        "banks": ["KOTAK", "IDBI"],
    },
}


def load_enterprise_banks() -> dict:
    if not os.path.exists(JSON_FILE):
        save_enterprise_banks(DEFAULT_ENTERPRISE_BANKS)
        return DEFAULT_ENTERPRISE_BANKS

    try:
        with open(JSON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else DEFAULT_ENTERPRISE_BANKS
    except Exception:
        return DEFAULT_ENTERPRISE_BANKS


def save_enterprise_banks(data: dict) -> None:
    with _lock:
        temp_file = JSON_FILE + ".tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(temp_file, JSON_FILE)


def get_enterprise_banks(code_or_name: str) -> list:
    """Find expected banks by code or name (case-insensitive)."""
    key = (code_or_name or "").strip().upper()
    data = load_enterprise_banks()

    if key in data:
        return data[key].get("banks", [])

    for k, v in data.items():
        if k.upper() == key:
            return v.get("banks", [])
        if v.get("name", "").strip().upper() == key:
            return v.get("banks", [])
        if key in v.get("name", "").strip().upper():
            return v.get("banks", [])

    return []
