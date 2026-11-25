"""
Account ordering for the combined Send / Received list.
Account codes come from config/account_codes.py (holder name -> code).
Any account codes not in this list will appear at the end.
"""
ACCOUNT_ORDER = ["SS", "SN", "RE", "ACE", "SSH", "ASQ", "JC"]

# Minimum characters of the holder name that must match at the end of a party name
HOLDER_MIN_MATCH = 5
