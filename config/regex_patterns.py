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

# Transaction type start:  RTGS/  RTGS-  RTGSINW...   NEFT/  NEFT-  NEFTINW...   IFT-   INF/
_TXN = r"(?:RTGS|NEFT|IFT|INF)(?:INW|\s*[/-])"

ROW_START = {
    # DESCRIPTION column start check
    "ICICI": r"(?i)^(?:" + _TXN + r"|TRFR\s+FROM)",
    "KOTAK": r"(?i)^(?:" + _TXN + r"|CASH\s+DEPOSIT|RECD:IMPS/)",
    "AXIS":  r"(?i)^(?:" + _TXN + r"|TRF\s*[/-])",
    # IDBI: also matches "BARBR52026102700758657 NAME" (UTR + name)
    "IDBI":  r"(?i)^(?:" + _TXN + r"|[A-Z]{4}[A-Z0-9]\d{9,}\s|\d{4,}-[A-Z]{3}-)",
    "IDFC":  r"(?i)^" + _TXN,
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

BANK_PATTERNS = {
    "ICICI": [
        # RTGS/ICICR.../SBIN0015825/81090561/LAKSHMIDEVI/LAKSHMIDEVIMOTOR   (last segment = name)
        r"(?i)^RTGS/(?:[^/]+/)+([^/]+)$",
        # RTGS-KKBKR22026102325454166-SURGECAPITALSOLUTIONS-9749176601-KKBK0000958
        r"(?i)^RTGS-[A-Z]{4}R\d+-(.+?)-?\d{8,}-[A-Z]{4}0\w{6}$",
        r"(?i)^RTGS-[A-Z]{4}R\d+-([^\s-]+)",
        # NEFT-IDFB6300M2390441-ALOK INFOTECH--10095642705-IDFB0080133
        r"(?i)^NEFT-[A-Z0-9]+-(.+?)-[^-]*-\d{6,}-[A-Z]{4}0\w{6}$",

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
        # Inward (ref RTGSINW/NEFTINW): UTIBR62026102316729066 UNIQUE MARINE ACE ENTERPR
        r"(?i)^[A-Z0-9]{10,}\s+(.+)$",
    ],

    "AXIS": [
        # TRF/SIVARAMAN SURESHKUMAR/
        r"(?i)^TRF/([^/]+)",
    ],

    "IDBI": [
        r"(?i)^BARBR\d{17}\s+(.+?)\s*$",
        r"(?i)^CIUBR\d{17}\s+(.+?)\s*$",
    ],

    "IDFC": [
        # RTGS/ IDFBR62026102905078857 JUBILANT CAPITAL/ KKBK0008664   (UTR, name, beneficiary IFSC)
        # r"(?i)^(?:RTGS|NEFT)\s*/\s*[A-Z0-9]{10,}\s*/?\s*(.+?)\s*/\s*[A-Z]{4}0\w{6}\s*$",
    ],

    # "HDFC": [ r"(?i)^...(.+?)..." ],
}
