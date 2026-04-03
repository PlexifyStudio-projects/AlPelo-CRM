def run_migrations(engine):
    """Add columns that create_all doesn't handle (new columns on existing tables)."""
    from sqlalchemy import text

    migrations = [
        ("whatsapp_message", "media_url", "TEXT"),
        ("whatsapp_message", "media_mime_type", "VARCHAR"),
        ("whatsapp_conversation", "tags", "JSON DEFAULT '[]'"),
        ("whatsapp_conversation", "wa_profile_photo_url", "TEXT"),
        ("staff", "color", "VARCHAR"),
        ("admin", "tenant_id", "INTEGER"),
        # Tenant columns (may be missing if table was created before model updates)
        ("tenant", "owner_email", "VARCHAR(200)"),
        ("tenant", "wa_phone_number_id", "VARCHAR(50)"),
        ("tenant", "wa_business_account_id", "VARCHAR(50)"),
        ("tenant", "wa_access_token", "TEXT"),
        ("tenant", "wa_webhook_token", "VARCHAR(100)"),
        ("tenant", "wa_phone_display", "VARCHAR(20)"),
        ("tenant", "ai_personality", "TEXT"),
        ("tenant", "ai_model", "VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-20250514'"),
        ("tenant", "address", "TEXT"),
        ("tenant", "updated_at", "TIMESTAMP DEFAULT NOW()"),
        # Finance module
        ("visit_history", "payment_method", "VARCHAR"),
        ("visit_history", "is_invoiced", "BOOLEAN DEFAULT false"),
        # Expense detail fields
        ("expense", "subcategory", "VARCHAR"),
        ("expense", "vendor", "VARCHAR"),
        ("expense", "is_recurring", "BOOLEAN DEFAULT false"),
        ("expense", "recurring_frequency", "VARCHAR"),
        # Invoice item → visit link
        ("invoice_item", "visit_id", "INTEGER"),
        # Multi-tenant isolation
        ("client", "tenant_id", "INTEGER"),
        ("whatsapp_conversation", "tenant_id", "INTEGER"),
        # Multi-tenant: all remaining tables
        ("staff", "tenant_id", "INTEGER"),
        ("service", "tenant_id", "INTEGER"),
        ("appointment", "tenant_id", "INTEGER"),
        ("visit_history", "tenant_id", "INTEGER"),
        ("client_note", "tenant_id", "INTEGER"),
        ("expense", "tenant_id", "INTEGER"),
        ("invoice", "tenant_id", "INTEGER"),
        ("invoice_item", "tenant_id", "INTEGER"),
        ("staff_commission", "tenant_id", "INTEGER"),
        ("ai_config", "tenant_id", "INTEGER"),
        ("lina_learning", "tenant_id", "INTEGER"),
        # Staff login credentials
        ("staff", "username", "VARCHAR"),
        ("staff", "password", "VARCHAR"),
        # Single-device session
        ("admin", "active_session_token", "TEXT"),
        ("admin", "session_started_at", "TIMESTAMP"),
        ("staff", "active_session_token", "TEXT"),
        ("staff", "session_started_at", "TIMESTAMP"),
        # Meta OAuth token expiry
        ("tenant", "wa_token_expires_at", "TIMESTAMP"),
        # Billing: service paid until date
        ("tenant", "paid_until", "DATE"),
        # Google Reviews
        ("tenant", "google_review_url", "VARCHAR(500)"),
        # Google Reviews
        ("tenant", "google_review_url", "VARCHAR(500)"),
        # Sentiment Analysis
        ("whatsapp_message", "sentiment", "VARCHAR(20)"),
        ("whatsapp_message", "sentiment_score", "FLOAT"),
        ("whatsapp_conversation", "last_sentiment", "VARCHAR(20)"),
        # White-label Branding
        ("tenant", "logo_url", "TEXT"),
        ("tenant", "brand_color", "VARCHAR(20)"),
        ("tenant", "brand_color_dark", "VARCHAR(20)"),
        ("tenant", "brand_color_accent", "VARCHAR(20)"),
        ("tenant", "brand_name", "VARCHAR(200)"),
        # Multi-location
        ("staff", "primary_location_id", "INTEGER"),
        ("appointment", "location_id", "INTEGER"),
        ("visit_history", "location_id", "INTEGER"),
        ("whatsapp_conversation", "location_id", "INTEGER"),
        ("expense", "location_id", "INTEGER"),
        ("staff_schedule", "location_id", "INTEGER"),
        ("staff_day_off", "location_id", "INTEGER"),
        ("checkout", "location_id", "INTEGER"),
        ("cash_register", "location_id", "INTEGER"),
        ("products", "location_id", "INTEGER"),
        ("inventory_movements", "location_id", "INTEGER"),
        # Plan limits stored per tenant
        ("tenant", "max_automations", "INTEGER NOT NULL DEFAULT 10"),
        # Service type: cita, paquete, reserva
        ("service", "service_type", "VARCHAR(20) NOT NULL DEFAULT 'cita'"),
        # Public Booking Page
        ("tenant", "booking_enabled", "BOOLEAN DEFAULT FALSE"),
        ("tenant", "booking_tagline", "VARCHAR(300)"),
        ("tenant", "booking_description", "TEXT"),
        ("tenant", "gallery_images", "JSON DEFAULT '[]'"),
        # Booking Page — Extended fields
        ("tenant", "booking_cover_url", "TEXT"),
        ("tenant", "booking_phone", "VARCHAR(30)"),
        ("tenant", "booking_whatsapp", "VARCHAR(30)"),
        ("tenant", "booking_instagram", "VARCHAR(500)"),
        ("tenant", "booking_facebook", "VARCHAR(500)"),
        ("tenant", "booking_tags", "JSON DEFAULT '[]'"),
        ("tenant", "booking_schedule", "JSON DEFAULT '[]'"),
        ("tenant", "google_place_id", "VARCHAR(300)"),
        ("tenant", "booking_google_rating", "FLOAT"),
        ("tenant", "booking_google_total_reviews", "INTEGER"),
        ("tenant", "booking_google_reviews", "JSON DEFAULT '[]'"),
        # Staff photo
        ("staff", "photo_url", "TEXT"),
        # Service AI mode
        ("service", "ai_mode", "VARCHAR(10) DEFAULT 'auto'"),
        # Nómina v2: link appointments/visits to payments
        ("appointment", "staff_payment_id", "INTEGER REFERENCES staff_payment(id)"),
        ("visit_history", "payment_id", "INTEGER REFERENCES staff_payment(id)"),
        # Nómina v2: receipt number for payment receipts
        ("staff_payment", "receipt_number", "VARCHAR(20)"),
        # Staff bank info for payroll
        ("staff", "document_type", "VARCHAR(5)"),
        ("staff", "document_number", "VARCHAR(200)"),
        ("staff", "bank_name", "VARCHAR(100)"),
        ("staff", "bank_account_type", "VARCHAR(20)"),
        ("staff", "bank_account_number", "VARCHAR(200)"),
        ("staff", "nequi_phone", "VARCHAR(200)"),
        ("staff", "daviplata_phone", "VARCHAR(200)"),
        ("staff", "preferred_payment_method", "VARCHAR(20)"),
        # Invoice v2: discount, credit terms, fiscal fields
        ("invoice", "discount_type", "VARCHAR(10)"),
        ("invoice", "discount_value", "INTEGER NOT NULL DEFAULT 0"),
        ("invoice", "discount_amount", "INTEGER NOT NULL DEFAULT 0"),
        ("invoice", "payment_terms", "VARCHAR(20) NOT NULL DEFAULT 'contado'"),
        ("invoice", "due_date", "DATE"),
        ("invoice", "client_document_type", "VARCHAR(5)"),
        ("invoice", "client_email", "VARCHAR(200)"),
        ("invoice", "client_address", "TEXT"),
        # Campaign template media header
        ("message_template", "header_type", "VARCHAR(10)"),
        ("message_template", "header_media_url", "TEXT"),
        ("message_template", "header_text", "VARCHAR(200)"),
        # Tenant IVA config
        ("tenant", "default_tax_rate", "FLOAT NOT NULL DEFAULT 0"),
    ]

    for table, column, col_type in migrations:
        try:
            with engine.begin() as conn:
                result = conn.execute(text(
                    f"SELECT column_name FROM information_schema.columns "
                    f"WHERE table_schema='public' AND table_name='{table}' AND column_name='{column}'"
                ))
                if result.fetchone() is None:
                    conn.execute(text(
                        f"ALTER TABLE public.{table} ADD COLUMN {column} {col_type}"
                    ))
                    print(f"[MIGRATION] Added {table}.{column}")
        except Exception as e:
            print(f"[MIGRATION] Error on {table}.{column}: {e}")

    # --- platform_config table (global key-value settings) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='platform_config'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.platform_config (
                        id SERIAL PRIMARY KEY,
                        key VARCHAR(100) UNIQUE NOT NULL,
                        value TEXT,
                        is_secret BOOLEAN DEFAULT FALSE,
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE UNIQUE INDEX idx_platform_config_key ON public.platform_config(key)"))
                print("[MIGRATION] Created platform_config table")
    except Exception as e:
        print(f"[MIGRATION] platform_config table: {e}")

    # --- client_memory table (long-term AI memory with embeddings) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='client_memory'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.client_memory (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        client_id INTEGER NOT NULL REFERENCES public.client(id),
                        memory_type VARCHAR(50) NOT NULL,
                        content TEXT NOT NULL,
                        embedding TEXT,
                        source VARCHAR(50) DEFAULT 'conversation',
                        confidence FLOAT DEFAULT 1.0,
                        is_active BOOLEAN DEFAULT TRUE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_client_memory_client ON public.client_memory(client_id)"))
                conn.execute(text("CREATE INDEX idx_client_memory_tenant ON public.client_memory(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_client_memory_active ON public.client_memory(client_id, is_active)"))
                print("[MIGRATION] Created client_memory table with indexes")
    except Exception as e:
        print(f"[MIGRATION] client_memory table: {e}")

    # --- lina_task table (background bulk task worker) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='lina_task'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.lina_task (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL,
                        task_type VARCHAR(50) NOT NULL,
                        description TEXT NOT NULL,
                        total_items INTEGER NOT NULL DEFAULT 0,
                        completed_items INTEGER NOT NULL DEFAULT 0,
                        status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        payload TEXT NOT NULL,
                        result_log TEXT,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_lina_task_tenant ON public.lina_task(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_lina_task_status ON public.lina_task(status)"))
                print("[MIGRATION] Created lina_task table with indexes")
    except Exception as e:
        print(f"[MIGRATION] lina_task table: {e}")

    # --- campaign table (marketing campaigns) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='campaign'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.campaign (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        name VARCHAR(200) NOT NULL,
                        campaign_type VARCHAR(50),
                        status VARCHAR(30) DEFAULT 'draft',
                        message_body TEXT,
                        meta_template_name VARCHAR(100),
                        meta_template_id VARCHAR(100),
                        meta_status VARCHAR(30),
                        segment_filters JSON DEFAULT '{}',
                        audience_count INTEGER DEFAULT 0,
                        sent_count INTEGER DEFAULT 0,
                        failed_count INTEGER DEFAULT 0,
                        responded_count INTEGER DEFAULT 0,
                        ai_variants JSON,
                        created_by VARCHAR(100),
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_campaign_tenant ON public.campaign(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_campaign_status ON public.campaign(status)"))
                print("[MIGRATION] Created campaign table with indexes")
    except Exception as e:
        print(f"[MIGRATION] campaign table: {e}")

    # --- Staff Payment table ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='staff_payment'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.staff_payment (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL,
                        staff_id INTEGER NOT NULL REFERENCES public.staff(id),
                        amount INTEGER NOT NULL,
                        period_from DATE NOT NULL,
                        period_to DATE NOT NULL,
                        concept VARCHAR(300) NOT NULL,
                        payment_method VARCHAR(30) NOT NULL,
                        reference VARCHAR(200),
                        receipt_url TEXT,
                        commission_total INTEGER NOT NULL DEFAULT 0,
                        tips_total INTEGER NOT NULL DEFAULT 0,
                        product_commissions INTEGER NOT NULL DEFAULT 0,
                        deductions INTEGER NOT NULL DEFAULT 0,
                        notes TEXT,
                        paid_by VARCHAR(100),
                        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) NOT NULL DEFAULT 'paid',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
                conn.execute(text("CREATE INDEX idx_staff_payment_tenant ON public.staff_payment(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_staff_payment_staff ON public.staff_payment(staff_id)"))
                print("[MIGRATION] Created staff_payment table with indexes")
    except Exception as e:
        print(f"[MIGRATION] staff_payment table: {e}")

    # --- Index for tenant isolation on client and conversation tables ---
    try:
        with engine.begin() as conn:
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_client_tenant ON public.client(tenant_id)"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS idx_wa_conv_tenant ON public.whatsapp_conversation(tenant_id)"))
            print("[MIGRATION] Created tenant isolation indexes")
    except Exception as e:
        print(f"[MIGRATION] Tenant indexes: {e}")

    # --- Unique index for staff login username ---
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_username ON public.staff(username) WHERE username IS NOT NULL"
            ))
            print("[MIGRATION] Created unique index on staff.username")
    except Exception as e:
        print(f"[MIGRATION] staff username index: {e}")

    # Fix: ensure ai_model column has a DEFAULT so raw SQL inserts don't fail
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_model SET DEFAULT 'claude-sonnet-4-20250514'"
            ))
    except Exception as e:
        print(f"[MIGRATION] ai_model default: {e}")
    # Also make ai_name nullable or set default (same issue)
    try:
        with engine.begin() as conn:
            conn.execute(text(
                "ALTER TABLE public.tenant ALTER COLUMN ai_name SET DEFAULT 'Lina'"
            ))
    except Exception as e:
        print(f"[MIGRATION] ai_name default: {e}")

    # Switch AI model to Sonnet 4 (available on all billing tiers)
    try:
        with engine.begin() as conn:
            # Fix ai_config table
            r1 = conn.execute(text(
                "UPDATE public.ai_config SET model = 'claude-sonnet-4-20250514' "
                "WHERE model NOT IN ('claude-sonnet-4-20250514')"
            ))
            if r1.rowcount > 0:
                print(f"[MIGRATION] Switched {r1.rowcount} AI config(s) to Sonnet 4")
            # Fix tenant table
            r2 = conn.execute(text(
                "UPDATE public.tenant SET ai_model = 'claude-sonnet-4-20250514' "
                "WHERE ai_model != 'claude-sonnet-4-20250514'"
            ))
            if r2.rowcount > 0:
                print(f"[MIGRATION] Switched {r2.rowcount} tenant(s) to Sonnet 4")
    except Exception as e:
        print(f"[MIGRATION] AI model switch: {e}")

    # --- location table (Multi-Location / Sedes) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='location'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.location (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        name VARCHAR(200) NOT NULL,
                        slug VARCHAR(100) NOT NULL,
                        address TEXT,
                        phone VARCHAR(30),
                        opening_time VARCHAR(5) DEFAULT '08:00',
                        closing_time VARCHAR(5) DEFAULT '19:00',
                        days_open JSON DEFAULT '[0,1,2,3,4,5]',
                        wa_phone_number_id VARCHAR(50),
                        is_active BOOLEAN DEFAULT TRUE,
                        is_default BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_location_tenant ON public.location(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_location_active ON public.location(tenant_id, is_active)"))
                print("[MIGRATION] Created location table")
    except Exception as e:
        print(f"[MIGRATION] location table: {e}")

    # --- staff_location table (Many-to-many staff↔location) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='staff_location'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.staff_location (
                        id SERIAL PRIMARY KEY,
                        staff_id INTEGER NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
                        location_id INTEGER NOT NULL REFERENCES public.location(id) ON DELETE CASCADE,
                        is_primary BOOLEAN DEFAULT FALSE,
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_staff_loc_staff ON public.staff_location(staff_id)"))
                conn.execute(text("CREATE INDEX idx_staff_loc_loc ON public.staff_location(location_id)"))
                conn.execute(text("CREATE UNIQUE INDEX idx_staff_loc_unique ON public.staff_location(staff_id, location_id)"))
                print("[MIGRATION] Created staff_location table")
    except Exception as e:
        print(f"[MIGRATION] staff_location table: {e}")

    # --- automation_rule table (Automation Studio) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='automation_rule'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.automation_rule (
                        id SERIAL PRIMARY KEY,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        name VARCHAR(200) NOT NULL,
                        trigger_type VARCHAR(50) NOT NULL,
                        trigger_config JSON NOT NULL DEFAULT '{}',
                        filter_config JSON NOT NULL DEFAULT '{}',
                        action_type VARCHAR(30) NOT NULL DEFAULT 'send_whatsapp',
                        action_config JSON NOT NULL DEFAULT '{}',
                        chain_config JSON,
                        meta_template_name VARCHAR(100),
                        meta_template_status VARCHAR(20) NOT NULL DEFAULT 'draft',
                        is_enabled BOOLEAN DEFAULT FALSE,
                        cooldown_days INTEGER NOT NULL DEFAULT 1,
                        max_per_day INTEGER NOT NULL DEFAULT 20,
                        eval_hour INTEGER,
                        stats_sent INTEGER DEFAULT 0,
                        stats_responded INTEGER DEFAULT 0,
                        stats_failed INTEGER DEFAULT 0,
                        last_triggered_at TIMESTAMP,
                        created_at TIMESTAMP DEFAULT NOW(),
                        updated_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_automation_rule_tenant ON public.automation_rule(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_automation_rule_enabled ON public.automation_rule(tenant_id, is_enabled)"))
                print("[MIGRATION] Created automation_rule table")
    except Exception as e:
        print(f"[MIGRATION] automation_rule table: {e}")

    # --- automation_execution table (Automation Studio logs) ---
    try:
        with engine.begin() as conn:
            result = conn.execute(text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema='public' AND table_name='automation_execution'"
            ))
            if result.fetchone() is None:
                conn.execute(text("""
                    CREATE TABLE public.automation_execution (
                        id SERIAL PRIMARY KEY,
                        automation_id INTEGER NOT NULL REFERENCES public.automation_rule(id) ON DELETE CASCADE,
                        tenant_id INTEGER NOT NULL REFERENCES public.tenant(id),
                        client_id INTEGER REFERENCES public.client(id),
                        appointment_id INTEGER REFERENCES public.appointment(id),
                        phone VARCHAR NOT NULL,
                        message_sent TEXT NOT NULL,
                        is_chain BOOLEAN DEFAULT FALSE,
                        status VARCHAR(20) DEFAULT 'sent',
                        created_at TIMESTAMP DEFAULT NOW()
                    )
                """))
                conn.execute(text("CREATE INDEX idx_auto_exec_automation ON public.automation_execution(automation_id)"))
                conn.execute(text("CREATE INDEX idx_auto_exec_tenant ON public.automation_execution(tenant_id)"))
                conn.execute(text("CREATE INDEX idx_auto_exec_client ON public.automation_execution(client_id)"))
                conn.execute(text("CREATE INDEX idx_auto_exec_created ON public.automation_execution(created_at DESC)"))
                print("[MIGRATION] Created automation_execution table")
    except Exception as e:
        print(f"[MIGRATION] automation_execution table: {e}")

    # NOTE: Dev users, tenants, and admins are all created from the Developer panel — no seeds.


def ensure_vapid_keys():
    """Auto-generate VAPID keys for Web Push Notifications if they don't exist."""
    from database.connection import SessionLocal
    from database.models import PlatformConfig

    db = SessionLocal()
    try:
        existing_pub = db.query(PlatformConfig).filter(PlatformConfig.key == "VAPID_PUBLIC_KEY").first()
        existing_priv = db.query(PlatformConfig).filter(PlatformConfig.key == "VAPID_PRIVATE_KEY").first()

        # Validate: public key should be ~87 chars base64url, private should be PEM
        pub_ok = existing_pub and existing_pub.value and len(existing_pub.value) > 80 and len(existing_pub.value) < 100
        priv_ok = existing_priv and existing_priv.value and existing_priv.value.strip().startswith("-----BEGIN")

        if pub_ok and priv_ok:
            print(f"[VAPID] Keys OK — public key: {existing_pub.value[:20]}... ({len(existing_pub.value)} chars)")
            return

        # Delete old keys and regenerate
        print("[VAPID] Keys missing or invalid, regenerating...")
        db.query(PlatformConfig).filter(
            PlatformConfig.key.in_(["VAPID_PRIVATE_KEY", "VAPID_PUBLIC_KEY", "VAPID_CONTACT_EMAIL"])
        ).delete(synchronize_session=False)
        db.commit()

        try:
            from cryptography.hazmat.primitives.asymmetric import ec
            from cryptography.hazmat.primitives import serialization
            import base64

            # Generate P-256 key pair (standard for Web Push)
            priv = ec.generate_private_key(ec.SECP256R1())

            # Public key: uncompressed point → base64url no padding (for browser)
            pub_bytes = priv.public_key().public_bytes(
                serialization.Encoding.X962,
                serialization.PublicFormat.UncompressedPoint
            )
            public_key = base64.urlsafe_b64encode(pub_bytes).decode('utf-8').rstrip('=')

            # Private key: PEM PKCS8 (for pywebpush)
            pem_bytes = priv.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption()
            )
            private_key = pem_bytes.decode('utf-8')

            print(f"[VAPID] Generated — public key length: {len(public_key)}, pub_bytes: {len(pub_bytes)}")
        except Exception as e:
            print(f"[VAPID] Could not generate keys: {e}")
            return

        for key, value, secret in [
            ("VAPID_PRIVATE_KEY", private_key, True),
            ("VAPID_PUBLIC_KEY", public_key, False),
            ("VAPID_CONTACT_EMAIL", "mailto:dev@plexifystudio.com", False),
        ]:
            cfg = db.query(PlatformConfig).filter(PlatformConfig.key == key).first()
            if cfg:
                cfg.value = value
                cfg.is_secret = secret
            else:
                db.add(PlatformConfig(key=key, value=value, is_secret=secret))

        db.commit()
        print(f"[VAPID] Keys generated — public key: {public_key[:20]}...")
    except Exception as e:
        print(f"[VAPID] Error: {e}")
    finally:
        db.close()
