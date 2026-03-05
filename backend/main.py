from contextlib import asynccontextmanager
from fastapi import FastAPI
from middleware import setup_cors_middleware
from auth import auth_router
from database.connection import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    print("[STARTUP] AlPelo API ready")
    yield
    print("[SHUTDOWN] Stopped")


app = FastAPI(
    title="AlPelo API",
    version="1.0.0",
    lifespan=lifespan
)

setup_cors_middleware(app)

app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])


@app.get("/")
async def root():
    return {"status": "running", "api": "AlPelo CRM"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
