# Unified Project Structure

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
