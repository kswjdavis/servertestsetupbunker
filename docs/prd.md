# Grain Bunker Fan Control System Product Requirements Document (PRD)

## Goals and Background Context

### Goals

- Achieve measurable energy cost savings by automatically controlling grain bunker fans based on favorable wind conditions
- Maintain fail-safe operation that defaults to "all fans ON" in any failure scenario to protect tarps
- Provide reliable uptime adequate to realize significant energy savings
- Enable operators to configure wind speed thresholds via web UI to match their risk tolerance for tarp security
- Allow operators to set time-window overrides to force fans ON when needed
- Track real-time device uptime and fan off-time to quantify energy savings
- Support multiple controllers (potentially one per fan) with robust provisioning system
- Provide visual device identification via LED flash sequences for deployment and troubleshooting
- Deliver a robust POC/demonstrator that proves the concept and serves as foundation for future feature expansion
- Establish API-based control architecture to enable future feature additions (grain quality monitoring, additional weather factors)

### Background Context

Grain bunker fans currently run continuously because ground pile tarps are secured solely by vacuum pressure from the fans. In the Great Plains, high and variable winds make tarp security critical - any loss of vacuum can result in tarp loss and grain exposure. While an anemometer-based alternative exists for controlling fans, it's inadequate because variable wind patterns don't provide consistent pressure differential to maintain tarp security.

This system addresses the energy waste of continuous fan operation by intelligently shutting down fans when wind conditions are favorable, while maintaining an uncompromising safety posture. The architecture uses a dead-man timer approach: the server must actively broadcast "shutdown allowed" commands every 60 seconds, and each ESP32 controller maintains a 5-minute countdown timer while also managing a hardware watchdog device. If communication is lost or the server fails, fans automatically return to the ON state. Relays are normally closed (fans ON by default), ensuring any electrical or control failure results in the safest state. This POC focuses exclusively on wind-based control; future versions will address grain quality factors like temperature and humidity.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-10-21 | 0.1 | Initial draft | John (PM) |

---

## Requirements

### Functional Requirements

**Server & Backend (Cloud Deployment - DigitalOcean):**
- FR1: System shall fetch wind speed and direction data from aviation weather.gov API at configurable intervals
- FR2: Server shall broadcast "shutdown allowed" command to all provisioned devices every 60 seconds when wind conditions meet or exceed user-configured thresholds
- FR3: Server shall provide REST API endpoints for device provisioning, status queries, and control commands
- FR4: Server shall track and calculate real-time device uptime for all provisioned controllers
- FR5: Server shall track fan off-time and calculate energy savings based on user-configured electricity cost ($/kWh) and fan power consumption
- FR6: Server shall maintain registry of all provisioned ESP32 controllers with unique identifiers, authentication tokens, and bunker/fan position assignments
- FR7: Server shall store bunker configurations including location (GPS coordinates), orientation, and fan layout
- FR8: Server shall provide secure HTTPS cloud endpoints accessible over internet for ESP32 devices and web UI
- FR9: Server shall generate unique UUID-based authentication tokens during device provisioning
- FR10: Server shall validate device authentication tokens on every API request before processing commands

**ESP32 Controller (Edge Device - Jeff's Work):**
- FR11: ESP32 shall support WiFi configuration via provisioning wizard (AP mode with captive portal or similar)
- FR12: ESP32 shall store WiFi credentials and authentication token in non-volatile flash memory
- FR13: ESP32 shall connect to cloud server via HTTPS using provisioned credentials and device authentication token
- FR14: ESP32 shall implement WiFi reconnection strategy: retry every 30 seconds for first 5 attempts, then every 2 minutes
- FR15: ESP32 shall validate server TLS certificate during HTTPS connection
- FR16: ESP32 shall include authentication token in HTTP Authorization header for all API requests
- FR17: ESP32 shall maintain 5-minute dead-man countdown timer that resets on receipt of valid "shutdown allowed" command from cloud server
- FR18: ESP32 shall control relay to turn fans OFF only when countdown timer is actively running and conditions permit
- FR19: ESP32 shall return relay to ON state (fans running) when countdown timer expires, WiFi connection is lost, or server authentication fails
- FR20: ESP32 shall control hardware watchdog device to ensure system reliability
- FR21: ESP32 shall use normally-closed relay configuration (fans ON by default)
- FR22: ESP32 shall display unique LED flash sequence for device identification during deployment and troubleshooting
- FR23: ESP32 shall report status to cloud server (uptime, connection state, relay state, WiFi signal strength) at regular intervals

**Web UI (Will's Work):**
- FR24: Web UI shall provide device provisioning wizard to configure and register new ESP32 controllers (generate auth tokens, assign IDs, assign to bunker/fan position)
- FR25: Web UI shall provide WiFi setup wizard to configure ESP32 network credentials
- FR26: Web UI shall display geographic map showing all bunker locations with status indicators
- FR27: Web UI shall display current wind speed and direction overlaid on map view
- FR28: Web UI shall provide individual bunker detail pages with visual diagram of fan positions/layout
- FR29: Web UI shall display real-time fan status (on/off, online/offline) on bunker diagrams
- FR30: Web UI shall display wind direction and speed relative to bunker orientation on bunker detail pages
- FR31: Web UI shall allow operators to configure bunker locations (GPS coordinates or map placement)
- FR32: Web UI shall allow operators to configure bunker fan layout (number of fans, positions in diagram)
- FR33: Web UI shall allow operators to configure wind speed thresholds for automatic fan control (global or per-bunker)
- FR34: Web UI shall allow operators to configure electricity cost ($/kWh) for energy savings calculations
- FR35: Web UI shall allow operators to configure fan power consumption (watts) for energy savings calculations
- FR36: Web UI shall allow operators to configure time-window overrides to force fans ON during specified periods
- FR37: Web UI shall display aggregate energy savings per bunker and system-wide totals
- FR38: Web UI shall provide emergency ON switch to immediately activate all fans in a bunker from bunker detail page
- FR39: Web UI shall provide global emergency ON switch to activate all fans across all bunkers
- FR40: Web UI shall generate printable deployment guide showing bunker layouts, device IDs, and LED flash patterns

### Non-Functional Requirements

- NFR1: System shall default to fail-safe state (all fans ON) in any failure scenario including WiFi loss, internet connectivity loss, cloud server failure, authentication failure, or software crash
- NFR2: System shall maintain adequate uptime to achieve measurable energy cost savings (target: 95%+ availability)
- NFR3: System architecture shall support future feature expansion through API-based control without requiring core redesign
- NFR4: System shall be designed as robust POC/demonstrator quality, not enterprise-production grade
- NFR5: ESP32 firmware shall implement watchdog timer protection against software hangs
- NFR6: System shall support multiple ESP32 controllers operating independently (potentially one per fan)
- NFR7: Web UI shall be accessible from standard web browsers without requiring mobile app installation
- NFR8: System shall operate in real-time only without requirement for historical data storage (POC scope)
- NFR9: All cloud server and ESP32 communication shall use HTTPS/TLS with server certificate validation
- NFR10: Device authentication shall use unique token-based approach with tokens stored securely on ESP32
- NFR11: System shall handle intermittent WiFi/internet connectivity gracefully with automatic reconnection
- NFR12: Cloud server shall be hosted on DigitalOcean infrastructure

---

## User Interface Design Goals

### Overall UX Vision

The web interface should be utilitarian and operator-focused - think "industrial control panel" rather than consumer application. The interface uses visual representations to provide spatial context: a map view shows bunker locations, and individual bunker pages display fan layouts with real-time status. Operators need quick access to critical information (fan status, weather conditions, energy savings) and must be able to respond to emergencies immediately. The interface should work on both desktop and tablet devices commonly found in agricultural operations. Prioritize clarity, large touch targets, and high-contrast design for visibility in various lighting conditions (office, mobile devices in field).

### Key Interaction Paradigms

- **Map-Based Navigation**: Landing page shows geographic map with bunker locations and status indicators
- **Visual Bunker Diagrams**: Each bunker page displays schematic showing individual fan positions and states
- **Contextual Wind Visualization**: Wind speed and direction displayed relative to bunker orientation on map and bunker detail views
- **Big Button Emergency Controls**: Emergency ON switch must be prominent and unmistakable on all views
- **Wizard-Based Setup**: Device provisioning and WiFi configuration use step-by-step wizards to reduce operator errors
- **Real-Time Updates**: Status information updates automatically without page refresh (WebSocket or polling)
- **Drill-Down Navigation**: Map → Bunker Detail → Individual Fan/Device

### Core Screens and Views

1. **Map Dashboard (Landing Page)** - Geographic map showing all bunker locations with status indicators (color-coded by operational state), current wind data overlaid with direction arrows and speed
2. **Bunker Detail Page** - Individual bunker view with:
   - Visual diagram of bunker showing fan positions/layout
   - Real-time status of each fan (on/off, device online/offline)
   - Wind direction and speed relative to bunker orientation
   - Aggregate energy savings for this bunker
   - Emergency ON button for all fans in this bunker
3. **Device Provisioning Wizard** - Multi-step flow to add new ESP32 controllers and assign to bunkers/fan positions
4. **WiFi Setup Wizard** - Configure network credentials for devices
5. **Settings/Configuration** - Set wind thresholds, electricity cost, fan wattage, time-window overrides (global or per-bunker)
6. **Device Details View** - Individual device/fan status, uptime, signal strength, LED flash pattern
7. **Deployment Guide Generator** - Printable reference showing bunker layouts, device IDs, and LED patterns

### Accessibility

**WCAG AA Compliance** - Basic accessibility for operators with varying technical literacy and potential vision/motor limitations. Ensure sufficient color contrast, keyboard navigation, and screen reader support for critical functions. Map and visual diagrams should include text alternatives.

### Branding

**Functional Agricultural Aesthetic** - Clean, professional interface with earth tones or neutral color palette. Use clear typography optimized for readability. Status indicators should use universally understood colors (green=operational/fans on, red=alert/offline, yellow=warning, blue=fans off/energy saving mode). Wind visualization uses industry-standard conventions (arrows for direction, speed indicators).

### Target Device and Platforms

**Web Responsive (Desktop & Tablet Primary)** - Optimized for desktop browsers and tablet devices (iPad-sized and larger). Mobile phone support is secondary but should remain usable for emergency access. No native app required - standard web technologies only.

---

## Technical Assumptions

### Repository Structure

**Monorepo** - Single repository containing three main components:
- `/firmware` - ESP32 embedded code using ESP-IDF (Jeff's work)
- `/server` - FastAPI backend API and services (Shared work)
- `/web` - React web UI frontend (Will's work)

**Rationale:** For a small POC team (2 developers), monorepo simplifies versioning, deployment coordination, and ensures API contract consistency between frontend/backend.

### Service Architecture

**Monolith Backend + Separate Embedded Firmware** - Single FastAPI application serving both REST API endpoints and static React build, with independent ESP32 firmware built on ESP-IDF.

**Components:**
- FastAPI backend handles weather API integration, device registry, control logic, authentication
- React SPA served as static files from FastAPI
- PostgreSQL database for device registry, bunker configurations, and operational data
- ESP-IDF firmware on ESP32-DevKitC-VIE controllers

**Rationale:** POC scope doesn't justify microservices complexity. Monolithic backend simplifies deployment on DigitalOcean Droplet, reduces infrastructure costs, and allows both Jeff and Will to work in same repository for shared backend work.

### Testing Requirements

**Unit Testing + Manual Integration Testing**
- Backend: pytest for FastAPI endpoints, business logic (weather decision engine, energy calculations, authentication)
- ESP32: ESP-IDF unit testing framework for critical firmware logic (dead-man timer, watchdog, fail-safe behavior)
- Frontend: Manual testing for React components and user workflows
- Integration: Manual end-to-end testing of ESP32-to-server communication and UI interactions

**Rationale:** POC scope prioritizes working demonstrator over comprehensive test coverage. Focus automated tests on safety-critical logic. Manual testing adequate for UI and integration scenarios.

### Technology Stack (FINALIZED)

**ESP32 Firmware (Jeff's Work):**
- **Framework**: ESP-IDF (Espressif IoT Development Framework)
- **Language**: C/C++
- **Development Environment**: ESP-IDF with CMake build system
- **Key Components**:
  - esp_http_client (HTTPS REST API communication)
  - esp_tls (TLS/SSL support for HTTPS)
  - cJSON (JSON parsing)
  - NVS (non-volatile storage for WiFi credentials and auth token)
  - Hardware watchdog timer APIs
  - WiFi provisioning manager (for AP mode captive portal)
  - SNTP (time synchronization for accurate timer management)
- **Board**: ESP32-DevKitC-VIE

**Backend Server (Shared Work - Jeff & Will):**
- **Framework**: FastAPI (Python 3.10+)
- **Language**: Python
- **Key Libraries**:
  - fastapi - Web framework
  - uvicorn - ASGI server
  - sqlalchemy - ORM for PostgreSQL
  - pydantic - Data validation and settings
  - httpx or requests - Aviation weather.gov API client
  - python-jose - JWT/token handling
  - pytest - Unit testing
- **Database**: PostgreSQL (version 14+)
- **API Documentation**: Auto-generated by FastAPI (Swagger/OpenAPI)

**Web UI Frontend (Will's Work):**
- **Framework**: React 18+
- **Language**: JavaScript/TypeScript (recommend TypeScript for type safety)
- **Mapping**: Leaflet.js (open-source, no API key required)
- **CSS Framework**: Tailwind CSS (utility-first, rapid development)
- **State Management**: React Context API or simple prop drilling (Redux/Zustand if complexity grows)
- **HTTP Client**: fetch API or axios for backend communication
- **Real-Time Updates**: Polling with setInterval (2-5 second refresh rate)
- **Build Tool**: Vite or Create React App
- **Testing**: Manual testing for POC scope

### Deployment Strategy

**DigitalOcean Droplet (Manual Deployment)**

**Server Setup:**
- Ubuntu 22.04 LTS Droplet
- Nginx reverse proxy (handle HTTPS, serve React static files, proxy API to FastAPI)
- Let's Encrypt SSL certificate (via certbot)
- FastAPI running as systemd service with uvicorn
- PostgreSQL installed on same droplet (or separate managed database for production-readiness)
- Environment variables managed via .env file or systemd service config

**Deployment Process:**
- Git clone repository to droplet
- Build React frontend (`npm run build`)
- Copy React build to Nginx static directory
- Install Python dependencies via pip/virtualenv
- Configure systemd service for FastAPI
- Nginx configuration for routing (/ → React SPA, /api/* → FastAPI backend)

**Rationale:** Manual droplet provides full control, lower cost than managed services, and educational value for POC development. Team can iterate quickly with direct server access.

### Additional Technical Assumptions

- **Aviation Weather.gov API**: RESTful, requires User-Agent header, no API key needed, rate limits apply (cache responses to minimize requests)
- **LED Flash Patterns**: Simple sequential flashing (1 flash = device 1, 2 flashes = device 2, etc.) implemented via GPIO control in ESP-IDF
- **WiFi Provisioning**: ESP32 AP mode with captive portal using ESP-IDF WiFi provisioning manager
- **Authentication Tokens**: UUID4 tokens generated by FastAPI, stored in PostgreSQL and ESP32 NVS flash memory
- **TLS Certificates**: Let's Encrypt via certbot on Nginx, ESP32 validates server certificate using root CA bundle
- **Time Synchronization**: ESP32 uses SNTP (Simple Network Time Protocol) for accurate dead-man timer management
- **Error Logging**:
  - Server: Python logging module to file + stdout
  - ESP32: ESP-IDF logging framework (ESP_LOG) via serial and potentially remote logging
- **API Versioning**: /api/v1/* for future compatibility
- **CORS**: FastAPI configured to allow React frontend origin during development, locked down for production

---
