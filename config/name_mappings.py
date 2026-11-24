"""
Extracted name -> Correct name (the name you want to see in the output).

Left  = Name extracted from PDF (exact text including truncation / spelling / spaces)
Right = Final correct name

Spaces and uppercase do not matter:
  "SIVARAMAN SUDHAKAR" and "SIVARAMANSUDHAKAR" will match identically.

The app will show an "Unmapped names" list - copy and paste from there to add new entries here.
"""

NAME_MAPPINGS = {
    # ---------------- ICICI ----------------
    "SIVARAMANSUDHAKAR": "Sivaraman Sudhakar",
    "SUDHAKARSIVARAMAN": "Sudhakar Sivaraman",
    "SUDHAKARNIRMALA": "SUDHAKAR NIRMALA",
    "G.G.MPILE FOUNDATION": "GGM Pile",
    "LAKSHMIDEVIMOTOR": "Lakshmidevi Motors",
    "SAKTHIPOLYPRODUCTS": "Sakthi poly",
    "PRABHUJAYARAMAN": "Prabhu Jayaram",
    "ALOK INFOTECH": "Alok Infotech",
    "VELMAYILDEVELOPERS": "Velmayil Developers",
    "PARJUNA": "P Arjuna",
    "NEWTHANGAM STEELS": "New Thangam Steel",
    "TRUEKEM": "Truekem",
    "SURGECAPITALSOLU": "SURGE CAPITAL SOLUTIONS",
    "SURGECAPITALSOLUTIONS": "SURGE CAPITAL SOLUTIONS",
    "ASCENDSOLUTION": "ASCEND SOLUTIONS",
    "ASCENDSOLUTIONS": "ASCEND SOLUTIONS",
    "FORTUNEENTERPRISES": "FORTUNE ENTERPRISES",

    # ---------------- KOTAK ----------------
    "MR CARE CENTRE PVT L": "MR CARE CENTRE PVT LTD",
    "SHRI RAMANA MEDICAL": "Shri Ramana Medical",
    "METAL SCOPE INDIA PV": "Metal Scope",
    "BRIO TECHNOLOGIES PV": "Brio Technologies",
    "CARE HEALTH INSURANC": "Care Health",
    "REACH NVY PRIVATE LIMITED ACE ENT": "Reach NVY",
    "R THIYAGARAJAN DHALL MILL": "R Thiyagarajan",
    "NEW THANGAM STEELS ACE EN": "New Thangam Steel",
    "THANGAMTRADERSS A SQUARE": "Thangam Traders",
    "ALOK INFOTECH A SQUARE ENTERPRISE": "Alok Infotech",
    "POPULAR JUBILANT CAPITAL": "Popular",
    "VELMAYIL DEVELOPERS JUBILANT CAPI": "Velmayil Developers",
    "CASH DEPOSIT": "Cash deposit",

    # ---------------- AXIS ----------------
    "SIVARAMAN SURESHKUMAR": "Sivaraman Sureshkumar",

    # ---------------- IDBI ----------------
    "DEEPIKA BUILTECH": "Deepika Builtech",
    "SOLAR CONCEPTS": "Solar Concepts",

    # Add new entries here:
    # "EXTRACTED NAME": "CORRECT NAME",
}

