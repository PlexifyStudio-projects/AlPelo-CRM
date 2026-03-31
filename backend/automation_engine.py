# Proxy — real module moved to services/automation/engine.py
from services.automation.engine import *  # noqa
from services.automation.engine import (
    run_automations, get_plan_limit, PLAN_LIMITS,
    TRIGGER_EVALUATORS, preview_audience,
)
