# 1. ESP-IDF Project Structure

## Recommended Directory Layout

```
bunker-control-firmware/
├── CMakeLists.txt                 # Top-level CMake configuration
├── sdkconfig                      # Project configuration (generated)
├── sdkconfig.defaults            # Default configuration values
├── partitions.csv                # Custom partition table
├── README.md
├── main/                         # Main application component
│   ├── CMakeLists.txt
│   ├── main.c
│   ├── Kconfig.projbuild        # Project-specific menu options
│   └── idf_component.yml        # Component dependencies
├── components/                   # Custom reusable components
│   ├── fan_control/
│   │   ├── CMakeLists.txt
│   │   ├── include/
│   │   │   └── fan_control.h
│   │   ├── src/
│   │   │   └── fan_control.c
│   │   └── test/               # Component-specific tests
│   ├── wifi_manager/
│   ├── api_client/
│   ├── safety_monitor/
│   └── led_controller/
├── docs/                        # Documentation
├── test/                        # Integration tests
└── tools/                       # Build and deployment scripts
```

## Key Principles

**Component-Based Architecture:**
- ESP-IDF projects are an amalgamation of components compiled into static libraries
- Each component should be modular and have clear interfaces
- Public headers go in `include/`, implementation in `src/`
- Use `idf_component.yml` for dependency management (ESP-IDF v4.1+)

**Configuration Management:**
- Use `sdkconfig.defaults` for version-controlled defaults
- Project-specific menu options via `Kconfig.projbuild`
- Never commit the auto-generated `sdkconfig` file
- Use `idf.py menuconfig` for interactive configuration

**Official Documentation:**
- Build System Guide: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/build-system.html

---
