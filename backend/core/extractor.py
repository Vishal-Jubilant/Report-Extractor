import importlib
import os
import re
import pdfplumber

from backend.config import account_codes, accounts, bank_layouts, enterprise_banks, name_mappings, regex_patterns
from backend.core.amount_format import short_amount
from backend.core import tabular
from backend.core.holder import account_code_for, detect_holder, strip_holder


def _reload_config():
    """No need to restart the app after editing config - reloaded on each run."""
    for m in (bank_layouts, regex_patterns, name_mappings, accounts, account_codes, enterprise_banks):
        importlib.reload(m)


def _norm(text: str) -> str:
    return re.sub(r"\s+", "", (text or "").upper())


def _cell(cell, join: str) -> str:
    parts = [p.strip() for p in (cell or "").split("\n")]
    return join.join(p for p in parts if p).strip()


def identify_account(pdf_file, bank: str, filename: str = ""):
    """
    Returns (code, holder, warning).
    Account code = from ACCOUNT HOLDER NAME inside the PDF -> config/account_codes.py
    (file name is NOT used, except as a last resort when the holder name can not be read).
    """
    _reload_config()
    layout = bank_layouts.BANK_LAYOUTS[bank]
    holder = _read_holder(pdf_file, layout)
    if not holder:
        return (account_code(filename) if filename else "?"), "", (
            "Account holder name could not be read from this file. "
            "Account code taken from file name as a fallback.")
    code = account_code_for(holder)
    if code is None:
        return holder.upper(), holder, (
            f'Account holder "{holder}" is not in config/account_codes.py. Add this line:  '
            f'"{holder.upper()}": "CODE",')
    return code, holder, ""


def _read_holder(f, layout: dict) -> str:
    """Account holder name from a PDF (page 1) or a CSV / Excel sheet."""
    if tabular.is_sheet(f):
        return tabular.holder_from_sheet(tabular.load_grid(f), layout)
    with pdfplumber.open(f) as pdf:
        return detect_holder(pdf.pages[0].extract_text() or "", layout)


def account_code(filename: str) -> str:
    """'SS_-_ICICI_-_PERSONAL (1).pdf' -> 'SS'"""
    stem = os.path.splitext(os.path.basename(filename))[0]
    return re.split(r"[\s_]*-[\s_]*", stem)[0].strip().upper() or stem.upper()


def account_sort_key(code: str):
    order = [c.upper() for c in accounts.ACCOUNT_ORDER]
    return order.index(code) if code in order else len(order)


# ---------------------------------------------------------------- bank detect
def detect_bank(pdf_file):
    _reload_config()
    if tabular.is_sheet(pdf_file):
        text = tabular.sheet_text(tabular.load_grid(pdf_file)).upper()
    else:
        with pdfplumber.open(pdf_file) as pdf:
            text = (pdf.pages[0].extract_text() or "").upper()
    # Pass 1: bank NAME keywords (earliest on the page wins). Pass 2: IFSC-like keywords (contain digits).
    # (An IFSC of ANOTHER bank can appear inside transaction rows, e.g. "...KKBK0008664" in an IDFC statement.)
    for want_codes in (False, True):
        best, best_pos = None, None
        for bank, layout in bank_layouts.BANK_LAYOUTS.items():
            for k in layout["detect"]:
                if any(ch.isdigit() for ch in k) != want_codes:
                    continue
                pos = text.find(k)
                if pos != -1 and (best_pos is None or pos < best_pos):
                    best, best_pos = bank, pos
        if best:
            return best
    return None


# ---------------------------------------------------------------- name logic
def extract_name(text: str, bank: str):
    for pat in regex_patterns.BANK_PATTERNS.get(bank, []):
        m = re.search(pat, text)
        if m:
            name = m.group(1).strip(" -/")
            return re.sub(r"\s+", " ", name)
    return None


def correct_name(raw: str, code: str = ""):
    """Returns (final_name, mapped?). Checks global name mappings."""
    key = _norm(raw)
    lookup = {_norm(k): v for k, v in name_mappings.NAME_MAPPINGS.items()}
    if key in lookup:
        return lookup[key], True
    return raw, False


def get_amount(wd, dep):
    w = re.sub(r"\s", "", wd or "")
    d = re.sub(r"\s", "", dep or "")
    amt, typ = (w, "Dr") if w else (d, "Cr")
    if amt.endswith(".00"):
        amt = amt[:-3]
    return amt, typ


# ---------------------------------------------------------------- main
def _pdf_rows(pdf_file, layout, holder):
    """Yields (description, ref, withdrawal, deposit) from the PDF tables."""
    cols = [layout["desc_col"], layout["dr_col"], layout["cr_col"]]
    if layout["ref_col"] is not None:
        cols.append(layout["ref_col"])
    need = max(layout["min_cols"], max(cols) + 1)
    with pdfplumber.open(pdf_file) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                for row in table:
                    if len(row) < need:
                        continue
                    desc = _cell(row[layout["desc_col"]], layout["join"])
                    ref = _cell(row[layout["ref_col"]], " ") if layout["ref_col"] is not None else ""
                    yield desc, ref, row[layout["dr_col"]], row[layout["cr_col"]]


def extract_transactions(pdf_file, bank: str, code: str, holder: str = None):
    _reload_config()
    layout = bank_layouts.BANK_LAYOUTS[bank]
    start_re = re.compile(regex_patterns.ROW_START[bank])
    ref_pat = regex_patterns.ROW_REF_START.get(bank)
    ref_re = re.compile(ref_pat) if ref_pat else None

    if holder is None:
        holder = _read_holder(pdf_file, layout)

    if tabular.is_sheet(pdf_file):                      # CSV / Excel
        source = tabular.rows_from_grid(tabular.load_grid(pdf_file))
    else:                                               # PDF
        source = _pdf_rows(pdf_file, layout, holder)

    rows = []
    for desc, ref, wd, dep in source:
        # Condition: DESCRIPTION start match or CHQ/REF start match
        if not (start_re.search(desc) or (ref_re and ref_re.search(ref))):
            continue

        amt, typ = get_amount(wd, dep)
        if not amt:
            continue
        raw = extract_name(desc, bank)
        if raw is None:
            name, status, raw = desc, "NO_REGEX", desc
        else:
            full_raw = raw
            raw = strip_holder(raw, holder, layout.get("holder_in_desc", False))  # remove account-holder name
            name, mapped = correct_name(raw, code)
            if not mapped and raw != full_raw:   # old mappings (with holder name) still work
                name, mapped = correct_name(full_raw, code)
                if not mapped:
                    name = raw
            status = "OK" if mapped else "UNMAPPED"

        rows.append({
            "Account": code, "Bank": bank, "Name": name, "Raw Name": raw,
            "Amount": amt, "Short": short_amount(amt), "Type": typ,
            "Status": status,
        })
    return rows
