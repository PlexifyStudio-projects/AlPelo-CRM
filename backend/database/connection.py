from sqlalchemy import create_engine, text, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import time
from dotenv import load_dotenv

load_dotenv()

metadata = MetaData(schema='public')
Base = declarative_base(metadata=metadata)

DATABASE_URL = os.getenv("DATABASE_URL")


def wait_for_db(retries=5, delay=5):
    for attempt in range(retries):
        try:
            engine = create_engine(
                DATABASE_URL,
                echo=False,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                connect_args={
                    "options": "-c search_path=public",
                    "connect_timeout": 60,
                    "application_name": "AlPelo-CRM",
                    "client_encoding": "utf8",
                    "keepalives": 1,
                    "keepalives_idle": 30
                }
            )

            with engine.connect() as conn:
                conn.execute(text("SET client_encoding TO 'UTF8'"))
                conn.execute(text("SET search_path TO public"))
                conn.execute(text("SET timezone TO 'UTC'"))

                result = conn.execute(text("SELECT current_database(), current_schema, current_timestamp;"))
                db_info = result.fetchone()

                return engine

        except Exception as e:
            if attempt < retries - 1:
                time.sleep(delay)
            else:
                raise e


engine = wait_for_db()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
