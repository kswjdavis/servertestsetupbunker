from fastapi import FastAPI


app = FastAPI(title="Bunkercolab API")


@app.get("/healthz", tags=["health"])
def health_check() -> dict[str, str]:
    """Basic health check endpoint for scaffolding validation."""
    return {"status": "ok"}
