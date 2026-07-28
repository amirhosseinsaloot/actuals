"""Money / percentage helpers.

All financial math uses :class:`decimal.Decimal`. Values crossing the API
boundary are serialized as strings so no float rounding is ever introduced.
"""

from decimal import ROUND_HALF_UP, Decimal

TWO_PLACES = Decimal("0.01")


def q2(value: Decimal) -> Decimal:
    """Quantize to two decimal places using HALF_UP (standard financial rounding)."""
    return Decimal(value).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def money_str(value: Decimal) -> str:
    """Serialize a money amount as a fixed 2dp string, e.g. ``"15000.00"``."""
    return str(q2(value))


def percent_str(ratio: Decimal | None) -> str | None:
    """Serialize a ratio (e.g. ``0.30``) as a percentage string ``"30.00"``.

    Returns ``None`` when the ratio is undefined (e.g. zero budget).
    """
    if ratio is None:
        return None
    return str(q2(ratio * Decimal("100")))
