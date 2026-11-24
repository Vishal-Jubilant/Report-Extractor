"""
Account-holder name handling.
  detect_holder()    : read the account holder name from PDF page 1 (bank-wise regex in bank_layouts.py)
  account_code_for() : holder name -> account code (config/account_codes.py)
  strip_holder()     : remove the holder's name (full or bank-truncated) from the END of a party name
      "THANGAMTRADERSS A SQUARE"  , "A SQUARE ENTERPRISES" -> "THANGAMTRADERSS"
      "NEW THANGAM STEELS ACE EN" , "ACE ENTERPRISES"      -> "NEW THANGAM STEELS"
"""
import re

from config import account_codes, accounts


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").upper())


def detect_holder(first_page_text: str, layout: dict) -> str:
    pat = layout.get("holder_re")
    if pat:
        m = re.search(pat, first_page_text or "")
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
    return ""


def account_code_for(holder: str):
    """Returns the account code for a holder name, or None if not in config/account_codes.py."""
    key = _norm(holder)
    for name, code in account_codes.HOLDER_TO_CODE.items():
        if _norm(name) == key:
            return code
    return None


def strip_holder(name: str, holder: str, holder_in_desc: bool = False) -> str:
    """
    holder_in_desc=True  (Kotak: the bank APPENDS the account holder's name to inward descriptions,
                          cut at ~25 characters -> "ALOK INFOTECH A SQUARE ENTERPRISE", "SRI IYYAPA WOOD TRADERS J")
        -> strip full or truncated holder name from the end (min 5 chars; any length if the text is ~25+ chars long).
    holder_in_desc=False (ICICI / Axis / IDBI / IDFC: holder name is normally NOT in the description)
        -> strict: the match must go BEYOND the holder's first word (so a surname like "...NIRMALA" is not removed).
    """
    h = _norm(holder)
    if not name or not h:
        return name
    words = holder.split()
    first = _norm(words[0]) if words else ""
    base = getattr(accounts, "HOLDER_MIN_MATCH", 5)
    if holder_in_desc:
        min_k = 1 if len(name.strip()) >= 24 else base
    else:
        min_k = max(base, len(first) + 1) if len(words) > 1 else len(h)
    chars = [(i, c.upper()) for i, c in enumerate(name) if not c.isspace()]
    n = "".join(c for _, c in chars)
    has_space = any(c.isspace() for c in name.strip())
    if min_k < base and not has_space:
        min_k = base
    for k in range(min(len(h), len(n) - 1), min_k - 1, -1):
        if n.endswith(h[:k]):
            cut = chars[len(n) - k][0]
            if has_space and cut > 0 and name[cut - 1].isalnum():
                continue  # don't cut inside a word
            rest = name[:cut].strip(" -/")
            if rest:
                return rest
    return name
