# Bunker Colab (Grain Bunker Fan Control System) Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for the **Grain Bunker Fan Control System**, including backend systems, frontend implementation, ESP32 embedded firmware, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend, frontend, and embedded architecture documents, streamlining the development process for this modern IoT application where cloud services, web UI, and edge devices are tightly integrated.

**Project Context:**
- **Project Name:** Bunker Colab (Grain Bunker Fan Control System)
- **Team:** 2 developers (Jeff - ESP32 firmware, Will - React UI, Shared - FastAPI backend)
- **Target:** POC/Demonstrator quality system proving wind-based automatic fan control with fail-safe design
- **Deployment:** DigitalOcean cloud infrastructure + distributed ESP32 edge controllers

### Starter Template or Existing Project

**N/A - Greenfield Project**

This is a pure greenfield build using lightweight tooling:
- **Firmware:** ESP-IDF standard project structure (`idf.py create-project`)
- **Backend:** Clean FastAPI application with organized modules
- **Frontend:** Vite + React + TypeScript starter template
- **Monorepo:** Simple directory structure without heavy tooling (no Nx/Turborepo)

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-21 | 0.1 | Initial architecture draft | Winston (Architect) |

---

## High Level Architecture

### Technical Summary

The Bunker Colab system is a **distributed IoT architecture** combining cloud services, web applications, and embedded edge devices to provide intelligent, fail-safe grain bunker fan control. The system uses a **monolithic FastAPI backend** deployed on DigitalOcean that integrates with external weather APIs, manages device registry and authentication, and serves a **React SPA** for operator control. **ESP32 edge controllers** running ESP-IDF firmware maintain local fail-safe logic with dead-man timers, communicating with the cloud via HTTPS REST APIs. The architecture prioritizes **safety-first design** where any communication failure defaults to fans-ON state. Data flows unidirectionally from weather API → server decision engine → ESP32 controllers → relay control, with bidirectional status reporting from devices back to the cloud. PostgreSQL provides persistent storage for device registry, bunker configurations, and operational metrics. The system achieves POC goals through simple, proven technologies rather than complex microservices or cutting-edge frameworks.

### Platform and Infrastructure Choice

**Platform:** DigitalOcean Droplet (Ubuntu 24.04 LTS)

**Key Services:**
- **Compute:** Single droplet (2GB RAM / 1 vCPU for POC, scalable to 4GB if needed)
- **Database:** PostgreSQL 14+ (installed on droplet or separate managed database)
- **Reverse Proxy:** Nginx (HTTPS termination, static file serving, API proxying)
- **SSL:** Let's Encrypt via certbot
- **Process Management:** systemd for FastAPI service

**Deployment Host and Regions:** Single region (recommend NYC3 or SFO3 for US Great Plains proximity)

### Repository Structure

**Structure:** Lightweight Monorepo without Tooling

**Monorepo Tool:** N/A (simple directory structure)

**Package Organization:**
- Each component has independent dependency management (package.json for web, requirements.txt for server, ESP-IDF for firmware)
- No shared packages between web/server - TypeScript types generated from OpenAPI spec
- Version coordination via git tags and semantic versioning

```
Bunkercolab/
├── firmware/           # ESP32 project (independent ESP-IDF build)
├── server/            # FastAPI backend (Python)
├── web/               # React frontend (TypeScript + Vite)
├── docs/              # Documentation (PRD, architecture, API specs)
├── scripts/           # Deployment and utility scripts
└── README.md
```

### High Level Architecture Diagram

```mermaid
graph TB
    subgraph "Operator Interface"
        Browser[Web Browser]
    end

    subgraph "DigitalOcean Cloud"
        Nginx[Nginx Reverse Proxy<br/>HTTPS/SSL Termination]
        FastAPI[FastAPI Server<br/>Control Logic & API]
        DB[(PostgreSQL<br/>Device Registry<br/>Bunker Configs)]
        ReactBuild[React SPA<br/>Static Files]
    end

    subgraph "External Services"
        WeatherAPI[Aviation Weather.gov API<br/>Wind Data]
    end

    subgraph "Edge Devices - Grain Bunker Site"
        ESP1[ESP32 Controller #1<br/>Dead-Man Timer<br/>Relay Control]
        ESP2[ESP32 Controller #2<br/>Dead-Man Timer<br/>Relay Control]
        ESPn[ESP32 Controller #N<br/>Dead-Man Timer<br/>Relay Control]

        Fan1[Fan Relay<br/>Normally Closed]
        Fan2[Fan Relay<br/>Normally Closed]
        Fann[Fan Relay<br/>Normally Closed]

        Watchdog1[Hardware Watchdog]
        Watchdog2[Hardware Watchdog]
        Watchdogn[Hardware Watchdog]
    end

    Browser -->|HTTPS| Nginx
    Nginx -->|/api/*| FastAPI
    Nginx -->|/ static| ReactBuild
    FastAPI -->|Queries| DB
    FastAPI -->|Poll every 60s| WeatherAPI

    ESP1 -.->|HTTPS REST<br/>60s keepalive| FastAPI
    ESP2 -.->|HTTPS REST<br/>60s keepalive| FastAPI
    ESPn -.->|HTTPS REST<br/>60s keepalive| FastAPI

    ESP1 -->|GPIO Control| Fan1
    ESP2 -->|GPIO Control| Fan2
    ESPn -->|GPIO Control| Fann

    ESP1 -->|Heartbeat| Watchdog1
    ESP2 -->|Heartbeat| Watchdog2
    ESPn -->|Heartbeat| Watchdogn

    Watchdog1 -.->|Resets if hang| ESP1
    Watchdog2 -.->|Resets if hang| ESP2
    Watchdogn -.->|Resets if hang| ESPn

    style FastAPI fill:#4A90E2
    style ReactBuild fill:#61DAFB
    style DB fill:#336791
    style ESP1 fill:#E7352C
    style ESP2 fill:#E7352C
    style ESPn fill:#E7352C
    style WeatherAPI fill:#90EE90
```

### Architectural Patterns

- **Dead-Man Switch Pattern:** Server must actively broadcast "shutdown allowed" every 60 seconds; ESP32 devices maintain 5-minute countdown timers and default to fans-ON if timer expires - _Rationale:_ Ensures fail-safe operation where any communication failure results in safest state (fans running to maintain tarp vacuum)

- **Edge Intelligence with Centralized Decision:** ESP32 controllers execute local safety logic (timer management, relay control, watchdog) while server makes centralized wind-based decisions - _Rationale:_ Balances reliability (edge devices operate independently) with consistent policy enforcement (single source of truth for wind thresholds)

- **Monolithic Backend with SPA Frontend:** Single FastAPI application serves both REST API and static React build via Nginx - _Rationale:_ POC scope doesn't justify microservices complexity; monolith simplifies deployment, reduces infrastructure costs, and allows rapid iteration

- **Polling-Based Real-Time Updates:** Web UI polls server every 2-5 seconds for status updates instead of WebSockets - _Rationale:_ Simpler implementation for POC, adequate latency for operator monitoring, avoids WebSocket connection management complexity

- **Token-Based Device Authentication:** UUID tokens generated during provisioning, stored in ESP32 NVS flash and PostgreSQL, sent in HTTP Authorization header - _Rationale:_ Simple yet secure authentication suitable for fixed-deployment IoT devices without need for certificate management

- **Repository Pattern for Data Access:** Backend abstracts database operations behind repository interfaces - _Rationale:_ Enables testing with mock data, allows future database migration if needed, separates business logic from persistence concerns

- **Fail-Safe Hardware Design:** Normally-closed relays (fans ON by default), hardware watchdog resets, redundant safety timers - _Rationale:_ Critical safety requirement that any electrical or software failure must result in fans running to protect grain bunkers

---

## Tech Stack

This is the **DEFINITIVE** technology selection for the entire project. All development must use these exact technologies and versions. This table serves as the single source of truth across firmware, backend, and frontend development.

### Technology Stack Table

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

---

## Data Models

The following data models represent the core business entities across firmware, backend, and frontend. TypeScript interfaces are provided for frontend use and can be generated from the FastAPI OpenAPI specification.

### User

**Purpose:** Represents web UI operators who can log in to monitor and control bunker systems.

**Key Attributes:**
- `id`: UUID - Unique user identifier
- `username`: string - Login username (unique)
- `password_hash`: string - Bcrypt hashed password (never exposed to frontend)
- `email`: string - Contact email
- `role`: enum - User role (admin, operator, viewer)
- `created_at`: datetime - Account creation timestamp
- `last_login`: datetime - Last successful login

#### TypeScript Interface

```typescript
interface User {
  id: string; // UUID
  username: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  created_at: string; // ISO 8601
  last_login: string | null; // ISO 8601
}

interface UserCredentials {
  username: string;
  password: string;
}

interface AuthToken {
  access_token: string;
  token_type: 'bearer';
  expires_at: string; // ISO 8601
}
```

#### Relationships
- User can view/control multiple Bunkers (based on role)
- User creates TimeWindowOverrides (one-to-many)

---

### Bunker

**Purpose:** Represents a physical grain bunker location with its configuration, orientation, and associated fans/devices.

**Key Attributes:**
- `id`: UUID - Unique bunker identifier
- `name`: string - Human-readable bunker name
- `latitude`: float - GPS latitude coordinate
- `longitude`: float - GPS longitude coordinate
- `orientation_degrees`: float - Bunker orientation (0-360, North = 0)
- `fan_count`: int - Number of fans in this bunker
- `wind_threshold_mph`: float - Wind speed threshold (null = use global)
- `electricity_cost_kwh`: float - Cost per kWh
- `fan_power_watts`: int - Individual fan power consumption
- `created_at`: datetime - Creation timestamp
- `updated_at`: datetime - Last update timestamp

#### TypeScript Interface

```typescript
interface Bunker {
  id: string; // UUID
  name: string;
  latitude: number;
  longitude: number;
  orientation_degrees: number; // 0-360
  fan_count: number;
  wind_threshold_mph: number | null;
  electricity_cost_kwh: number;
  fan_power_watts: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

interface BunkerCreateRequest {
  name: string;
  latitude: number;
  longitude: number;
  orientation_degrees: number;
  fan_count: number;
  electricity_cost_kwh: number;
  fan_power_watts: number;
}
```

#### Relationships
- Bunker has many Devices (one-to-many)
- Bunker has many TimeWindowOverrides (one-to-many)

---

### Device (ESP32 Controller)

**Purpose:** Represents an ESP32 controller that controls one fan.

**Key Attributes:**
- `id`: UUID - Unique device identifier
- `auth_token`: UUID - Authentication token (never exposed to frontend)
- `bunker_id`: UUID - Foreign key to Bunker
- `fan_position`: int - Fan position within bunker (1-based)
- `mac_address`: string - ESP32 MAC address
- `firmware_version`: string - ESP-IDF firmware version
- `last_seen`: datetime - Last successful communication
- `provisioned_at`: datetime - Provisioning timestamp
- `led_flash_sequence`: int - LED flash count for identification (1-10)

#### TypeScript Interface

```typescript
interface Device {
  id: string; // UUID
  bunker_id: string; // UUID
  fan_position: number;
  mac_address: string;
  firmware_version: string;
  last_seen: string | null; // ISO 8601
  provisioned_at: string; // ISO 8601
  led_flash_sequence: number;
  is_online: boolean; // Computed: last_seen within 2 minutes
}

interface DeviceProvisionRequest {
  bunker_id: string;
  fan_position: number;
  mac_address: string;
}

interface DeviceProvisionResponse {
  device_id: string; // UUID
  auth_token: string; // UUID - only returned once
  led_flash_sequence: number;
}
```

#### Relationships
- Device belongs to one Bunker (many-to-one)
- Device has current DeviceStatus (one-to-one, real-time)

---

### DeviceStatus (Real-Time Telemetry)

**Purpose:** Current status reported by ESP32 devices. POC stores only current state.

**Key Attributes:**
- `device_id`: UUID - Foreign key to Device
- `relay_state`: enum - Current relay state (ON, OFF)
- `uptime_seconds`: int - Device uptime since boot
- `wifi_rssi`: int - WiFi signal strength (dBm)
- `countdown_timer_remaining`: int - Dead-man timer remaining (0-300 sec)
- `reported_at`: datetime - When status was reported
- `server_received_at`: datetime - When server received status

#### TypeScript Interface

```typescript
interface DeviceStatus {
  device_id: string; // UUID
  relay_state: 'ON' | 'OFF';
  uptime_seconds: number;
  wifi_rssi: number; // dBm
  countdown_timer_remaining: number; // 0-300 seconds
  reported_at: string; // ISO 8601
  server_received_at: string; // ISO 8601
}

interface FanStatus {
  device_id: string;
  bunker_id: string;
  fan_position: number;
  is_online: boolean;
  relay_state: 'ON' | 'OFF';
  uptime_seconds: number;
  wifi_rssi: number;
  last_update: string; // ISO 8601
}
```

#### Relationships
- DeviceStatus belongs to one Device (many-to-one)

---

### WeatherData (Real-Time)

**Purpose:** Current wind conditions from aviation weather.gov API. POC stores only current conditions.

**Key Attributes:**
- `station_id`: string - Weather station identifier
- `wind_speed_mph`: float - Current wind speed
- `wind_direction_degrees`: float - Wind direction (0-360)
- `temperature_f`: float - Temperature (informational)
- `fetched_at`: datetime - When data was fetched
- `observation_time`: datetime - Official observation timestamp

#### TypeScript Interface

```typescript
interface WeatherData {
  station_id: string;
  wind_speed_mph: number;
  wind_direction_degrees: number; // 0-360
  temperature_f: number;
  fetched_at: string; // ISO 8601
  observation_time: string; // ISO 8601
}

interface WeatherConfig {
  station_id: string;
  poll_interval_seconds: number;
}
```

#### Relationships
- Global (not tied to specific bunkers in POC)

---

### TimeWindowOverride

**Purpose:** Force fans ON during specified time windows.

**Key Attributes:**
- `id`: UUID - Unique override identifier
- `bunker_id`: UUID - Bunker (null = global override)
- `start_time`: datetime - Override window start
- `end_time`: datetime - Override window end
- `reason`: string - Operator reason
- `created_by`: UUID - User who created override
- `created_at`: datetime - Creation timestamp

#### TypeScript Interface

```typescript
interface TimeWindowOverride {
  id: string; // UUID
  bunker_id: string | null; // null = global
  start_time: string; // ISO 8601
  end_time: string; // ISO 8601
  reason: string;
  created_by: string; // UUID
  created_at: string; // ISO 8601
  is_active: boolean; // Computed
}

interface TimeWindowOverrideCreateRequest {
  bunker_id: string | null;
  start_time: string;
  end_time: string;
  reason: string;
}
```

#### Relationships
- Belongs to one Bunker or is global (many-to-one or null)
- Created by one User (many-to-one)

---

### GlobalConfig

**Purpose:** System-wide configuration settings.

**Key Attributes:**
- `id`: int - Singleton (always ID=1)
- `default_wind_threshold_mph`: float
- `default_electricity_cost_kwh`: float
- `default_fan_power_watts`: int
- `weather_station_id`: string
- `weather_poll_interval_seconds`: int
- `shutdown_broadcast_interval_seconds`: int
- `device_offline_threshold_seconds`: int

#### TypeScript Interface

```typescript
interface GlobalConfig {
  id: number; // Always 1
  default_wind_threshold_mph: number;
  default_electricity_cost_kwh: number;
  default_fan_power_watts: number;
  weather_station_id: string;
  weather_poll_interval_seconds: number;
  shutdown_broadcast_interval_seconds: number;
  device_offline_threshold_seconds: number;
}
```

#### Relationships
- Singleton (no foreign keys)

---

### EnergySavings (Computed)

**Purpose:** Aggregated energy savings. Computed on-demand, not stored.

#### TypeScript Interface

```typescript
interface EnergySavings {
  bunker_id: string;
  total_fan_off_time_seconds: number;
  energy_saved_kwh: number;
  cost_saved_usd: number;
  calculation_period: {
    start: string; // ISO 8601
    end: string; // ISO 8601
  };
}

interface SystemWideSavings {
  total_bunkers: number;
  total_devices: number;
  total_energy_saved_kwh: number;
  total_cost_saved_usd: number;
  by_bunker: EnergySavings[];
}
```

#### Relationships
- Computed from DeviceStatus and Bunker configuration

---

### Entity Relationship Diagram

```mermaid
erDiagram
    User ||--o{ TimeWindowOverride : creates
    Bunker ||--o{ Device : "has many"
    Bunker ||--o{ TimeWindowOverride : "has many"
    Device ||--o{ DeviceStatus : reports

    User {
        uuid id PK
        string username UK
        string password_hash
        string email
        enum role
        datetime created_at
        datetime last_login
    }

    Bunker {
        uuid id PK
        string name
        float latitude
        float longitude
        float orientation_degrees
        int fan_count
        float wind_threshold_mph
        float electricity_cost_kwh
        int fan_power_watts
        datetime created_at
        datetime updated_at
    }

    Device {
        uuid id PK
        uuid auth_token UK
        uuid bunker_id FK
        int fan_position
        string mac_address
        string firmware_version
        datetime last_seen
        datetime provisioned_at
        int led_flash_sequence
    }

    DeviceStatus {
        uuid device_id FK
        enum relay_state
        int uptime_seconds
        int wifi_rssi
        int countdown_timer_remaining
        datetime reported_at
        datetime server_received_at
    }

    TimeWindowOverride {
        uuid id PK
        uuid bunker_id FK
        datetime start_time
        datetime end_time
        string reason
        uuid created_by FK
        datetime created_at
    }

    WeatherData {
        string station_id PK
        float wind_speed_mph
        float wind_direction_degrees
        float temperature_f
        datetime fetched_at
        datetime observation_time
    }

    GlobalConfig {
        int id PK
        float default_wind_threshold_mph
        float default_electricity_cost_kwh
        int default_fan_power_watts
        string weather_station_id
        int weather_poll_interval_seconds
        int shutdown_broadcast_interval_seconds
        int device_offline_threshold_seconds
    }
```

---

## API Specification

The Bunker Colab system uses a **REST API** for all communication between ESP32 devices, the web UI, and external services. FastAPI automatically generates OpenAPI 3.0 documentation at `/docs` (Swagger UI) and `/redoc` (ReDoc).

**API Base URL:** `https://yourdomain.com/api/v1`

**Authentication:**
- **Web UI Users:** Bearer token obtained via `/auth/login` endpoint
- **ESP32 Devices:** UUID token in `Authorization: Bearer <token>` header (obtained during provisioning)

### REST API Endpoints

Due to length, the complete OpenAPI 3.0 specification is available in the appendix. Key endpoint categories:

**Authentication:**
- `POST /auth/login` - User login (Web UI)
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user info

**Device Provisioning:**
- `POST /devices/provision` - Provision new ESP32 device (returns auth token once)
- `GET /devices` - List all devices
- `GET /devices/{device_id}` - Get device details
- `DELETE /devices/{device_id}` - Deprovision device

**Device Control (ESP32):**
- `POST /control/status` - **Critical:** ESP32 reports status and receives shutdown decision
- `POST /control/emergency-on` - Emergency ON for specific bunker (Web UI)
- `POST /control/emergency-on-all` - Global emergency ON (Web UI)

**Bunkers:**
- `GET /bunkers` - List all bunkers
- `POST /bunkers` - Create new bunker
- `GET /bunkers/{bunker_id}` - Get bunker details
- `PUT /bunkers/{bunker_id}` - Update bunker configuration
- `DELETE /bunkers/{bunker_id}` - Delete bunker
- `GET /bunkers/{bunker_id}/status` - Get real-time bunker status with all fans

**Weather:**
- `GET /weather/current` - Get current weather data

**Energy Savings:**
- `GET /energy/savings` - System-wide energy savings
- `GET /energy/savings/{bunker_id}` - Bunker-specific energy savings

**Time Window Overrides:**
- `GET /overrides` - List time window overrides
- `POST /overrides` - Create override
- `DELETE /overrides/{override_id}` - Delete override

**Configuration:**
- `GET /config` - Get global configuration
- `PUT /config` - Update global configuration

### ESP32 Communication Protocol

**Dead-Man Timer Flow:**

1. **ESP32 polls `/control/status` every 60 seconds** with current status:
```json
POST /api/v1/control/status
Authorization: Bearer <device-uuid-token>

{
  "relay_state": "OFF",
  "uptime_seconds": 3600,
  "wifi_rssi": -65,
  "countdown_timer_remaining": 240,
  "firmware_version": "v1.0.0"
}
```

2. **Server responds with shutdown decision:**
```json
{
  "shutdown_allowed": true,
  "shutdown_reason": "wind_conditions_favorable",
  "server_time": "2025-10-21T20:00:00Z",
  "reset_countdown": true
}
```

3. **ESP32 behavior:**
   - If `shutdown_allowed: true` and `reset_countdown: true`: Reset 5-minute countdown, relay may be OFF
   - If `shutdown_allowed: false`: Force relay ON immediately
   - If countdown expires or API call fails: Force relay ON (fail-safe)

**Shutdown Reasons:**
- `wind_conditions_favorable` - Wind meets threshold, safe to shut down
- `time_window_override` - Time window override forcing fans ON
- `emergency_on` - Emergency ON triggered from Web UI
- `default` - Default behavior (fans ON)

---

## Components

The Bunker Colab system is composed of three major subsystems with distinct components. This section defines component boundaries, responsibilities, and interfaces.

### Backend Components (FastAPI Server)

#### API Server

**Responsibility:** HTTP request handling, routing, authentication middleware, and API documentation

**Key Interfaces:**
- REST API endpoints (documented in API Specification)
- OpenAPI schema generation at `/docs` and `/redoc`
- CORS configuration for frontend origin
- Bearer token validation middleware

**Dependencies:** AuthService, Database Repository Layer, ControlLogicEngine, WeatherService

**Technology Stack:** FastAPI, Uvicorn, Pydantic for request/response validation

---

#### AuthService

**Responsibility:** User authentication, session management, device token validation

**Key Interfaces:**
- `authenticate_user(username, password) -> AuthToken | None`
- `validate_user_token(token) -> User | None`
- `validate_device_token(token) -> Device | None`
- `generate_user_token(user) -> AuthToken`
- `generate_device_token() -> UUID`

**Dependencies:** Database (User, Device tables), bcrypt password hashing (passlib)

**Technology Stack:** Python, python-jose for JWT, passlib for bcrypt

---

#### WeatherService

**Responsibility:** Fetch wind data from aviation weather.gov API, cache current conditions, expose to ControlLogicEngine

**Key Interfaces:**
- `get_current_weather() -> WeatherData`
- `fetch_weather_from_api() -> WeatherData` (background task every 60s)
- `is_weather_stale() -> bool` (check if last fetch > threshold)

**Dependencies:** httpx or requests for HTTP calls, GlobalConfig for station_id and poll_interval

**Technology Stack:** Python asyncio background tasks, httpx for async HTTP

**Notes:**
- Runs as FastAPI background task polling every 60 seconds
- Caches latest weather data in memory (no database storage for POC)
- Handles weather.gov API errors gracefully (log warning, use last known good data)

---

#### ControlLogicEngine

**Responsibility:** Core decision-making logic - determines if fans should shut down based on weather, overrides, and configuration

**Key Interfaces:**
- `should_shutdown_fans(device_id) -> ShutdownDecision`
- `check_wind_conditions() -> bool` (wind speed meets threshold)
- `check_time_window_overrides(bunker_id) -> bool` (active override exists)
- `check_emergency_mode(bunker_id) -> bool` (emergency ON active)

**Dependencies:** WeatherService, Database (Bunker, TimeWindowOverride, GlobalConfig)

**Technology Stack:** Python, business logic with unit test coverage (pytest)

**Decision Logic:**
```
IF emergency_on OR time_window_override_active:
    RETURN shutdown_allowed = False (fans ON)
ELIF wind_speed >= threshold:
    RETURN shutdown_allowed = True (fans may shut down)
ELSE:
    RETURN shutdown_allowed = False (fans ON)
```

---

#### Database Repository Layer

**Responsibility:** Abstract database operations, provide clean interface for business logic, handle CRUD operations

**Key Interfaces:**
- `UserRepository`: create_user, get_user, authenticate, update_last_login
- `BunkerRepository`: create, get, list, update, delete
- `DeviceRepository`: provision, get, list, update_last_seen, delete
- `DeviceStatusRepository`: upsert_status, get_status, get_by_bunker
- `TimeWindowOverrideRepository`: create, list, delete, get_active
- `GlobalConfigRepository`: get, update (singleton)

**Dependencies:** SQLAlchemy ORM, PostgreSQL database

**Technology Stack:** SQLAlchemy 2.0+ with async support, Alembic for migrations

**Notes:**
- Repository pattern enables testing with mocks
- All database operations use async SQLAlchemy sessions
- Transaction management handled at repository level

---

#### EnergyCalculationService

**Responsibility:** Compute energy savings from device uptime and bunker configuration (on-demand, not stored)

**Key Interfaces:**
- `calculate_bunker_savings(bunker_id, start_time, end_time) -> EnergySavings`
- `calculate_system_savings(start_time, end_time) -> SystemWideSavings`

**Dependencies:** Database (Device, DeviceStatus, Bunker)

**Technology Stack:** Python, decimal arithmetic for precision

**Calculation Logic:**
```
For each device in bunker:
  fan_off_time = (current_time - provisioned_at) - uptime_seconds
  energy_saved_kwh = (fan_off_time / 3600) * (fan_power_watts / 1000)
  cost_saved = energy_saved_kwh * electricity_cost_kwh
```

---

### Frontend Components (React SPA)

#### App Shell & Router

**Responsibility:** Application layout, route management, authentication state, global navigation

**Key Interfaces:**
- Route definitions for all pages
- Protected route wrapper (redirects to login if unauthenticated)
- Global navigation bar/sidebar
- Auth context provider

**Dependencies:** React Router, AuthContext

**Technology Stack:** React 18, React Router v6, Context API

---

#### AuthContext & AuthService

**Responsibility:** Global authentication state, login/logout, token management

**Key Interfaces:**
- `login(username, password) -> Promise<void>`
- `logout() -> void`
- `currentUser: User | null`
- `isAuthenticated: boolean`
- `authToken: string | null`

**Dependencies:** Axios for API calls, localStorage for token persistence

**Technology Stack:** React Context API, Axios interceptors for auth headers

---

#### MapDashboard Component

**Responsibility:** Landing page with interactive map showing bunker locations and status

**Key Interfaces:**
- Display Leaflet map with bunker markers
- Color-coded markers (green=all fans on, blue=some fans off, red=offline)
- Wind overlay (arrow showing direction, speed label)
- Click bunker marker → navigate to BunkerDetail

**Dependencies:** Leaflet.js, React-Leaflet, BunkerService, WeatherService

**Technology Stack:** React, Leaflet.js, React-Leaflet wrapper

**State Management:**
- Poll `/bunkers` and `/weather/current` every 3 seconds
- Local component state for map markers and weather overlay

---

#### BunkerDetail Component

**Responsibility:** Detailed bunker view with fan layout diagram, real-time status, energy savings

**Key Interfaces:**
- Visual fan layout grid (based on bunker.fan_count and fan_position)
- Real-time fan status indicators (on/off, online/offline)
- Wind visualization relative to bunker orientation
- Energy savings display
- Emergency ON button for this bunker

**Dependencies:** BunkerService, DeviceService, EnergyService

**Technology Stack:** React, Tailwind CSS for layout, SVG for fan diagrams

**State Management:**
- Poll `/bunkers/{id}/status` and `/energy/savings/{id}` every 3 seconds
- Local state for fan status grid

---

#### DeviceProvisioningWizard Component

**Responsibility:** Multi-step wizard to provision new ESP32 devices

**Key Interfaces:**
- Step 1: Select bunker
- Step 2: Enter MAC address and fan position
- Step 3: Display auth token (copy to clipboard) and LED flash sequence
- Step 4: Confirmation and deployment instructions

**Dependencies:** DeviceService, BunkerService

**Technology Stack:** React, Headless UI for wizard steps, Clipboard API

**State Management:**
- Local wizard state (current step, form data)
- One-time display of auth token (security warning: won't be shown again)

---

#### SettingsConfiguration Component

**Responsibility:** Global and per-bunker configuration UI

**Key Interfaces:**
- Global Config tab: weather station, wind threshold, polling intervals, energy costs
- Bunker Config tab: per-bunker overrides for wind threshold, energy costs
- Time Window Overrides tab: create/delete override schedules

**Dependencies:** ConfigService, BunkerService, OverrideService

**Technology Stack:** React, Headless UI tabs, form components

**State Management:**
- Fetch `/config` and `/bunkers` on mount
- Update optimistically, refetch on success

---

#### API Service Layer (Frontend)

**Responsibility:** Abstract API calls, handle auth tokens, provide type-safe interfaces

**Key Interfaces:**
- `AuthService`: login, logout, getMe
- `BunkerService`: listBunkers, getBunker, createBunker, updateBunker, deleteBunker, getBunkerStatus
- `DeviceService`: provisionDevice, listDevices, deleteDevice
- `WeatherService`: getCurrentWeather
- `EnergyService`: getSystemSavings, getBunkerSavings
- `OverrideService`: listOverrides, createOverride, deleteOverride
- `ConfigService`: getConfig, updateConfig
- `ControlService`: emergencyOnBunker, emergencyOnAll

**Dependencies:** Axios, TypeScript interfaces (generated from OpenAPI)

**Technology Stack:** Axios with interceptors for auth and error handling

**Notes:**
- Axios interceptor adds `Authorization: Bearer ${token}` header automatically
- Error interceptor catches 401 and redirects to login
- All interfaces return Promises with typed responses

---

### Firmware Components (ESP32)

#### Main Application Loop

**Responsibility:** FreeRTOS task coordination, initialization, main control flow

**Key Interfaces:**
- Initialize WiFi, NVS, SNTP, watchdog
- Create FreeRTOS tasks: WiFiTask, TimerTask, ControlTask, HeartbeatTask
- Handle resets and error recovery

**Dependencies:** ESP-IDF SDK, FreeRTOS

**Technology Stack:** C, ESP-IDF 5.x, FreeRTOS tasks

---

#### WiFiManager Component

**Responsibility:** WiFi connection, provisioning (AP mode), credential storage, reconnection logic

**Key Interfaces:**
- `wifi_init()` - Initialize WiFi subsystem
- `wifi_connect()` - Connect to stored credentials
- `wifi_start_provisioning()` - Start AP mode for credential entry
- `wifi_reconnect_task()` - Background reconnection (30s for 5 attempts, then 2min)

**Dependencies:** ESP-IDF WiFi APIs, NVS for credential storage

**Technology Stack:** esp_wifi, esp_netif, WiFi provisioning manager

**Notes:**
- Stores SSID and password in NVS flash (encrypted partition)
- Emits WiFi events (connected, disconnected) to other components

---

#### HTTPClient Component

**Responsibility:** HTTPS communication with cloud server, TLS certificate validation

**Key Interfaces:**
- `http_post_status(relay_state, uptime, rssi, countdown) -> ShutdownDecision`
- `http_set_auth_token(token)` - Configure device auth token
- `http_validate_certificate()` - Validate server TLS certificate

**Dependencies:** ESP-IDF HTTP client, esp_tls, device auth token from NVS

**Technology Stack:** esp_http_client, esp_tls with root CA bundle

**Notes:**
- Validates server TLS certificate against built-in CA bundle
- Timeout: 10 seconds for API calls
- Retry logic: 3 attempts with exponential backoff on failure

---

#### DeadManTimer Component

**Responsibility:** Maintain 5-minute countdown timer, reset on server command, trigger fail-safe

**Key Interfaces:**
- `timer_reset()` - Reset countdown to 300 seconds
- `timer_get_remaining() -> int` - Get seconds remaining
- `timer_expired() -> bool` - Check if timer expired
- `timer_task()` - FreeRTOS task (decrements every second)

**Dependencies:** FreeRTOS timers, RelayController

**Technology Stack:** FreeRTOS software timers, atomic operations

**Notes:**
- When timer expires: calls RelayController.force_on()
- Timer resets only when server sends `reset_countdown: true`
- Critical for fail-safe behavior

---

#### RelayController Component

**Responsibility:** GPIO control of relay (fan power), enforce fail-safe ON state

**Key Interfaces:**
- `relay_init()` - Configure GPIO for relay (normally closed)
- `relay_set_on()` - Energize relay (fans ON)
- `relay_set_off()` - De-energize relay (fans OFF)
- `relay_force_on()` - Force relay ON (fail-safe, cannot be overridden)

**Dependencies:** GPIO driver

**Technology Stack:** esp_gpio driver

**Notes:**
- Normally-closed relay: GPIO LOW = relay closed = fans ON (fail-safe default)
- Force-on state bypasses all logic until system reset

---

#### WatchdogManager Component

**Responsibility:** Hardware watchdog timer management, heartbeat, system health monitoring

**Key Interfaces:**
- `watchdog_init()` - Initialize hardware watchdog
- `watchdog_feed()` - Feed watchdog (prevent reset)
- `watchdog_task()` - FreeRTOS task (feeds every 30 seconds)

**Dependencies:** ESP-IDF watchdog APIs

**Technology Stack:** esp_task_wdt (task watchdog timer)

**Notes:**
- Watchdog timeout: 60 seconds
- If main tasks hang, watchdog triggers hardware reset
- All critical tasks must call watchdog_feed() periodically

---

#### LEDController Component

**Responsibility:** LED flash sequences for device identification during deployment

**Key Interfaces:**
- `led_init()` - Configure GPIO for LED
- `led_flash_sequence(count)` - Flash LED `count` times (1-10)
- `led_start_identification()` - Continuously flash sequence every 5 seconds

**Dependencies:** GPIO driver, FreeRTOS timers

**Technology Stack:** esp_gpio, FreeRTOS timers

**Notes:**
- LED flash pattern assigned during provisioning
- Helps operators identify which physical device corresponds to which database record

---

#### NVSStorage Component

**Responsibility:** Non-volatile storage for WiFi credentials, device auth token, configuration

**Key Interfaces:**
- `nvs_save_wifi_credentials(ssid, password)`
- `nvs_load_wifi_credentials() -> (ssid, password)`
- `nvs_save_auth_token(token)`
- `nvs_load_auth_token() -> token`

**Dependencies:** ESP-IDF NVS (non-volatile storage) APIs

**Technology Stack:** nvs_flash

**Notes:**
- NVS partition is encrypted for security
- Auth token stored permanently until device deprovision

---

### Component Interaction Diagram

```mermaid
graph TB
    subgraph "Frontend (React SPA)"
        MapDash[MapDashboard]
        BunkerDetail[BunkerDetail]
        Wizard[ProvisioningWizard]
        Settings[Settings]
        APIService[API Service Layer]
    end

    subgraph "Backend (FastAPI)"
        APIServer[API Server]
        AuthSvc[AuthService]
        WeatherSvc[WeatherService]
        ControlEngine[ControlLogicEngine]
        EnergyCalc[EnergyCalculationService]
        RepoLayer[Repository Layer]
    end

    subgraph "Database"
        PostgreSQL[(PostgreSQL)]
    end

    subgraph "ESP32 Firmware"
        MainLoop[Main App Loop]
        WiFiMgr[WiFiManager]
        HTTPClient[HTTPClient]
        DeadManTimer[DeadManTimer]
        RelayCtrl[RelayController]
        Watchdog[WatchdogManager]
        LED[LEDController]
        NVS[NVSStorage]
    end

    subgraph "External"
        WeatherAPI[Aviation Weather.gov]
    end

    MapDash --> APIService
    BunkerDetail --> APIService
    Wizard --> APIService
    Settings --> APIService

    APIService -->|HTTPS REST| APIServer

    APIServer --> AuthSvc
    APIServer --> ControlEngine
    APIServer --> EnergyCalc
    APIServer --> RepoLayer

    WeatherSvc -->|Poll every 60s| WeatherAPI
    ControlEngine --> WeatherSvc
    ControlEngine --> RepoLayer
    EnergyCalc --> RepoLayer
    AuthSvc --> RepoLayer
    RepoLayer --> PostgreSQL

    HTTPClient -->|HTTPS REST| APIServer
    MainLoop --> WiFiMgr
    MainLoop --> HTTPClient
    MainLoop --> DeadManTimer
    MainLoop --> RelayCtrl
    MainLoop --> Watchdog
    MainLoop --> LED
    MainLoop --> NVS

    WiFiMgr --> NVS
    HTTPClient --> NVS
    DeadManTimer --> RelayCtrl

    style ControlEngine fill:#FFD700
    style DeadManTimer fill:#FF6B6B
    style RelayCtrl fill:#FF6B6B
    style WeatherSvc fill:#90EE90
```

---

## External APIs

The Bunker Colab system integrates with one external API for weather data.

### Aviation Weather.gov API

**Purpose:** Fetch real-time wind speed and direction data for fan control decisions

**Documentation:** https://www.weather.gov/documentation/services-web-api

**Base URL(s):** https://api.weather.gov

**Authentication:** None required (public API), but must include `User-Agent` header

**Rate Limits:**
- No official rate limit published
- Recommended: Poll no more than once per minute
- Implementation: Cache responses, poll every 60 seconds

**Key Endpoints Used:**

1. **`GET /stations/{stationId}/observations/latest`** - Get latest observation for weather station

**Example Request:**
```http
GET https://api.weather.gov/stations/KOKC/observations/latest
User-Agent: BunkerColab/1.0 (contact@yourdomain.com)
Accept: application/geo+json
```

**Example Response:**
```json
{
  "properties": {
    "station": "https://api.weather.gov/stations/KOKC",
    "timestamp": "2025-10-21T20:54:00+00:00",
    "textDescription": "Fair",
    "temperature": {
      "value": 18.9,
      "unitCode": "wmoUnit:degC"
    },
    "windSpeed": {
      "value": 22.224,
      "unitCode": "wmoUnit:km_h-1"
    },
    "windDirection": {
      "value": 180,
      "unitCode": "wmoUnit:degree_(angle)"
    }
  }
}
```

**Integration Notes:**

1. **Unit Conversions:**
   - Wind speed returned in km/h, convert to mph: `mph = km_h * 0.621371`
   - Temperature in Celsius, convert to Fahrenheit: `F = C * 9/5 + 32`
   - Wind direction in degrees (0-360, where 0 = North) - use directly

2. **Error Handling:**
   - API may return 404 if station ID invalid (validate station ID in GlobalConfig)
   - Network errors: Log warning, use last known good weather data
   - Stale data threshold: If no successful fetch for 10 minutes, consider weather data stale (log error, default to fans ON)

3. **Station Selection:**
   - Station ID configurable in GlobalConfig (e.g., "KOKC" for Oklahoma City)
   - Use METAR station codes for airports near bunker locations
   - Find station IDs: https://www.weather.gov/wrh/timeseries

4. **Caching Strategy:**
   - Cache latest response in WeatherService memory
   - Background task polls every 60 seconds
   - Frontend/ESP32 get cached data via API (no direct weather.gov calls)

5. **User-Agent Requirement:**
   - weather.gov requires descriptive User-Agent header
   - Use format: `BunkerColab/1.0 (your-email@domain.com)`
   - Failure to provide User-Agent may result in 403 Forbidden

**Implementation Example (Python):**
```python
import httpx
from datetime import datetime, timedelta

class WeatherService:
    def __init__(self, station_id: str):
        self.station_id = station_id
        self.base_url = "https://api.weather.gov"
        self.cached_weather = None
        self.last_fetch = None

    async def fetch_weather_from_api(self) -> WeatherData:
        url = f"{self.base_url}/stations/{self.station_id}/observations/latest"
        headers = {
            "User-Agent": "BunkerColab/1.0 (contact@yourdomain.com)",
            "Accept": "application/geo+json"
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers=headers)
                response.raise_for_status()
                data = response.json()

                props = data["properties"]
                wind_speed_kmh = props["windSpeed"]["value"]
                wind_speed_mph = wind_speed_kmh * 0.621371 if wind_speed_kmh else 0

                weather = WeatherData(
                    station_id=self.station_id,
                    wind_speed_mph=wind_speed_mph,
                    wind_direction_degrees=props["windDirection"]["value"] or 0,
                    temperature_f=(props["temperature"]["value"] * 9/5 + 32) if props["temperature"]["value"] else 32,
                    fetched_at=datetime.utcnow(),
                    observation_time=datetime.fromisoformat(props["timestamp"].replace("Z", "+00:00"))
                )

                self.cached_weather = weather
                self.last_fetch = datetime.utcnow()
                return weather

        except Exception as e:
            logger.error(f"Weather API fetch failed: {e}")
            if self.cached_weather:
                logger.warning("Using cached weather data")
                return self.cached_weather
            raise

    def get_current_weather(self) -> WeatherData:
        if self.is_weather_stale():
            logger.error("Weather data is stale (>10 minutes)")
        return self.cached_weather

    def is_weather_stale(self) -> bool:
        if not self.last_fetch:
            return True
        return datetime.utcnow() - self.last_fetch > timedelta(minutes=10)
```

---

## Core Workflows

This section illustrates critical system workflows using sequence diagrams.

### Workflow 1: ESP32 Startup and Provisioning

```mermaid
sequenceDiagram
    participant ESP32
    participant NVS
    participant WiFi
    participant Server
    participant DB

    Note over ESP32: Power On / Reset
    ESP32->>NVS: Load auth token
    alt Auth token exists
        NVS-->>ESP32: Return token
        ESP32->>NVS: Load WiFi credentials
        NVS-->>ESP32: Return SSID/password
        ESP32->>WiFi: Connect to WiFi
        WiFi-->>ESP32: Connected
        ESP32->>Server: POST /control/status (first heartbeat)
        Server->>DB: Validate device token
        DB-->>Server: Device valid
        Server-->>ESP32: shutdown_allowed response
        Note over ESP32: Normal operation begins
    else No auth token
        Note over ESP32: Enter provisioning mode
        ESP32->>WiFi: Start AP mode
        Note over ESP32: Waiting for provisioning...
        Note over Server: Operator uses Web UI
        Server->>DB: Create device record, generate token
        DB-->>Server: Device ID, auth token, LED sequence
        Note over Server: Display token to operator (one time)
        Note over ESP32: Operator configures WiFi + token
        ESP32->>NVS: Save WiFi credentials
        ESP32->>NVS: Save auth token
        ESP32->>WiFi: Reboot, connect to WiFi
        WiFi-->>ESP32: Connected
        ESP32->>Server: POST /control/status (first heartbeat)
        Server-->>ESP32: shutdown_allowed response
        Note over ESP32: Normal operation begins
    end
```

### Workflow 2: Normal Operation - Dead-Man Timer Control Loop

```mermaid
sequenceDiagram
    participant Timer as DeadManTimer
    participant ESP32 as ESP32 Main
    participant Server as FastAPI Server
    participant Control as ControlLogicEngine
    participant Weather as WeatherService
    participant Relay as RelayController

    Note over ESP32: Every 60 seconds
    ESP32->>Server: POST /control/status<br/>(relay_state, uptime, rssi, countdown)
    Server->>Control: should_shutdown_fans(device_id)
    Control->>Weather: get_current_weather()
    Weather-->>Control: wind_speed_mph, wind_direction
    Control->>Control: Check wind threshold<br/>Check time overrides<br/>Check emergency mode

    alt Wind >= threshold AND no overrides
        Control-->>Server: shutdown_allowed=true, reset_countdown=true
        Server-->>ESP32: shutdown_allowed=true
        ESP32->>Timer: Reset countdown to 300s
        Note over Timer: Countdown active (300s)
        ESP32->>Relay: Set relay OFF (if not already)
        Note over Relay: Fans OFF (saving energy)
    else Wind < threshold OR override active
        Control-->>Server: shutdown_allowed=false
        Server-->>ESP32: shutdown_allowed=false
        ESP32->>Relay: Force relay ON
        Note over Relay: Fans ON (fail-safe)
        Note over Timer: Countdown paused
    end

    Note over Timer: Every second
    Timer->>Timer: Decrement countdown

    alt Countdown expires (reaches 0)
        Timer->>Relay: force_on()
        Note over Relay: Fans ON (fail-safe)
        Note over ESP32: Wait for next server poll<br/>to reset countdown
    end
```

### Workflow 3: Emergency ON Triggered from Web UI

```mermaid
sequenceDiagram
    participant Operator
    participant WebUI
    participant Server
    participant DB
    participant ESP32_1 as ESP32 Device 1
    participant ESP32_N as ESP32 Device N

    Note over Operator: Sees severe weather warning
    Operator->>WebUI: Click "Emergency ON" button
    WebUI->>Server: POST /control/emergency-on-all
    Server->>DB: Set emergency_on flag for all bunkers
    DB-->>Server: Success
    Server-->>WebUI: 200 OK
    WebUI-->>Operator: "All fans activated"

    Note over ESP32_1,ESP32_N: Next status poll (within 60s)

    ESP32_1->>Server: POST /control/status
    Server->>DB: Check emergency_on flag
    DB-->>Server: emergency_on = true
    Server-->>ESP32_1: shutdown_allowed=false, reason=emergency_on
    ESP32_1->>ESP32_1: Force relay ON immediately

    ESP32_N->>Server: POST /control/status
    Server->>DB: Check emergency_on flag
    DB-->>Server: emergency_on = true
    Server-->>ESP32_N: shutdown_allowed=false, reason=emergency_on
    ESP32_N->>ESP32_N: Force relay ON immediately

    Note over ESP32_1,ESP32_N: All fans running

    Note over Operator: Weather clears
    Operator->>WebUI: Clear emergency mode
    WebUI->>Server: DELETE emergency flag
    Server->>DB: Clear emergency_on
    Server-->>WebUI: 200 OK

    Note over ESP32_1,ESP32_N: Next status poll resumes normal logic
```

### Workflow 4: WiFi Connection Loss and Recovery

```mermaid
sequenceDiagram
    participant Timer as DeadManTimer
    participant ESP32
    participant WiFi
    participant Server
    participant Relay

    Note over ESP32: Normal operation
    Timer->>Timer: Countdown at 240s

    Note over WiFi: Connection lost
    WiFi-->>ESP32: Disconnected event
    ESP32->>ESP32: Log warning
    ESP32->>WiFi: Attempt reconnect (30s intervals)

    Note over Timer: Countdown continues
    Timer->>Timer: 239s... 238s... 237s...

    loop Every 30 seconds (up to 5 attempts)
        ESP32->>WiFi: Reconnect attempt
        WiFi-->>ESP32: Failed
        Timer->>Timer: Countdown continues
    end

    alt Countdown expires before WiFi recovery
        Timer->>Timer: Countdown reaches 0
        Timer->>Relay: force_on()
        Note over Relay: Fans ON (fail-safe activated)
        Note over ESP32: Continue WiFi reconnect attempts<br/>(2min intervals after 5 failures)
    else WiFi recovers before countdown expires
        WiFi-->>ESP32: Connected!
        ESP32->>Server: POST /control/status
        Server-->>ESP32: shutdown_allowed=true, reset_countdown=true
        ESP32->>Timer: Reset countdown to 300s
        Note over ESP32: Normal operation resumed
    end
```

### Workflow 5: Web UI User Login and Dashboard Load

```mermaid
sequenceDiagram
    participant Browser
    participant React
    participant AuthService
    participant Server
    participant DB

    Browser->>React: Navigate to /
    React->>React: Check localStorage for token

    alt No token or expired
        React->>Browser: Redirect to /login
        Browser->>React: Render Login page
        Note over Browser: User enters credentials
        Browser->>AuthService: login(username, password)
        AuthService->>Server: POST /auth/login
        Server->>DB: Validate credentials (bcrypt)
        DB-->>Server: User record
        Server->>Server: Generate JWT token
        Server-->>AuthService: {access_token, user}
        AuthService->>AuthService: Store token in localStorage
        AuthService->>React: Update AuthContext
        React->>Browser: Redirect to /dashboard
    end

    Note over React: Dashboard component mounts
    React->>AuthService: getCurrentWeather()
    AuthService->>Server: GET /weather/current
    Server-->>AuthService: WeatherData
    AuthService-->>React: Weather data

    React->>AuthService: listBunkers()
    AuthService->>Server: GET /bunkers
    Server->>DB: Query bunkers
    DB-->>Server: Bunker list
    Server-->>AuthService: Bunker[]
    AuthService-->>React: Bunker data

    React->>React: Render Leaflet map with bunkers

    Note over React: Start polling (every 3s)
    loop Every 3 seconds
        React->>Server: GET /bunkers
        Server-->>React: Updated bunker list with status
        React->>Server: GET /weather/current
        Server-->>React: Updated weather
        React->>React: Update map markers and wind overlay
    end
```

---

## Database Schema

PostgreSQL database schema with tables, indexes, and constraints.

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- Bunkers table
CREATE TABLE bunkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    orientation_degrees DOUBLE PRECISION NOT NULL CHECK (orientation_degrees >= 0 AND orientation_degrees <= 360),
    fan_count INTEGER NOT NULL CHECK (fan_count > 0),
    wind_threshold_mph DOUBLE PRECISION CHECK (wind_threshold_mph IS NULL OR wind_threshold_mph > 0),
    electricity_cost_kwh DOUBLE PRECISION NOT NULL CHECK (electricity_cost_kwh > 0),
    fan_power_watts INTEGER NOT NULL CHECK (fan_power_watts > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bunkers_name ON bunkers(name);
CREATE INDEX idx_bunkers_location ON bunkers(latitude, longitude);

-- Devices table
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
    bunker_id UUID NOT NULL REFERENCES bunkers(id) ON DELETE CASCADE,
    fan_position INTEGER NOT NULL CHECK (fan_position > 0),
    mac_address VARCHAR(17) UNIQUE NOT NULL,
    firmware_version VARCHAR(50),
    last_seen TIMESTAMP WITH TIME ZONE,
    provisioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    led_flash_sequence INTEGER NOT NULL CHECK (led_flash_sequence >= 1 AND led_flash_sequence <= 10),
    UNIQUE(bunker_id, fan_position)
);

CREATE INDEX idx_devices_bunker ON devices(bunker_id);
CREATE INDEX idx_devices_auth_token ON devices(auth_token);
CREATE INDEX idx_devices_last_seen ON devices(last_seen);

-- Device Status table (real-time, upsert pattern)
CREATE TABLE device_status (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    relay_state VARCHAR(3) NOT NULL CHECK (relay_state IN ('ON', 'OFF')),
    uptime_seconds INTEGER NOT NULL CHECK (uptime_seconds >= 0),
    wifi_rssi INTEGER NOT NULL,
    countdown_timer_remaining INTEGER NOT NULL CHECK (countdown_timer_remaining >= 0 AND countdown_timer_remaining <= 300),
    reported_at TIMESTAMP WITH TIME ZONE NOT NULL,
    server_received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_status_received ON device_status(server_received_at);

-- Weather Data table (singleton per station, upsert pattern)
CREATE TABLE weather_data (
    station_id VARCHAR(10) PRIMARY KEY,
    wind_speed_mph DOUBLE PRECISION NOT NULL,
    wind_direction_degrees DOUBLE PRECISION NOT NULL CHECK (wind_direction_degrees >= 0 AND wind_direction_degrees <= 360),
    temperature_f DOUBLE PRECISION NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    observation_time TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Time Window Overrides table
CREATE TABLE time_window_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bunker_id UUID REFERENCES bunkers(id) ON DELETE CASCADE,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CHECK (end_time > start_time)
);

CREATE INDEX idx_overrides_bunker ON time_window_overrides(bunker_id);
CREATE INDEX idx_overrides_time_range ON time_window_overrides(start_time, end_time);
CREATE INDEX idx_overrides_created_by ON time_window_overrides(created_by);

-- Global Config table (singleton)
CREATE TABLE global_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_wind_threshold_mph DOUBLE PRECISION NOT NULL CHECK (default_wind_threshold_mph > 0),
    default_electricity_cost_kwh DOUBLE PRECISION NOT NULL CHECK (default_electricity_cost_kwh > 0),
    default_fan_power_watts INTEGER NOT NULL CHECK (default_fan_power_watts > 0),
    weather_station_id VARCHAR(10) NOT NULL,
    weather_poll_interval_seconds INTEGER NOT NULL CHECK (weather_poll_interval_seconds > 0),
    shutdown_broadcast_interval_seconds INTEGER NOT NULL CHECK (shutdown_broadcast_interval_seconds > 0),
    device_offline_threshold_seconds INTEGER NOT NULL CHECK (device_offline_threshold_seconds > 0)
);

-- Insert default global config
INSERT INTO global_config (
    id,
    default_wind_threshold_mph,
    default_electricity_cost_kwh,
    default_fan_power_watts,
    weather_station_id,
    weather_poll_interval_seconds,
    shutdown_broadcast_interval_seconds,
    device_offline_threshold_seconds
) VALUES (
    1,
    15.0,
    0.12,
    1500,
    'KOKC',
    60,
    60,
    120
);

-- Trigger to update bunkers.updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bunkers_updated_at
    BEFORE UPDATE ON bunkers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Emergency ON state (in-memory or simple flag in global_config)
-- Alternative: Add to global_config table
ALTER TABLE global_config ADD COLUMN emergency_on_global BOOLEAN DEFAULT FALSE;
ALTER TABLE bunkers ADD COLUMN emergency_on_bunker BOOLEAN DEFAULT FALSE;
```

**Migration Strategy:**

Use Alembic for database migrations:

```bash
# Initialize Alembic
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

**Database Optimization Notes:**

1. **Indexes:**
   - `devices.auth_token` indexed for fast device authentication lookups
   - `devices.last_seen` indexed for online/offline status queries
   - `time_window_overrides` time range indexed for active override checks
   - `bunkers` location indexed for future geospatial queries

2. **Constraints:**
   - CHECK constraints enforce data integrity (positive values, valid ranges)
   - UNIQUE constraints on bunker_id + fan_position prevent duplicate fan assignments
   - Foreign keys with CASCADE delete ensure data consistency

3. **Upsert Pattern:**
   - `device_status` uses PRIMARY KEY on device_id for efficient upserts
   - `weather_data` uses station_id PRIMARY KEY for singleton per station

4. **Real-Time vs Historical:**
   - POC stores only current state (no historical logs)
   - Production could add `device_status_history` table for time-series analysis

---

## Frontend Architecture

Detailed React application structure and patterns.

### Component Organization

```
web/
├── public/
│   ├── index.html
│   └── assets/
├── src/
│   ├── main.tsx                 # App entry point
│   ├── App.tsx                  # Root component with router
│   ├── components/              # Reusable UI components
│   │   ├── common/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   ├── map/
│   │   │   ├── MapView.tsx
│   │   │   ├── BunkerMarker.tsx
│   │   │   └── WindOverlay.tsx
│   │   └── bunker/
│   │       ├── FanGrid.tsx
│   │       ├── FanStatusCard.tsx
│   │       └── EnergySavingsDisplay.tsx
│   ├── pages/                   # Page-level components
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx    # Map dashboard
│   │   ├── BunkerDetailPage.tsx
│   │   ├── ProvisioningPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFoundPage.tsx
│   ├── services/                # API client services
│   │   ├── api.ts              # Axios instance with interceptors
│   │   ├── auth.service.ts
│   │   ├── bunker.service.ts
│   │   ├── device.service.ts
│   │   ├── weather.service.ts
│   │   ├── energy.service.ts
│   │   └── config.service.ts
│   ├── context/                 # React Context providers
│   │   └── AuthContext.tsx
│   ├── hooks/                   # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePoll.ts          # Generic polling hook
│   │   ├── useBunkers.ts
│   │   └── useWeather.ts
│   ├── types/                   # TypeScript type definitions
│   │   ├── api.types.ts        # Generated from OpenAPI
│   │   ├── models.ts
│   │   └── index.ts
│   ├── utils/                   # Utility functions
│   │   ├── formatters.ts       # Date, number formatting
│   │   ├── validators.ts
│   │   └── mapHelpers.ts
│   └── styles/                  # Global styles
│       └── index.css           # Tailwind imports
├── tailwind.config.js
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Component Template Example

**Standard component pattern with TypeScript:**

```typescript
// components/bunker/FanStatusCard.tsx
import React from 'react';
import { FanStatus } from '@/types';

interface FanStatusCardProps {
  fan: FanStatus;
  onClick?: () => void;
}

export const FanStatusCard: React.FC<FanStatusCardProps> = ({ fan, onClick }) => {
  const statusColor = fan.is_online
    ? (fan.relay_state === 'ON' ? 'bg-green-500' : 'bg-blue-500')
    : 'bg-red-500';

  const statusText = fan.is_online
    ? (fan.relay_state === 'ON' ? 'Running' : 'Off (Energy Saving)')
    : 'Offline';

  return (
    <div
      className={`p-4 rounded-lg ${statusColor} text-white cursor-pointer hover:opacity-90 transition`}
      onClick={onClick}
    >
      <div className="text-sm font-semibold">Fan {fan.fan_position}</div>
      <div className="text-xs mt-1">{statusText}</div>
      {fan.is_online && (
        <div className="text-xs mt-2 opacity-80">
          Signal: {fan.wifi_rssi} dBm
        </div>
      )}
    </div>
  );
};
```

### State Management Architecture

**AuthContext pattern for global state:**

```typescript
// context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthToken } from '@/types';
import * as authService from '@/services/auth.service';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      authService.getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('auth_token');
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    const response = await authService.login(username, password);
    localStorage.setItem('auth_token', response.access_token);
    setToken(response.access_token);
    setUser(response.user);
  };

  const logout = () => {
    authService.logout();
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        login,
        logout,
        loading
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

### Routing Architecture

**Route organization with protected routes:**

```typescript
// App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import BunkerDetailPage from '@/pages/BunkerDetailPage';
import ProvisioningPage from '@/pages/ProvisioningPage';
import SettingsPage from '@/pages/SettingsPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/bunkers/:bunkerId" element={<BunkerDetailPage />} />
            <Route path="/provisioning" element={<ProvisioningPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

**Protected route component:**

```typescript
// components/layout/ProtectedRoute.tsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
```

### Frontend Services Layer

**API client setup with Axios:**

```typescript
// services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

**Service example:**

```typescript
// services/bunker.service.ts
import api from './api';
import { Bunker, BunkerCreateRequest, BunkerStatus } from '@/types';

export async function listBunkers(): Promise<Bunker[]> {
  const response = await api.get<Bunker[]>('/bunkers');
  return response.data;
}

export async function getBunker(bunkerId: string): Promise<Bunker> {
  const response = await api.get<Bunker>(`/bunkers/${bunkerId}`);
  return response.data;
}

export async function createBunker(data: BunkerCreateRequest): Promise<Bunker> {
  const response = await api.post<Bunker>('/bunkers', data);
  return response.data;
}

export async function updateBunker(bunkerId: string, data: BunkerCreateRequest): Promise<Bunker> {
  const response = await api.put<Bunker>(`/bunkers/${bunkerId}`, data);
  return response.data;
}

export async function deleteBunker(bunkerId: string): Promise<void> {
  await api.delete(`/bunkers/${bunkerId}`);
}

export async function getBunkerStatus(bunkerId: string): Promise<BunkerStatus> {
  const response = await api.get<BunkerStatus>(`/bunkers/${bunkerId}/status`);
  return response.data;
}
```

### Custom Hooks

**Polling hook for real-time updates:**

```typescript
// hooks/usePoll.ts
import { useEffect, useRef } from 'react';

export function usePoll(callback: () => void, interval: number, enabled: boolean = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    // Call immediately
    savedCallback.current();

    // Then poll at interval
    const id = setInterval(() => savedCallback.current(), interval);
    return () => clearInterval(id);
  }, [interval, enabled]);
}
```

**Bunkers hook with polling:**

```typescript
// hooks/useBunkers.ts
import { useState, useCallback } from 'react';
import { usePoll } from './usePoll';
import * as bunkerService from '@/services/bunker.service';
import { Bunker } from '@/types';

export function useBunkers(pollInterval: number = 3000) {
  const [bunkers, setBunkers] = useState<Bunker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBunkers = useCallback(async () => {
    try {
      const data = await bunkerService.listBunkers();
      setBunkers(data);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePoll(fetchBunkers, pollInterval);

  return { bunkers, loading, error, refresh: fetchBunkers };
}
```

---

## Backend Architecture

Detailed FastAPI application structure and patterns.

### Service Architecture

**FastAPI project structure:**

```
server/
├── alembic/                     # Database migrations
│   ├── versions/
│   └── env.py
├── app/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Settings and environment variables
│   ├── database.py              # Database connection and session
│   ├── dependencies.py          # Dependency injection
│   ├── api/                     # API route handlers
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── bunkers.py
│   │   ├── devices.py
│   │   ├── control.py
│   │   ├── weather.py
│   │   ├── energy.py
│   │   ├── overrides.py
│   │   └── config.py
│   ├── models/                  # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── user.py
│   │   ├── bunker.py
│   │   ├── device.py
│   │   ├── device_status.py
│   │   ├── weather_data.py
│   │   ├── time_window_override.py
│   │   └── global_config.py
│   ├── schemas/                 # Pydantic request/response schemas
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── bunker.py
│   │   ├── device.py
│   │   ├── weather.py
│   │   └── config.py
│   ├── repositories/            # Database access layer
│   │   ├── __init__.py
│   │   ├── user_repository.py
│   │   ├── bunker_repository.py
│   │   ├── device_repository.py
│   │   └── config_repository.py
│   ├── services/                # Business logic
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── weather_service.py
│   │   ├── control_logic_engine.py
│   │   └── energy_calculation_service.py
│   ├── core/                    # Core utilities
│   │   ├── __init__.py
│   │   ├── security.py         # Password hashing, token generation
│   │   └── logging.py
│   └── utils/                   # Helper functions
│       └── __init__.py
├── tests/                       # Unit and integration tests
│   ├── test_auth.py
│   ├── test_control_logic.py
│   └── test_energy_calculation.py
├── requirements.txt
├── .env.example
└── README.md
```

### Controller/Route Organization

**Example route module:**

```python
# app/api/bunkers.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.bunker import BunkerCreate, BunkerResponse, BunkerStatus
from app.schemas.auth import User
from app.repositories.bunker_repository import BunkerRepository
from app.repositories.device_repository import DeviceRepository

router = APIRouter(prefix="/bunkers", tags=["bunkers"])

@router.get("/", response_model=List[BunkerResponse])
async def list_bunkers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all bunkers"""
    repo = BunkerRepository(db)
    bunkers = await repo.list()
    return bunkers

@router.post("/", response_model=BunkerResponse, status_code=201)
async def create_bunker(
    bunker_data: BunkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new bunker"""
    repo = BunkerRepository(db)
    bunker = await repo.create(bunker_data)
    return bunker

@router.get("/{bunker_id}", response_model=BunkerResponse)
async def get_bunker(
    bunker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get bunker details"""
    repo = BunkerRepository(db)
    bunker = await repo.get(bunker_id)
    if not bunker:
        raise HTTPException(status_code=404, detail="Bunker not found")
    return bunker

@router.put("/{bunker_id}", response_model=BunkerResponse)
async def update_bunker(
    bunker_id: UUID,
    bunker_data: BunkerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update bunker configuration"""
    repo = BunkerRepository(db)
    bunker = await repo.update(bunker_id, bunker_data)
    if not bunker:
        raise HTTPException(status_code=404, detail="Bunker not found")
    return bunker

@router.delete("/{bunker_id}", status_code=204)
async def delete_bunker(
    bunker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete bunker"""
    repo = BunkerRepository(db)
    success = await repo.delete(bunker_id)
    if not success:
        raise HTTPException(status_code=404, detail="Bunker not found")

@router.get("/{bunker_id}/status", response_model=BunkerStatus)
async def get_bunker_status(
    bunker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time bunker status with all fans"""
    bunker_repo = BunkerRepository(db)
    device_repo = DeviceRepository(db)

    bunker = await bunker_repo.get(bunker_id)
    if not bunker:
        raise HTTPException(status_code=404, detail="Bunker not found")

    fans = await device_repo.get_bunker_fan_status(bunker_id)

    return {
        "bunker": bunker,
        "fans": fans,
        "aggregate": {
            "total_fans": len(fans),
            "online_fans": sum(1 for f in fans if f.is_online),
            "fans_running": sum(1 for f in fans if f.is_online and f.relay_state == "ON"),
            "fans_off": sum(1 for f in fans if f.is_online and f.relay_state == "OFF")
        }
    }
```

### Data Access Layer (Repository Pattern)

```python
# app/repositories/bunker_repository.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from uuid import UUID

from app.models.bunker import Bunker
from app.schemas.bunker import BunkerCreate

class BunkerRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, bunker_data: BunkerCreate) -> Bunker:
        bunker = Bunker(**bunker_data.dict())
        self.db.add(bunker)
        await self.db.commit()
        await self.db.refresh(bunker)
        return bunker

    async def get(self, bunker_id: UUID) -> Optional[Bunker]:
        result = await self.db.execute(
            select(Bunker).where(Bunker.id == bunker_id)
        )
        return result.scalar_one_or_none()

    async def list(self) -> List[Bunker]:
        result = await self.db.execute(select(Bunker))
        return result.scalars().all()

    async def update(self, bunker_id: UUID, bunker_data: BunkerCreate) -> Optional[Bunker]:
        bunker = await self.get(bunker_id)
        if not bunker:
            return None

        for key, value in bunker_data.dict().items():
            setattr(bunker, key, value)

        await self.db.commit()
        await self.db.refresh(bunker)
        return bunker

    async def delete(self, bunker_id: UUID) -> bool:
        bunker = await self.get(bunker_id)
        if not bunker:
            return False

        await self.db.delete(bunker)
        await self.db.commit()
        return True
```

### Authentication Middleware

```python
# app/core/security.py
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from uuid import uuid4, UUID

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = "your-secret-key-here"  # Load from environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

def generate_device_token() -> UUID:
    return uuid4()
```

```python
# app/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError

from app.database import get_db
from app.core.security import decode_access_token
from app.repositories.user_repository import UserRepository
from app.repositories.device_repository import DeviceRepository
from app.schemas.auth import User
from app.models.device import Device

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Validate user JWT token"""
    try:
        token = credentials.credentials
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    repo = UserRepository(db)
    user = await repo.get(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return user

async def get_current_device(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Device:
    """Validate device UUID token"""
    token = credentials.credentials

    repo = DeviceRepository(db)
    device = await repo.get_by_auth_token(token)
    if device is None:
        raise HTTPException(status_code=401, detail="Invalid device token")

    return device
```

---

## Unified Project Structure

Complete monorepo directory structure for all three components.

```
Bunkercolab/
├── .github/
│   └── workflows/               # Future CI/CD workflows
│       └── deploy.yml.example
├── firmware/                    # ESP32 firmware (ESP-IDF)
│   ├── main/
│   │   ├── main.c              # Application entry point
│   │   ├── wifi_manager.c
│   │   ├── wifi_manager.h
│   │   ├── http_client.c
│   │   ├── http_client.h
│   │   ├── dead_man_timer.c
│   │   ├── dead_man_timer.h
│   │   ├── relay_controller.c
│   │   ├── relay_controller.h
│   │   ├── watchdog_manager.c
│   │   ├── watchdog_manager.h
│   │   ├── led_controller.c
│   │   ├── led_controller.h
│   │   ├── nvs_storage.c
│   │   ├── nvs_storage.h
│   │   └── CMakeLists.txt
│   ├── components/             # Custom ESP-IDF components
│   ├── partitions.csv          # Flash partition table
│   ├── sdkconfig              # ESP-IDF configuration
│   ├── CMakeLists.txt
│   └── README.md
├── server/                      # FastAPI backend
│   ├── alembic/
│   │   ├── versions/
│   │   ├── env.py
│   │   └── alembic.ini
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── dependencies.py
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── bunkers.py
│   │   │   ├── devices.py
│   │   │   ├── control.py
│   │   │   ├── weather.py
│   │   │   ├── energy.py
│   │   │   ├── overrides.py
│   │   │   └── config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── core/
│   │   └── utils/
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── web/                         # React frontend
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── types/
│   │   ├── utils/
│   │   └── styles/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── README.md
├── scripts/                     # Utility scripts
│   ├── deploy-server.sh        # Deploy backend to DigitalOcean
│   ├── build-web.sh            # Build React app
│   ├── setup-db.sh             # Initialize PostgreSQL
│   └── generate-types.sh       # Generate TypeScript from OpenAPI
├── docs/                        # Documentation
│   ├── prd.md
│   ├── architecture.md         # This file
│   ├── api-spec.yaml           # Full OpenAPI spec
│   └── deployment-guide.md
├── .gitignore
├── README.md
└── LICENSE
```

---

## Development Workflow

### Local Development Setup

**Prerequisites:**

```bash
# Install Node.js (v18+)
# Install Python (3.10+)
# Install PostgreSQL (14+)
# Install ESP-IDF (5.x) - for firmware development only
```

**Initial Setup:**

```bash
# Clone repository
git clone <repository-url>
cd Bunkercolab

# Setup PostgreSQL database
createdb bunkercolab_dev
psql bunkercolab_dev < scripts/setup-db.sh

# Setup backend
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with database credentials
alembic upgrade head  # Run migrations

# Setup frontend
cd ../web
npm install

# (Optional) Setup firmware - only needed for ESP32 development
cd ../firmware
# Follow ESP-IDF installation guide
idf.py set-target esp32
idf.py build
```

**Development Commands:**

```bash
# Start backend (from server/)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Start frontend (from web/)
npm run dev  # Vite dev server on port 5173

# Run backend tests
cd server && pytest

# Flash firmware to ESP32 (from firmware/)
idf.py -p /dev/ttyUSB0 flash monitor
```

### Environment Configuration

**Backend (.env):**

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/bunkercolab_dev

# Security
SECRET_KEY=<generate-secure-random-key>
ACCESS_TOKEN_EXPIRE_HOURS=24

# Weather API
WEATHER_STATION_ID=KOKC
WEATHER_POLL_INTERVAL_SECONDS=60

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Logging
LOG_LEVEL=INFO
```

**Frontend (.env.local):**

```bash
VITE_API_BASE_URL=http://localhost:8000/api/v1
```

**Firmware (sdkconfig - ESP-IDF menuconfig):**

- WiFi SSID/Password (for testing)
- Server URL (https://yourdomain.com)
- NVS partition encryption
- Watchdog timeout settings

---

## Deployment Architecture

### DigitalOcean Droplet Setup

**Droplet Specifications:**
- **Size:** Basic plan (2GB RAM / 1 vCPU) - $12/month
- **OS:** Ubuntu 24.04 LTS
- **Region:** NYC3 or SFO3 (proximity to Great Plains)
- **Firewall:** Ports 22 (SSH), 80 (HTTP), 443 (HTTPS)

**Server Components:**
- Nginx (reverse proxy, HTTPS termination, static file serving)
- FastAPI (Uvicorn ASGI server)
- PostgreSQL 14
- Certbot (Let's Encrypt SSL)

### Deployment Strategy

**Manual Deployment Process:**

1. **Initial Server Setup:**

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Update system
apt update && apt upgrade -y

# Install dependencies
apt install -y python3.10 python3-pip python3-venv postgresql nginx certbot python3-certbot-nginx git

# Create application user
adduser bunkercolab
usermod -aG sudo bunkercolab
su - bunkercolab

# Clone repository
git clone <repository-url>
cd Bunkercolab
```

2. **Setup PostgreSQL:**

```bash
sudo -u postgres psql
CREATE DATABASE bunkercolab;
CREATE USER bunkercolab_user WITH PASSWORD 'secure-password';
GRANT ALL PRIVILEGES ON DATABASE bunkercolab TO bunkercolab_user;
\q
```

3. **Deploy Backend:**

```bash
cd /home/bunkercolab/Bunkercolab/server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with production settings

# Run migrations
alembic upgrade head

# Create systemd service
sudo nano /etc/systemd/system/bunkercolab.service
```

**Systemd Service Configuration:**

```ini
[Unit]
Description=Bunker Colab FastAPI Application
After=network.target

[Service]
User=bunkercolab
Group=bunkercolab
WorkingDirectory=/home/bunkercolab/Bunkercolab/server
Environment="PATH=/home/bunkercolab/Bunkercolab/server/venv/bin"
ExecStart=/home/bunkercolab/Bunkercolab/server/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable bunkercolab
sudo systemctl start bunkercolab
```

4. **Build and Deploy Frontend:**

```bash
cd /home/bunkercolab/Bunkercolab/web
npm install
npm run build  # Creates dist/ folder

# Copy build to Nginx directory
sudo mkdir -p /var/www/bunkercolab
sudo cp -r dist/* /var/www/bunkercolab/
sudo chown -R www-data:www-data /var/www/bunkercolab
```

5. **Configure Nginx:**

```nginx
# /etc/nginx/sites-available/bunkercolab
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certificates (configured by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Serve React SPA
    location / {
        root /var/www/bunkercolab;
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to FastAPI
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # FastAPI docs (optional, disable in production for security)
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:8000/redoc;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/bunkercolab /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl reload nginx

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

6. **ESP32 Firmware Deployment:**

- Firmware is flashed directly to ESP32 devices via USB during provisioning
- Update firmware by reflashing individual devices
- For OTA updates (future): implement ESP32 OTA update mechanism

### CI/CD Pipeline (Future Enhancement)

```yaml
# .github/workflows/deploy.yml (example for future use)
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to DigitalOcean
        run: |
          ssh user@droplet 'cd /path && git pull && systemctl restart bunkercolab'

  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and deploy
        run: |
          cd web && npm install && npm run build
          scp -r dist/* user@droplet:/var/www/bunkercolab/
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|--------------|-------------|---------|
| Development | http://localhost:5173 | http://localhost:8000 | Local development |
| Staging | N/A (POC skips staging) | N/A | Pre-production testing |
| Production | https://yourdomain.com | https://yourdomain.com/api | Live environment |

---

## Security and Performance

### Security Requirements

**Frontend Security:**

- **CSP Headers:** Configured in Nginx to prevent XSS
  ```nginx
  add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
  ```

- **XSS Prevention:**
  - React auto-escapes all user input
  - Use `dangerouslySetInnerHTML` sparingly and only with sanitized content
  - Validate all user inputs

- **Secure Storage:**
  - Auth tokens in `localStorage` (acceptable for POC)
  - Production: Consider `httpOnly` cookies for enhanced security

**Backend Security:**

- **Input Validation:** Pydantic schemas validate all request bodies
  ```python
  class BunkerCreate(BaseModel):
      name: str = Field(..., min_length=1, max_length=100)
      latitude: float = Field(..., ge=-90, le=90)
      longitude: float = Field(..., ge=-180, le=180)
      # ... additional validation
  ```

- **Rate Limiting:** Not implemented in POC; production should add rate limiting middleware
  ```python
  # Future: slowapi or fastapi-limiter
  ```

- **CORS Policy:** Configured in FastAPI
  ```python
  from fastapi.middleware.cors import CORSMiddleware

  app.add_middleware(
      CORSMiddleware,
      allow_origins=["https://yourdomain.com"],  # Production
      allow_credentials=True,
      allow_methods=["*"],
      allow_headers=["*"],
  )
  ```

**Authentication Security:**

- **Token Storage:**
  - ESP32: UUID tokens in encrypted NVS partition
  - Web UI: JWT tokens in localStorage (24-hour expiry)

- **Session Management:** Stateless JWT tokens (no server-side sessions for POC)

- **Password Policy:**
  - Bcrypt hashing with default cost factor (12)
  - Min 8 characters (enforced in Pydantic schema)
  - Production: Add password complexity requirements

### Performance Optimization

**Frontend Performance:**

- **Bundle Size Target:** < 500KB gzipped
  - Vite code-splitting for route-based chunks
  - Lazy loading for map components
  - Tree-shaking removes unused code

- **Loading Strategy:**
  - React.lazy() for route components
  - Suspense boundaries with loading spinners
  - Prefetch critical data on login

- **Caching Strategy:**
  - Service worker for static assets (future enhancement)
  - React Query for server state caching (if added post-POC)
  - Polling interval optimized (3 seconds, not excessive for real-time dashboard)

**Backend Performance:**

- **Response Time Target:** < 200ms for API calls (excluding external weather API)
  - Database queries optimized with indexes
  - Async operations prevent blocking

- **Database Optimization:**
  - Indexes on frequently queried columns (device.auth_token, devices.bunker_id)
  - Connection pooling via SQLAlchemy async engine
  - Query optimization using `.select_related()` equivalent

- **Caching Strategy:**
  - Weather data cached in-memory (60-second refresh)
  - Device status uses upsert pattern (single query)
  - No Redis for POC (complexity vs benefit)

**ESP32 Performance:**

- **Memory Management:**
  - Static allocation where possible
  - Avoid dynamic allocation in interrupt handlers
  - Monitor heap usage in logs

- **Network Efficiency:**
  - Persistent HTTPS connections where possible
  - Minimize JSON payload sizes
  - 60-second poll interval balances latency vs network usage

---

## Testing Strategy

### Testing Pyramid

```
        E2E Tests (Manual)
       /                  \
    Integration Tests (Manual)
   /                          \
Backend Unit (pytest)  Frontend Unit (Manual)
```

### Test Organization

**Backend Tests:**

```
server/tests/
├── conftest.py              # Pytest fixtures
├── test_auth.py             # Authentication tests
├── test_control_logic.py    # Core business logic
├── test_energy_calculation.py
├── test_repositories.py     # Database layer tests
└── test_api/
    ├── test_bunkers.py      # API endpoint tests
    ├── test_devices.py
    └── test_control.py
```

**Frontend Tests:** Manual testing for POC

**E2E Tests:** Manual testing scenarios

### Test Examples

**Backend Unit Test:**

```python
# tests/test_control_logic.py
import pytest
from app.services.control_logic_engine import ControlLogicEngine
from app.schemas.weather import WeatherData

@pytest.fixture
def control_engine():
    return ControlLogicEngine()

@pytest.fixture
def weather_above_threshold():
    return WeatherData(
        station_id="KOKC",
        wind_speed_mph=20.0,
        wind_direction_degrees=180,
        temperature_f=70.0
    )

def test_shutdown_allowed_when_wind_above_threshold(control_engine, weather_above_threshold):
    """Test fans can shut down when wind meets threshold"""
    decision = control_engine.should_shutdown_fans(
        weather=weather_above_threshold,
        threshold_mph=15.0,
        emergency_on=False,
        time_override_active=False
    )

    assert decision.shutdown_allowed == True
    assert decision.reason == "wind_conditions_favorable"

def test_shutdown_not_allowed_in_emergency_mode(control_engine, weather_above_threshold):
    """Test fans forced ON during emergency mode"""
    decision = control_engine.should_shutdown_fans(
        weather=weather_above_threshold,
        threshold_mph=15.0,
        emergency_on=True,
        time_override_active=False
    )

    assert decision.shutdown_allowed == False
    assert decision.reason == "emergency_on"
```

**Manual E2E Test Scenario:**

1. **Device Provisioning Flow:**
   - Create bunker via Web UI
   - Provision ESP32 device
   - Copy auth token to ESP32
   - Verify device appears online in Web UI

2. **Normal Operation:**
   - Monitor weather data updates (60s intervals)
   - Observe fan status changes based on wind
   - Verify energy savings calculations

3. **Emergency Scenarios:**
   - Trigger emergency ON from Web UI
   - Verify all fans activate within 60 seconds
   - Disconnect WiFi from ESP32
   - Verify fail-safe activates (countdown expires → fans ON)

---

## Coding Standards

### Critical Fullstack Rules

- **Type Sharing:** Generate TypeScript types from FastAPI OpenAPI spec using `openapi-typescript` - never duplicate type definitions manually

- **API Calls:** Frontend must use service layer functions, never make direct axios calls from components

- **Environment Variables:** Access via config objects (`import.meta.env` in Vite, `Config` class in FastAPI), never `process.env` directly

- **Error Handling:** All FastAPI routes use HTTPException for errors; frontend displays user-friendly messages

- **State Updates:** React state updates use setState/hooks, never direct mutation

- **Async/Await:** Always use async/await for asynchronous operations, avoid `.then()` chains

- **Database Transactions:** Repository methods commit or rollback within method scope, don't leak transactions

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `UserProfile.tsx` |
| Hooks | camelCase with 'use' | - | `useAuth.ts` |
| Services | camelCase | snake_case | `authService.ts` / `auth_service.py` |
| API Routes | - | kebab-case | `/api/bunkers/{bunker-id}` |
| Database Tables | - | snake_case | `time_window_overrides` |
| TypeScript Interfaces | PascalCase | - | `interface BunkerStatus` |
| Pydantic Models | PascalCase | - | `class BunkerCreate` |

---

## Error Handling Strategy

### Error Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant Backend
    participant Database

    Frontend->>Backend: API Request
    Backend->>Database: Query
    Database-->>Backend: Error (e.g., constraint violation)
    Backend->>Backend: Catch exception
    Backend-->>Frontend: HTTP 400 + JSON error
    Frontend->>Frontend: Catch in service layer
    Frontend->>Frontend: Display toast notification
```

### Error Response Format

```typescript
interface ApiError {
  detail: string;  // FastAPI default format
  // Example: "Bunker not found"
}
```

### Frontend Error Handling

```typescript
// services/bunker.service.ts
import { toast } from 'react-toastify';  // or similar

export async function getBunker(bunkerId: string): Promise<Bunker> {
  try {
    const response = await api.get<Bunker>(`/bunkers/${bunkerId}`);
    return response.data;
  } catch (error: any) {
    const message = error.response?.data?.detail || 'Failed to fetch bunker';
    toast.error(message);
    throw error;
  }
}
```

### Backend Error Handling

```python
# app/api/bunkers.py
from fastapi import HTTPException

@router.get("/{bunker_id}")
async def get_bunker(bunker_id: UUID, db: AsyncSession = Depends(get_db)):
    repo = BunkerRepository(db)
    bunker = await repo.get(bunker_id)

    if not bunker:
        raise HTTPException(status_code=404, detail="Bunker not found")

    return bunker

# Global exception handler for unexpected errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
```

---

## Monitoring and Observability

### Monitoring Stack

- **Frontend Monitoring:** Browser console logging for POC; production could add Sentry
- **Backend Monitoring:** Python logging module with file + stdout output
- **Error Tracking:** Log files for POC; production could add Sentry or similar
- **Performance Monitoring:** Manual observation for POC; production could add Prometheus + Grafana

### Key Metrics

**Frontend Metrics:**
- Page load time (manual browser dev tools)
- API call latency (network tab)
- JavaScript errors (console)

**Backend Metrics:**
- Request rate (logs)
- Error rate (logs)
- Response time (logs with timestamps)
- Database query performance (SQLAlchemy logging)

**ESP32 Metrics:**
- Uptime (reported in status)
- WiFi signal strength (reported in status)
- Countdown timer state (reported in status)
- Watchdog resets (serial logs)

### Logging Configuration

**Backend:**

```python
# app/core/logging.py
import logging
import sys

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('bunkercolab.log')
        ]
    )

# app/main.py
from app.core.logging import setup_logging

setup_logging()
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def startup_event():
    logger.info("Bunker Colab API starting...")
```

**ESP32:**

```c
// main/main.c
#define TAG "BUNKERCOLAB"

void app_main() {
    ESP_LOGI(TAG, "Bunker Colab Firmware starting...");
    ESP_LOGI(TAG, "Firmware version: %s", FIRMWARE_VERSION);

    // Configure log levels
    esp_log_level_set("*", ESP_LOG_INFO);
    esp_log_level_set("wifi", ESP_LOG_WARN);
}
```

---

## Summary

This architecture document provides comprehensive guidance for building the Bunker Colab grain bunker fan control system. The design prioritizes:

1. **Safety First:** Fail-safe dead-man timer architecture ensures fans default to ON in any failure scenario
2. **Simplicity:** POC-appropriate technology choices avoid over-engineering
3. **Clarity:** Clear separation of concerns across frontend, backend, and firmware
4. **Maintainability:** Repository patterns, type safety, and consistent conventions

**Implementation Priority:**

1. **Phase 1 (Epic 1):** Database schema, authentication, basic API structure
2. **Phase 2 (Epic 2):** ESP32 firmware, dead-man timer, control logic engine, weather integration
3. **Phase 3 (Epics 3-4):** Web UI dashboard, bunker visualization, energy tracking
4. **Phase 4 (Epic 5):** Time overrides, LED identification, deployment tooling

**Key Success Factors:**

- Rigorous testing of fail-safe behavior (WiFi loss, server failure scenarios)
- Clear documentation for operators during deployment
- Monitoring of real-world performance to validate energy savings calculations

---

**Document Maintenance:**

This architecture document should be updated when:
- Technology choices change
- New major features are added beyond POC scope
- Production deployment requires architectural changes
- Post-POC evaluation identifies needed improvements

