import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from application.backend.app.core.config import settings
from application.backend.app.core.database import engine, Base, sync_db_schema
from application.backend.app.core.limiter import limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from application.backend.app.models import *
from application.backend.app.api.v1 import (
    auth, guards, sites, shifts, attendance, overtime, payroll, payslips, payments, guard_portal, reports, audit, settings as sys_settings, archive, incidents, leave, statutory, roster, regions, off_days
)

# Ensure database tables exist and schema columns are synchronized
Base.metadata.create_all(bind=engine)
sync_db_schema()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Set up CORS
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API Routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(regions.router, prefix=settings.API_V1_STR)
app.include_router(guards.router, prefix=settings.API_V1_STR)
app.include_router(sites.router, prefix=settings.API_V1_STR)
app.include_router(shifts.router, prefix=settings.API_V1_STR)
app.include_router(roster.router, prefix=settings.API_V1_STR)
app.include_router(off_days.router, prefix=settings.API_V1_STR)
app.include_router(attendance.router, prefix=settings.API_V1_STR)
app.include_router(overtime.router, prefix=settings.API_V1_STR)
app.include_router(payroll.router, prefix=settings.API_V1_STR)
app.include_router(payslips.router, prefix=settings.API_V1_STR)
app.include_router(payments.router, prefix=settings.API_V1_STR)
app.include_router(guard_portal.router, prefix=settings.API_V1_STR)
app.include_router(reports.router, prefix=settings.API_V1_STR)
app.include_router(audit.router, prefix=settings.API_V1_STR)
app.include_router(sys_settings.router, prefix=settings.API_V1_STR)
app.include_router(archive.router, prefix=settings.API_V1_STR)
app.include_router(incidents.router, prefix=settings.API_V1_STR)
app.include_router(leave.router, prefix=settings.API_V1_STR)
app.include_router(statutory.router, prefix=settings.API_V1_STR)

# Serve Static Assets & SPA index.html
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
static_dir = os.path.join(frontend_dir, "static")

if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
def read_root():
    index_file = os.path.join(frontend_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
    }


@app.get("/portal")
def read_guard_portal():
    portal_file = os.path.join(frontend_dir, "portal.html")
    if os.path.exists(portal_file):
        return FileResponse(portal_file)
    return {
        "system": "CorpSec Guard Portal",
        "version": settings.VERSION,
        "status": "online",
        "portal_url": "/portal",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
    }
