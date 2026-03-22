from .create_endpoints import router as create_router
from .search_endpoints import router as search_router
from .update_endpoints import router as update_router
from .delete_endpoints import router as delete_router
from .ai_endpoints import router as ai_router
from .whatsapp_endpoints import router as whatsapp_router
from .dev_endpoints import router as dev_router
from .finance_endpoints import router as finance_router
from .content_studio import router as content_studio_router
from .automation_endpoints import router as automation_router
from .template_endpoints import router as template_router
from .lina_endpoints import router as lina_router
from .staff_endpoints import router as staff_router
from .settings_endpoints import router as settings_router
from .campaign_endpoints import router as campaign_router
from .schedule_endpoints import router as schedule_router

__all__ = [
    "create_router",
    "search_router",
    "update_router",
    "delete_router",
    "ai_router",
    "whatsapp_router",
    "dev_router",
    "finance_router",
    "content_studio_router",
    "automation_router",
    "template_router",
    "lina_router",
    "staff_router",
    "settings_router",
    "campaign_router",
    "schedule_router",
]
