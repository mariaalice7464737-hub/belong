"""Cálculo do orçamento.

Toda a configuração (itens, preços de referência, quantos meses) fica em
data/guide.json → "budget". Aqui só tem a matemática, para você mexer à vontade.
"""
from __future__ import annotations

from typing import Any


def _num(value: Any, default: float | None = 0.0) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _routine_item_zar(item: dict[str, Any], state: dict[str, Any]) -> float:
    """Valor mensal em ZAR de um item da rotina."""
    zar = item.get("zar") or 0

    # preço que você pode corrigir no app (ex.: caixa de marmitas)
    if "price_key" in item:
        override = _num(state.get(item["price_key"]), None)
        if override:
            zar = override

    # preço escolhido num select (ex.: plano de internet)
    if "select_key" in item:
        zar = _num(state.get(item["select_key"]), item.get("default", 0))

    factor = item.get("factor", 1)
    # quantidade escolhida num select (ex.: lavagens por mês)
    if "factor_key" in item:
        factor = _num(state.get(item["factor_key"]), item.get("default_factor", 0))

    return float(zar) * float(factor)


def compute_budget(guide: dict[str, Any], state: dict[str, Any]) -> dict[str, Any]:
    cfg = guide["budget"]
    fx = _num(state.get("fx"), 0) or guide["currency"]["default_fx"]
    months = cfg.get("months", 3)

    breakdown = []
    monthly_brl = 0.0

    for item in cfg["routine"]:
        zar = _routine_item_zar(item, state)
        brl = zar * fx
        monthly_brl += brl
        breakdown.append({"label": item["label"], "zar": round(zar, 2), "brl": round(brl, 2)})

    for item in cfg["monthly_brl"]:
        brl = _num(state.get(item["key"]), 0)
        monthly_brl += brl
        breakdown.append({"label": item["label"], "zar": round(brl / fx, 2), "brl": round(brl, 2)})

    one_off_brl = sum(_num(state.get(i["key"]), 0) for i in cfg["one_off_brl"])
    period_brl = monthly_brl * months + one_off_brl

    fixed_items = []
    for item in cfg["fixed"]:
        brl = _num(state.get(item["brl_key"]), 0)
        zar = _num(state.get(item["zar_key"]), 0)
        if brl:
            zar = brl / fx
        elif zar:
            brl = zar * fx
        fixed_items.append({
            "label": item["label"],
            "zar": round(zar, 2) if zar else None,
            "brl": round(brl, 2) if brl else None,
        })
    fixed_brl = sum(i["brl"] or 0 for i in fixed_items)

    total_brl = period_brl + fixed_brl
    return {
        "fx": fx,
        "months": months,
        "breakdown": breakdown,
        "monthly": {"brl": round(monthly_brl, 2), "zar": round(monthly_brl / fx, 2)},
        "one_off": {"brl": round(one_off_brl, 2)},
        "period": {"brl": round(period_brl, 2), "zar": round(period_brl / fx, 2)},
        "fixed": {"brl": round(fixed_brl, 2), "zar": round(fixed_brl / fx, 2), "items": fixed_items},
        "total": {"brl": round(total_brl, 2), "zar": round(total_brl / fx, 2)},
    }
