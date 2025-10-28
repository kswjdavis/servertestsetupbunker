# Security Hardening Checklist

- [x] Password hashing uses bcrypt via `server.backup/app/repositories/user_repository.py`.
- [x] JWT signing enforces strong secrets (>= 32 chars) in `server.backup/app/core/config.py`.
- [x] HTTPS redirection configured in `config/nginx.conf`.
- [x] CORS restricted to explicit origins, methods, and headers in `server.backup/app/main.py`.
- [x] Database access relies on SQLAlchemy ORM queries without raw SQL.
- [x] React UI avoids `dangerouslySetInnerHTML` usage (`rg` search confirmed none).
- [x] Login endpoint limited to 5 attempts/minute via `server.backup/app/core/rate_limiter.py`.
- [x] Logs avoid sensitive values; firmware token logging sanitized in `firmware/main`.
- [x] Security decisions recorded in story documentation (Story 5.6).
