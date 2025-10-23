# Tech Stack

This is the **DEFINITIVE** technology selection for the entire project. All development must use these exact technologies and versions. This table serves as the single source of truth across firmware, backend, and frontend development.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|-----------|---------|---------|-----------|
| **Frontend Language** | TypeScript | 5.x | Type-safe web UI development | Provides compile-time type checking, better IDE support, and reduces runtime errors compared to vanilla JavaScript |
| **Frontend Framework** | React | 18+ | Component-based UI library | Industry standard for SPA development, large ecosystem, excellent community support, suitable for map-based dashboards |
| **Frontend Build Tool** | Vite | 5.x | Development server and bundler | Faster than Webpack/CRA, excellent HMR, optimized production builds, first-class TypeScript support |
| **UI Component Library** | Headless UI + Custom | Latest | Accessible UI primitives | Lightweight, unstyled components for accessibility (WCAG AA), pairs well with Tailwind for custom styling |
| **CSS Framework** | Tailwind CSS | 3.x | Utility-first styling | Rapid prototyping, consistent design system, small production bundle with purging, great for agricultural aesthetic |
| **State Management** | React Context API | (Built-in) | Global state for auth/config | Sufficient for POC scope, avoids Redux complexity, can upgrade to Zustand if state grows complex |
| **Mapping Library** | Leaflet.js | 1.9.x | Interactive maps | Open-source (no API keys), lightweight, excellent bunker location visualization, integrates well with React |
| **HTTP Client** | Axios | 1.x | API communication | Better error handling than fetch, request/response interceptors for auth tokens, TypeScript support |
| **Backend Language** | Python | 3.10+ | Server-side API and business logic | Excellent async support, mature ecosystem, FastAPI's auto-documentation, team familiarity |
| **Backend Framework** | FastAPI | 0.104+ | REST API server | Automatic OpenAPI docs, built-in validation with Pydantic, async support, high performance for I/O-bound tasks |
| **ASGI Server** | Uvicorn | 0.24+ | Production ASGI server | High-performance async server, works with FastAPI, supports HTTP/1.1 and WebSockets (future use) |
| **API Style** | REST | - | Client-server communication | Simple, well-understood, good for ESP32 HTTP client, auto-documented by FastAPI, adequate for POC scope |
| **Database** | PostgreSQL | 14+ | Persistent data storage | Reliable ACID compliance, JSON support for flexible schemas, installed on same droplet as FastAPI for simplicity |
| **ORM** | SQLAlchemy | 2.0+ | Database abstraction layer | Industry standard Python ORM, async support, migration tools (Alembic), repository pattern support |
| **Data Validation** | Pydantic | 2.x | Request/response schemas | Type-safe data validation, auto-generates OpenAPI schemas, excellent FastAPI integration |
| **Password Hashing** | bcrypt (via passlib) | Latest | Secure password storage | Industry standard for password hashing, resistant to brute force, integrates with FastAPI security utilities |
| **Cache** | None (POC) | - | (Future: Redis) | POC operates in real-time without caching; Redis can be added later for weather API response caching |
| **File Storage** | Local Filesystem | - | Static React build hosting | Nginx serves React build from local directory; no S3/object storage needed for POC |
| **Authentication** | Custom Token Auth + Password | - | Device and user authentication | UUID tokens for ESP32 devices, password-based login for web UI operators, bcrypt hashed passwords in PostgreSQL |
| **Frontend Testing** | Manual | - | UI validation | POC scope prioritizes working features; automated tests can be added post-POC if needed |
| **Backend Testing** | pytest | 7.x+ | Python unit/integration tests | Standard Python testing framework, async support, excellent FastAPI integration |
| **E2E Testing** | Manual | - | End-to-end workflow validation | Manual testing of ESP32-server-UI flows adequate for POC demonstrator |
| **Firmware Language** | C/C++ | C11/C++17 | ESP32 embedded development | Required by ESP-IDF framework, low-level hardware control, efficient memory usage |
| **Firmware Framework** | ESP-IDF | 5.x | ESP32 development framework | Official Espressif framework, HTTPS/TLS support, WiFi provisioning, NVS storage, watchdog APIs |
| **Firmware Build** | CMake + idf.py | - | ESP32 build system | Standard ESP-IDF build toolchain, cross-compilation for Xtensa architecture |
| **IaC Tool** | None (Manual) | - | Infrastructure as code | POC uses manual DigitalOcean droplet setup; Terraform/Ansible can be added for production |
| **CI/CD** | None (Manual) | - | Continuous integration | Manual git deployment for POC; GitHub Actions can automate in production |
| **Reverse Proxy** | Nginx | 1.22+ | HTTPS termination, static hosting | Industry standard, Let's Encrypt integration, serves React SPA and proxies /api/* to FastAPI |
| **SSL/TLS** | Let's Encrypt | - | HTTPS certificate | Free, automated renewal via certbot, trusted by browsers and ESP32 root CA bundle |
| **Monitoring** | Logging Only (POC) | - | System observability | Python logging module + ESP-IDF logs for POC; production can add Prometheus/Grafana |
| **Logging** | Python logging + ESP_LOG | - | Application logs | Built-in frameworks sufficient for POC; logs to file + stdout on server, serial on ESP32 |
