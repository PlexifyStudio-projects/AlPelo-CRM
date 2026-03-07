from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os


def setup_cors_middleware(app: FastAPI):
    default_origins = "http://localhost:3001,http://localhost:3000,http://localhost:5173,http://localhost:4173"
    allowed_origins = os.getenv("ALLOWED_ORIGINS", default_origins).split(",")
    allowed_origins = [o.strip() for o in allowed_origins if o.strip()]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
