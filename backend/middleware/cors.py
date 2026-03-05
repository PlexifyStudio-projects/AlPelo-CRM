from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os


def setup_cors_middleware(app: FastAPI):
    allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3001").split(",")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
