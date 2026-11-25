import re


def to_float(amount: str) -> float:
    try:
        return float(re.sub(r"[^\d.]", "", amount or "") or 0)
    except ValueError:
        return 0.0


def indian_format(value: float) -> str:
    """12345678.5 -> 1,23,45,678.50   (drop if .00)"""
    neg = value < 0
    value = abs(value)
    whole, frac = divmod(round(value * 100), 100)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", head)
        s = head + "," + tail
    if frac:
        s += f".{frac:02d}"
    return ("-" if neg else "") + s
