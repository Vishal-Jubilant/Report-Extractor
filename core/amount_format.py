"""
Short amount format (Indian system). Only ROUND amounts are shortened, everything else stays as-is.

    1,000       -> 1K          65,000      -> 65K
    1,00,000    -> 1L          1,75,000    -> 1.75L      75,00,000 -> 75L
    1,00,00,000 -> 1C          1,25,00,000 -> 1.25C
    3,66,600    -> 3,66,600    81,87,500   -> 81,87,500   (not round -> full Indian format)

Rules:  K = multiple of 1,000 (below 1 lakh)
        L = multiple of 1,000 (1 lakh and above, below 1 crore)  -> max 2 decimals
        C = multiple of 1,00,000 (1 crore and above)             -> max 2 decimals
        Paise (e.g. 14,108.05) or anything else -> full Indian format
"""
from core.formatting import indian_format, to_float

K, L, C = 1_000, 1_00_000, 1_00_00_000


def _fmt(value: float, unit: int, suffix: str) -> str:
    x = value / unit
    return f"{int(round(x))}{suffix}" if abs(x - round(x)) < 1e-9 else f"{x:.2f}{suffix}"


def short_amount(amount: str) -> str:
    v = to_float(amount)
    if v == int(v):  # no paise
        iv = int(v)
        if iv >= C and iv % L == 0:
            return _fmt(v, C, "C")
        if iv >= L and iv % K == 0:
            return _fmt(v, L, "L")
        if iv >= K and iv % K == 0:
            return _fmt(v, K, "K")
    return indian_format(v)
