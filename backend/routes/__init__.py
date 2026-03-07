from .create_endpoints import router as create_router
from .search_endpoints import router as search_router
from .update_endpoints import router as update_router
from .delete_endpoints import router as delete_router
from .ai_endpoints import router as ai_router
from .whatsapp_endpoints import router as whatsapp_router

__all__ = [
    "create_router",
    "search_router",
    "update_router",
    "delete_router",
    "ai_router",
    "whatsapp_router",
]
