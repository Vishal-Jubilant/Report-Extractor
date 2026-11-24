"""
Bank detection + PDF table column layout.
To add a new bank -> add an entry here, then
add ROW_START + BANK_PATTERNS for the same bank key in config/regex_patterns.py.

detect   : Keyword expected on the PDF's first page (UPPERCASE). Whichever matches first determines the bank.
min_cols : Minimum number of columns required in a table row
desc_col : Description / Remarks / Particulars column index (0-based)
ref_col  : Chq/Ref No column index (or None if not present)
dr_col   : Withdrawal (Dr) column index
cr_col   : Deposit (Cr) column index
holder_re: regex on PDF page-1 text, one capture group = ACCOUNT HOLDER NAME.
           Used for account code (config/account_codes.py) and to strip the holder's name from party names.
holder_in_desc: (optional, default False) True if the bank appends the account holder's name to descriptions (Kotak)
holder_sheet_re: (optional) same, but for CSV / Excel files (sheet rows joined with " | ", rows with newline).
           If not given, a generic "Customer Name | XYZ" label search is used.
join     : How to join wrapped lines in a cell
           ""  -> broken tokens in wrapped lines (ICICI)
           " " -> normal words wrap (Kotak, Axis, IDBI)
"""

BANK_LAYOUTS = {
    "ICICI": {
        "detect": ["ICICI BANK", "ICIC0"],
        "min_cols": 10, "desc_col": 6, "ref_col": 5,
        "dr_col": 7, "cr_col": 8, "join": "",
        # "Name: ROHIT ENTERPRISES A/C Branch: ..."
        "holder_re": r"Name:\s*(.+?)\s+A/C\s+Branch",
    },
    "KOTAK": {
        "detect": ["KOTAK MAHINDRA", "KKBK0"],
        "min_cols": 7, "desc_col": 2, "ref_col": 3,
        "dr_col": 4, "cr_col": 5, "join": " ",
        "holder_in_desc": True,   # Kotak appends the account holder name (truncated) to inward descriptions
        # page-1 text: "27 Oct 2026 - 28 Oct 2026\nA SQUARE ENTERPRISES Account No. 2051457512"
        "holder_re": r"(?s)\d{4}\s*-\s*\d{1,2}\s+\w{3}\s+\d{4}\s+(.+?)\s+Account\s+No",
        # CSV / Excel export:  row 1 "Account Statement", row 2 = holder name
        "holder_sheet_re": r"(?i)Account Statement\s*\n\s*([^|\n]+)",
    },
    "AXIS": {
        "detect": ["AXIS BANK", "UTIB000"],
        "min_cols": 9, "desc_col": 3, "ref_col": 7,
        "dr_col": 4, "cr_col": 5, "join": " ",
        # "Account Statement Report / JUBILANT CAPITAL / Joint Holder :- ..."
        "holder_re": r"Account\s+Statement\s+Report\s+(.+?)\s+Joint\s+Holder",
    },
    "IDBI": {
        "detect": ["IDBI BANK", "IBKL0"],
        "min_cols": 8, "desc_col": 3, "ref_col": 4,
        "dr_col": 5, "cr_col": 6, "join": " ",
        # "Account Holder Name : ACE ENTERPRISES Sol ID/ Branch ID"
        "holder_re": r"Account\s+Holder\s+Name\s*:\s*(.+?)\s+Sol\s+ID",
    },
    "IDFC": {
        "detect": ["IDFC FIRST"],
        "min_cols": 7, "desc_col": 2, "ref_col": 3,
        "dr_col": 4, "cr_col": 5, "join": " ",
        # "CUSTOMER NAME : JUBILANT CAPITAL ACCOUNT BRANCH : Coimbatore Branch"
        "holder_re": r"CUSTOMER\s+NAME\s*:\s*(.+?)\s+ACCOUNT\s+BRANCH",
    },
}
