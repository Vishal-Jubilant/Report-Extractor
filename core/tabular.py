"""
CSV / Excel (.csv .xlsx .xls) statement reader.

Same pipeline as PDF:  bank detect -> holder name -> transaction rows -> regex -> name mapping.
Only the "reading" part is different (rows come from sheet cells instead of PDF tables).

Column detection is by HEADER NAME (Description / Particulars / Remarks ... , Debit / Withdrawal ... ,
Credit / Deposit ... , Chq / Ref No ...), so the same code works for any bank's Excel export.
"""
import csv
import io
import re

from core.formatting import indian_format, to_float

SHEET_EXT = (".csv", ".xlsx", ".xls", ".xlsm")

_DESC = ("description", "particulars", "transaction remarks", "narration", "remarks")
_DEBIT = ("debit", "withdrawal")
_CREDIT = ("credit", "deposit")
_REF = ("chq", "cheque", "ref")


def is_sheet(file_or_name) -> bool:
    name = getattr(file_or_name, "name", file_or_name)
    return isinstance(name, str) and name.lower().endswith(SHEET_EXT)


def _read_bytes(f) -> bytes:
    if isinstance(f, (str, bytes)) and not isinstance(f, bytes):
        with open(f, "rb") as fh:
            return fh.read()
    f.seek(0)
    data = f.read()
    f.seek(0)
    return data


def load_grid(f) -> list:
    """Returns the sheet as a list of rows, every cell a stripped string ('' if empty)."""
    name = (getattr(f, "name", f) or "").lower()
    data = _read_bytes(f)
    if name.endswith(".csv"):
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("latin-1")
        grid = list(csv.reader(io.StringIO(text)))
    else:
        import pandas as pd
        try:
            df = pd.read_excel(io.BytesIO(data), header=None, dtype=str)
        except ImportError as e:                      # e.g. .xls without xlrd
            raise RuntimeError(
                "This Excel format needs an extra package (pip install openpyxl xlrd). "
                "Or save the file as .xlsx / .csv.") from e
        grid = df.fillna("").values.tolist()
    return [[str(c).strip() for c in row] for row in grid]


def sheet_text(grid) -> str:
    """Whole sheet as text: cells of a row joined with ' | ', rows with newline."""
    return "\n".join(" | ".join(c for c in row if c) for row in grid)


def holder_from_sheet(grid, layout: dict) -> str:
    text = sheet_text(grid[:40])
    pat = layout.get("holder_sheet_re")
    if pat:
        m = re.search(pat, text)
        if m:
            return re.sub(r"\s+", " ", m.group(1)).strip()
    # generic: a label cell followed by the name  ("Customer Name | JUBILANT CAPITAL")
    for row in grid[:40]:
        for i, c in enumerate(row):
            if re.fullmatch(r"(?i)(customer|account\s+holder|account)?\s*name\s*:?", c.strip()):
                for nxt in row[i + 1:]:
                    nxt = nxt.strip(" :")
                    if nxt:
                        return nxt
    return ""


def _find_header(grid):
    """Returns (row_index, {desc, ref, dr, cr} column indexes) or None."""
    for ri, row in enumerate(grid):
        low = [c.lower() for c in row]
        def col(keys, exclude=()):
            for ci, c in enumerate(low):
                if c and any(c.startswith(k) for k in keys) and not any(c.startswith(x) for x in exclude):
                    return ci
            return None
        desc = col(_DESC)
        dr = col(_DEBIT)
        cr = col(_CREDIT)
        if desc is not None and dr is not None and cr is not None:
            return ri, {"desc": desc, "ref": col(_REF), "dr": dr, "cr": cr}
    return None


def _norm_amount(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    if re.fullmatch(r"\d+(\.\d+)?", s):               # plain number from Excel -> Indian format
        return indian_format(float(s))
    return s


def rows_from_grid(grid):
    """Yields (description, ref, debit, credit) for every transaction row of the sheet."""
    found = _find_header(grid)
    if not found:
        return
    start, cols = found
    for row in grid[start + 1:]:
        def cell(i):
            return row[i] if i is not None and i < len(row) else ""
        desc = re.sub(r"\s+", " ", cell(cols["desc"])).strip()
        if not desc:
            continue
        yield desc, cell(cols["ref"]), _norm_amount(cell(cols["dr"])), _norm_amount(cell(cols["cr"]))
