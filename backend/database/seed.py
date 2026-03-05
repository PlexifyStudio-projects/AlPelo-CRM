from database.connection import SessionLocal
from database.models import Admin
from auth.security import hash_password


def seed_admin():
    """Create default admin user if none exists."""
    db = SessionLocal()
    try:
        existing = db.query(Admin).first()
        if existing:
            print(f"[SEED] Admin already exists: {existing.username}")
            return

        admin = Admin(
            name="AlPelo Admin",
            email="admin@alpelo.co",
            phone="+57 300 000 0000",
            username="admin",
            password=hash_password("alpelo2026"),
            role="admin",
            is_active=True
        )
        db.add(admin)
        db.commit()
        print("[SEED] Default admin created — username: admin / password: alpelo2026")

    finally:
        db.close()
