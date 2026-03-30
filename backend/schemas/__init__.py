# Re-export all schemas for backward compatibility
# Usage: from schemas import StaffCreate, ClientResponse, etc.
# Or: from schemas.staff import StaffCreate (new preferred style)

from .auth import *      # noqa
from .staff import *     # noqa
from .client import *    # noqa
from .service import *   # noqa
from .appointment import *  # noqa
from .dashboard import *    # noqa
from .finance import *      # noqa
from .ai import *           # noqa
from .whatsapp import *     # noqa
from .campaign import *     # noqa
