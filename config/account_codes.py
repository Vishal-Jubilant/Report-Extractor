"""
Account holder name  ->  Account code     (MANUAL - add / edit here)

The account code (SS, SN, RE, ASQ ...) is NOT taken from the PDF file name any more.
The app reads the ACCOUNT HOLDER NAME from inside the PDF and looks it up here.

Left  = Account holder name exactly as printed in the statement
        (spaces / upper-lower case do not matter)
Right = Account code shown in the Send / Received list

If a holder name is not found here, the app shows a warning with the exact line to add.
Order of the codes in the output list is controlled by config/accounts.py (ACCOUNT_ORDER).
"""

HOLDER_TO_CODE = {
    "SUDHAKAR S": "SS",
    "NIRMALA S": "SN",
    "ROHIT ENTERPRISES": "RE",
    "JUBILANT CAPITAL": "JC",
    "A SQUARE ENTERPRISES": "ASQ",
    "ACE ENTERPRISES": "ACE",

    # Add new accounts here:
    # "HOLDER NAME": "CODE",
}
