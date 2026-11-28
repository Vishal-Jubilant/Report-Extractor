"""
Bank-wise regex. There are two per-bank dicts:

1) ROW_START      : Identifies which rows to pick as transaction rows (DESCRIPTION column check)
   ROW_REF_START  : Chq/Ref No column check - for inward rows like RTGSINW / NEFTINW
   -> If Description matches OR Ref no matches, the row is selected. Otherwise, it is skipped.

2) BANK_PATTERNS  : Regex list to extract NAME after a row is selected.
   * Each regex must have one capture group ( ... ) = NAME
   * Order is important: top entries are tried first, stopping immediately on match
   * Text format is determined by bank_layouts.py "join" setting:
        ICICI -> lines joined with "" ( "INF/NEFT/IN42630057499042/RATN0000182/81104049/SIVARAMANSUDHAKAR/..." )
        others -> lines joined with " "
   * If a row is selected but no regex matches -> the app displays a red "NO_REGEX" box.
"""

# Transaction type start:  RTGS/  RTGS-  RTGS:  RTGSINW...   NEFT/  NEFT-  NEFT:  NEFTINW...   IFT-   INF/
_TXN = r"\(?\s*(?:RTGS|NEFT|IFT|INF)(?:INW|\s*[/:-])"
# Middle of description: ONLY RTGS or NEFT (NOT IFT or INF)
_MID_TXN = r"(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?(?![A-Z])"


def _row_start(extra: str = "") -> str:
    """Match allowed transaction starts OR RTGS/NEFT appearing anywhere in the description."""
    start = rf"^(?:{_TXN}|{extra})" if extra else rf"^{_TXN}"
    return rf"(?i)(?:{start}|{_MID_TXN})"


ROW_START = {
    # DESCRIPTION column check
    "ICICI": _row_start(r"TRFR\s+FROM|TRF\s*[/-]"),
    "KOTAK": _row_start(r"CASH\s+DEPOSIT|RECD:IMPS/|FUNDS?\s+TRANSFER\s+TO\b"),
    "AXIS":  _row_start(r"TRF\s*[/-]"),
    # IDBI: also matches "BARBR52026102700758657 NAME" (UTR + name)
    "IDBI":  _row_start(r"[A-Z]{4}[A-Z0-9]\d{9,}\s|\d{4,}-[A-Z]{3}-"),
    "IDFC":  _row_start(),
}

# CHQ / REF NO column start check (for banks with ref_col defined in bank_layouts.py)
# Even if absent in Description, rows with RTGSINW-0115... / NEFTINW-1761... in Ref will be picked
ROW_REF_START = {
    "ICICI": r"(?i)^" + _TXN,
    "KOTAK": r"(?i)^" + _TXN,
    "AXIS":  r"(?i)^" + _TXN,
    "IDBI":  r"(?i)^" + _TXN,
    "IDFC":  r"(?i)^" + _TXN,
}

# Reference / UTR token containing at least 4 digits (prevents matching fee narrations like "RTGS CHARGES")
_REF = r"(?=[A-Z0-9]*\d{4,})[A-Z0-9]{6,}"

# Shared RTGS/NEFT patterns when RTGS or NEFT appears in the middle (or start) of description
_MID_RTGS_NEFT_PATTERNS = [
    # ... RTGS-KKBKR...-NAME-... / ... NEFT-IDFB...-NAME-...
    rf"(?i)(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?\s*-\s*{_REF}\s*-\s*([^\s/-][^-]*?)(?:\s*-|$)",
    # ... RTGS-NAME-KKBKR... / ... NEFT-NAME-CMS...
    rf"(?i)(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?\s*-\s*([^\s/-].*?)\s*-\s*{_REF}\b",
    # ... RTGS KKBKR.../NAME  /  ... NEFT/UTR/NAME/... (e.g. BRB:Sent RTGS KKBKR52026112600918891/SRI MAHI AGE)
    rf"(?i)(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?\s*[:/-]?\s*{_REF}\s*/\s*([^\s/][^/]*?)(?:/|$)",
    # ... RTGS KKBKR... NAME / ... NEFT UTR NAME (space-separated UTR + Name)
    rf"(?i)(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?\s*[:/-]?\s*(?=[A-Z0-9]*\d{{8,}})[A-Z0-9]{{10,}}\s+([^\s/][^/]*?)\s*$",
]

BANK_PATTERNS = {
    "ICICI": [
        # RTGS:ICICR5202611 2100740872/UTI BANK LTD/SHANTHI FOOD INDUSTRIES
        r"(?i)(?<![A-Z0-9])RTGS:\s*(?:[^/]+/)+([^/]+?)\s*$",
        # RTGS/ICICR.../SBIN0015825/81090561/LAKSHMIDEVI/LAKSHMIDEVIMOTOR   (last segment = name)
        r"(?i)(?<![A-Z0-9])RTGS/(?:[^/]+/)+([^/]+)$",
        # RTGS-KKBKR22026102325454166-SURGECAPITALSOLUTIONS-9749176601-KKBK0000958
        r"(?i)(?<![A-Z0-9])RTGS-[A-Z]{4}R\d+-(.+?)-?\d{8,}-[A-Z]{4}0\w{6}$",
        r"(?i)(?<![A-Z0-9])RTGS-[A-Z]{4}R\d+-([^\s-]+)",
        # NEFT-IDFB6300M2390441-ALOK INFOTECH--10095642705-IDFB0080133
        r"(?i)(?<![A-Z0-9])NEFT-[A-Z0-9]+-(.+?)-[^-]*-\d{6,}-[A-Z]{4}0\w{6}$",
        # INF/NEFT/IN42630057499042/RATN0000182/81104049/SIVARAMANSUDHAKAR/EMBASSYOFBR
        r"(?i)^INF/NEFT/[^/]+/[^/]+/\d+\s*/\s*([^/]+)",
        # INF/NEFT/IN42630057807402/KKBK0000490/ASKOTAK/ASCENDSOLUTIONS   (without acc no)
        r"(?i)^INF/NEFT/[^/]+/[^/]+/[^/]+/([^/]+)$",
        # INF/INFT/046427238671/81104049/SUDHAKARSIVARAMAN/SS783
        r"(?i)^INF/INFT/\d+/\d+\s*/\s*([^/]+)",
        # INF/INFT/046427412311/PRABHU/PRABHUJAYARAMAN   (without acc no)
        r"(?i)^INF/INFT/\d+/[^/]+/([^/]+)$",
        # INF/INFT/046388699241/SUBRAMANIANS   (direct name after ref)
        r"(?i)^INF/INFT/\d+/([^/]+)$",
        # TRFR FROM: G.G.M PILE FOUNDATION
        r"(?i)^TRFR\s+FROM:?\s*(.+)$",
        # TRF/SATHYAM CREDIT SOLUTIONS /ICI  or  TRF/PRABHU/000545/ICI/27.11.2026
        r"(?i)^TRF\s*/\s*([^/]+)",
        r"(?i)^TRF\s*-\s*([^-]+)",
        # ICICI middle RTGS/NEFT with optional /IFSC/ACCT segments before NAME
        rf"(?i)(?<![A-Z0-9])(?:RTGS|NEFT)(?:INW)?\s*[:/-]?\s*{_REF}\s*/\s*(?:[A-Z]{{4}}0\w{{6}}\s*/\s*)?(?:\d+\s*/\s*)?([^\s/][^/]*?)(?:/|$)",
        *_MID_RTGS_NEFT_PATTERNS,
    ],

    "KOTAK": [
        r"(?i)^Recd:IMPS/\d+/([^/]+)/",
        # RTGS-MR CARE CENTRE PVT L- KKBKR22026102325454123
        r"(?i)^RTGS-\s*(.+?)\s*-\s*[A-Z]{4}R\d{10,}\s*$",
        # NEFT-BRIO TECHNOLOGIES PV- CMS3002644645447
        r"(?i)^NEFT-\s*(.+?)\s*-\s*CMS\d+",
        # IFT-ASCEND SOLUTIONS-FCM-261023PVXIOA
        r"(?i)^IFT-\s*(.+?)\s*-\s*FCM",
        # Cash Deposit by Self at CHENNAI-ASHOK NAGAR
        r"(?i)^(.+?)\s+by Self\b",
        # FUNDS TRANSFER TO FORTUNE ENTERPRISES
        r"(?i)^FUNDS?\s+TRANSFER\s+TO\s*:?\s*(.+?)\s*$",
        # Inward (ref RTGSINW/NEFTINW): UTIBR62026102316729066 UNIQUE MARINE ACE ENTERPR
        r"(?i)^[A-Z0-9]{10,}\s+(.+)$",
        *_MID_RTGS_NEFT_PATTERNS,
    ],

    "AXIS": [
        # RTGS/CNRBR52026112152878569/VINO TH KUMAR S/CANARA BANK//FAST/FAST
        r"(?i)^\(?\s*(?:RTGS|NEFT)\s*/\s*[^/]+/\s*([^/]+?)\s*(?:/|$)",
        # TRF/SIVARAMAN SURESHKUMAR/
        r"(?i)^TRF/([^/]+)",
        *_MID_RTGS_NEFT_PATTERNS,
    ],

    "IDBI": [
        r"(?i)^BARBR\d{17}\s+(.+?)\s*$",
        r"(?i)^CIUBR\d{17}\s+(.+?)\s*$",
        *_MID_RTGS_NEFT_PATTERNS,
    ],

    "IDFC": [
        # RTGS/ IDFBR62026102905078857 JUBILANT CAPITAL/ KKBK0008664   (UTR, name, beneficiary IFSC)
        # r"(?i)^(?:RTGS|NEFT)\s*/\s*[A-Z0-9]{10,}\s*/?\s*(.+?)\s*/\s*[A-Z]{4}0\w{6}\s*$",
        *_MID_RTGS_NEFT_PATTERNS,
    ],

    # "HDFC": [ r"(?i)^...(.+?)..." ],
}

# Cheque / outward return patterns (e.g. "O/W RTN:4521:FUNDS INSUFFICIENT")
RETURN_PATTERNS = [
    r"(?i)^(?:O|I)/W\s*RTN\s*:\s*\d+\s*:\s*(.+?)\s*$",
]
