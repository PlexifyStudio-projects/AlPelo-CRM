# Proxy — real module moved to services/intelligence/client.py
from services.intelligence.client import *  # noqa
from services.intelligence.client import (
    calculate_visit_cycle, calculate_risk_score, calculate_noshow_risk,
    forecast_revenue, get_reconnect_candidates,
)
