from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings

app = FastAPI(title="Bunkercolab API")

# Configure CORS based on environment
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(api_router)


@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    """Basic health check endpoint for scaffolding validation."""
    return {"status": "ok"}
