#!/usr/bin/env python3
"""
Raspberry Pi monitor for the Bunkercolab ESP32 DevKitC.
"""

from __future__ import annotations

import glob
import json
import logging
import os
import queue
import re
import signal
import sqlite3
import subprocess
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import psutil
import serial
from serial import SerialException
from serial.tools import list_ports
import yaml

try:
    from gpiozero import DigitalInputDevice
except ImportError:  # pragma: no cover - GPIO not available off target
    DigitalInputDevice = None  # type: ignore


DEFAULT_CONFIG_PATH = "pi_monitor_config.yaml"
SERIAL_PATTERN = re.compile(r"^([EWIDV]) \((\d+)\) ([^:]+): (.*)$")


def load_config(path: str) -> dict:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Configuration file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    return cfg


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat() + "Z"


class DataStore:
    def __init__(self, sqlite_path: Path):
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(sqlite_path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL;")
        self._conn.execute("PRAGMA synchronous=NORMAL;")
        self._lock = threading.Lock()
        self._last_vacuum = datetime.now(timezone.utc)
        self._init_schema()

    def _init_schema(self) -> None:
        schema = [
            """
            CREATE TABLE IF NOT EXISTS serial_logs (
                id INTEGER PRIMARY KEY,
                recorded_at TEXT NOT NULL,
                level TEXT,
                tag TEXT,
                message TEXT,
                raw_line TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS gpio_events (
                id INTEGER PRIMARY KEY,
                recorded_at TEXT NOT NULL,
                pin INTEGER NOT NULL,
                state INTEGER NOT NULL,
                source TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS system_metrics (
                id INTEGER PRIMARY KEY,
                recorded_at TEXT NOT NULL,
                cpu_temp_c REAL,
                load_1m REAL,
                mem_used_percent REAL,
                disk_free_mb REAL,
                wifi_rssi_dbm INTEGER,
                uptime_seconds INTEGER
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS heartbeats (
                id INTEGER PRIMARY KEY,
                recorded_at TEXT NOT NULL,
                serial_connected INTEGER NOT NULL,
                gpio_ok INTEGER NOT NULL,
                notes TEXT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS esp32_telemetry (
                id INTEGER PRIMARY KEY,
                recorded_at TEXT NOT NULL,
                free_heap_bytes INTEGER,
                wifi_rssi INTEGER,
                countdown_timer_remaining INTEGER,
                uptime_seconds INTEGER
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS esp32_reboots (
                id INTEGER PRIMARY KEY,
                detected_at TEXT NOT NULL,
                reset_reason TEXT,
                uptime_before_reboot INTEGER,
                watchdog_reset_count INTEGER,
                notes TEXT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS network_failures (
                id INTEGER PRIMARY KEY,
                failure_at TEXT NOT NULL,
                failure_type TEXT NOT NULL,
                error_message TEXT,
                tag TEXT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS relay_operations (
                id INTEGER PRIMARY KEY,
                state_change_at TEXT NOT NULL,
                new_state INTEGER NOT NULL,
                triggered_by TEXT,
                notes TEXT,
                duration_seconds INTEGER
            )
            """,
        ]
        with self._lock:
            cur = self._conn.cursor()
            for stmt in schema:
                cur.execute(stmt)
            self._conn.commit()

    def record_serial(self, recorded_at: str, level: Optional[str], tag: Optional[str],
                      message: Optional[str], raw_line: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO serial_logs (recorded_at, level, tag, message, raw_line) "
                "VALUES (?, ?, ?, ?, ?)",
                (recorded_at, level, tag, message, raw_line),
            )
            self._conn.commit()

    def record_gpio(self, recorded_at: str, pin: int, state: int, source: str) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO gpio_events (recorded_at, pin, state, source) "
                "VALUES (?, ?, ?, ?)",
                (recorded_at, pin, state, source),
            )
            self._conn.commit()

    def record_metrics(self, recorded_at: str, cpu_temp_c: Optional[float],
                       load_1m: Optional[float], mem_used_percent: Optional[float],
                       disk_free_mb: Optional[float], wifi_rssi_dbm: Optional[int],
                       uptime_seconds: Optional[int]) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO system_metrics (recorded_at, cpu_temp_c, load_1m, mem_used_percent, "
                "disk_free_mb, wifi_rssi_dbm, uptime_seconds) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (recorded_at, cpu_temp_c, load_1m, mem_used_percent,
                 disk_free_mb, wifi_rssi_dbm, uptime_seconds),
            )
            self._conn.commit()

    def record_heartbeat(self, recorded_at: str, serial_connected: bool,
                         gpio_ok: bool, notes: str = "") -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO heartbeats (recorded_at, serial_connected, gpio_ok, notes) "
                "VALUES (?, ?, ?, ?)",
                (recorded_at, int(serial_connected), int(gpio_ok), notes or None),
            )
            self._conn.commit()

    def record_telemetry(self, recorded_at: str, free_heap: Optional[int],
                         wifi_rssi: Optional[int], countdown_timer: Optional[int],
                         uptime: Optional[int]) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO esp32_telemetry (recorded_at, free_heap_bytes, wifi_rssi, "
                "countdown_timer_remaining, uptime_seconds) VALUES (?, ?, ?, ?, ?)",
                (recorded_at, free_heap, wifi_rssi, countdown_timer, uptime),
            )
            self._conn.commit()

    def record_reboot(self, detected_at: str, reset_reason: Optional[str],
                      uptime_before: Optional[int], watchdog_count: Optional[int],
                      notes: str = "") -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO esp32_reboots (detected_at, reset_reason, uptime_before_reboot, "
                "watchdog_reset_count, notes) VALUES (?, ?, ?, ?, ?)",
                (detected_at, reset_reason, uptime_before, watchdog_count, notes or None),
            )
            self._conn.commit()

    def record_network_failure(self, failure_at: str, failure_type: str,
                                error_message: str, tag: Optional[str] = None) -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO network_failures (failure_at, failure_type, error_message, tag) "
                "VALUES (?, ?, ?, ?)",
                (failure_at, failure_type, error_message, tag),
            )
            self._conn.commit()

    def record_relay_operation(self, state_change_at: str, new_state: int,
                                triggered_by: Optional[str] = None, notes: str = "") -> None:
        with self._lock:
            self._conn.execute(
                "INSERT INTO relay_operations (state_change_at, new_state, triggered_by, notes) "
                "VALUES (?, ?, ?, ?)",
                (state_change_at, new_state, triggered_by, notes or None),
            )
            self._conn.commit()

    def get_last_relay_state(self) -> Optional[int]:
        """Get the last recorded relay state to detect actual changes."""
        with self._lock:
            cur = self._conn.execute(
                "SELECT new_state FROM relay_operations "
                "ORDER BY state_change_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            return row[0] if row else None

    def get_last_relay_change_time(self) -> Optional[str]:
        """Get the timestamp of the last relay state change."""
        with self._lock:
            cur = self._conn.execute(
                "SELECT state_change_at FROM relay_operations "
                "ORDER BY state_change_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            return row[0] if row else None

    def update_last_relay_duration(self, duration_seconds: int) -> None:
        """Update the duration of the last relay state."""
        with self._lock:
            self._conn.execute(
                "UPDATE relay_operations SET duration_seconds = ? "
                "WHERE id = (SELECT id FROM relay_operations ORDER BY state_change_at DESC LIMIT 1)",
                (duration_seconds,)
            )
            self._conn.commit()

    def get_last_uptime(self) -> Optional[int]:
        """Get the last recorded uptime value for reboot detection."""
        with self._lock:
            cur = self._conn.execute(
                "SELECT uptime_seconds FROM esp32_telemetry "
                "ORDER BY recorded_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            return row[0] if row else None

    def vacuum_if_needed(self, interval_days: int) -> None:
        if interval_days <= 0:
            return
        now = datetime.now(timezone.utc)
        if now - self._last_vacuum < timedelta(days=interval_days):
            return
        with self._lock:
            logging.info("Running SQLite VACUUM")
            self._conn.execute("VACUUM")
            self._conn.commit()
        self._last_vacuum = now

    def close(self) -> None:
        with self._lock:
            self._conn.close()


class RawSerialLogger:
    def __init__(self, log_dir: Path, prefix: str, max_file_mb: int):
        self._log_dir = log_dir
        self._prefix = prefix
        self._max_bytes = max(1, max_file_mb) * 1024 * 1024
        self._lock = threading.Lock()
        self._current_date = ""
        self._sequence = 0
        self._file = None
        self._force_rotate = False
        self._log_dir.mkdir(parents=True, exist_ok=True)

    def request_rotation(self) -> None:
        with self._lock:
            self._force_rotate = True

    def _build_path(self, date_str: str) -> Path:
        suffix = f"-{self._sequence}" if self._sequence else ""
        filename = f"{self._prefix}-{date_str}{suffix}.jsonl"
        return self._log_dir / filename

    def _open_if_needed(self, now: datetime) -> None:
        date_str = now.strftime("%Y%m%d")
        target_seq = self._sequence
        reopen = False

        if date_str != self._current_date:
            self._current_date = date_str
            self._sequence = 0
            reopen = True
        if self._file is None:
            reopen = True
        else:
            size = self._file.tell()
            if size >= self._max_bytes or self._force_rotate:
                self._sequence += 1
                reopen = True
        if reopen:
            if self._file:
                self._file.close()
            path = self._build_path(self._current_date)
            self._file = open(path, "a", encoding="utf-8")
            self._force_rotate = False

    def write(self, record: dict) -> None:
        now = datetime.now(timezone.utc)
        with self._lock:
            self._open_if_needed(now)
            if self._file:
                self._file.write(json.dumps(record, ensure_ascii=False) + "\n")
                self._file.flush()

    def close(self) -> None:
        with self._lock:
            if self._file:
                self._file.close()
                self._file = None


def find_serial_device(device_glob: str) -> Optional[str]:
    matches = sorted(glob.glob(device_glob))
    if matches:
        return matches[0]
    for port in list_ports.comports():
        desc = (port.description or "").lower()
        hw = (port.hardware_id or "").lower()
        if "esp32" in desc or "cp210" in desc or "ch340" in desc or "ftdi" in desc:
            return port.device
    return None


def parse_serial_line(line: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
    match = SERIAL_PATTERN.match(line)
    if not match:
        return None, None, None
    level, _ticks, tag, message = match.groups()
    return level, tag, message


class SerialWorker(threading.Thread):
    def __init__(self, config: dict, datastore: DataStore,
                 raw_logger: RawSerialLogger, stop_event: threading.Event):
        super().__init__(daemon=True)
        self._cfg = config
        self._datastore = datastore
        self._raw_logger = raw_logger
        self._stop_event = stop_event
        self._serial = None
        self._connected = threading.Event()
        self._last_uptime = None

    def is_connected(self) -> bool:
        return self._connected.is_set()

    def _connect(self) -> None:
        device = find_serial_device(self._cfg.get("device_glob", "/dev/ttyUSB*"))
        if not device:
            logging.warning("No serial device matched glob %s", self._cfg.get("device_glob"))
            self._connected.clear()
            return
        baud = int(self._cfg.get("baud_rate", 115200))
        timeout = 1
        try:
            self._serial = serial.Serial(device, baud, timeout=timeout)
            self._connected.set()
            logging.info("Connected to serial device %s @ %s", device, baud)
        except SerialException as exc:
            logging.error("Failed to open serial port %s: %s", device, exc)
            self._connected.clear()
            self._serial = None

    def _disconnect(self) -> None:
        if self._serial:
            try:
                self._serial.close()
            except Exception:
                pass
        self._serial = None
        self._connected.clear()

    def _parse_enhanced_metrics(self, recorded_at: str, level: Optional[str],
                                 tag: Optional[str], message: Optional[str]) -> None:
        """Parse and record enhanced metrics for long-term monitoring."""
        if not tag or not message:
            return

        try:
            # Parse heap memory (from main component status reports)
            if tag == "main" and "Free heap:" in message:
                parts = message.split("Free heap:")
                if len(parts) > 1:
                    heap_str = parts[1].strip().split()[0]
                    free_heap = int(heap_str)
                    # Store in telemetry (other fields will be NULL for now)
                    self._datastore.record_telemetry(recorded_at, free_heap, None, None, None)

            # Detect reboots via boot messages or watchdog reset count
            elif tag == "boot" and "ESP-IDF" in message:
                # ESP32 just booted
                last_uptime = self._last_uptime
                self._last_uptime = None  # Reset tracking
                self._datastore.record_reboot(
                    recorded_at, "normal_boot", last_uptime, None,
                    notes="ESP-IDF startup detected"
                )

            elif tag == "watchdog_manager" and "Watchdog reset count:" in message:
                # Extract reset count
                parts = message.split("Watchdog reset count:")
                if len(parts) > 1:
                    count_str = parts[1].strip()
                    reset_count = int(count_str)
                    if reset_count > 0:
                        self._datastore.record_reboot(
                            recorded_at, "watchdog_reset", None, reset_count,
                            notes=f"Watchdog triggered {reset_count} times"
                        )

            # Track network failures (HTTP/TLS errors)
            elif level == "E" and tag in ("esp-tls", "HTTP_CLIENT", "http_client",
                                           "transport_base", "esp_https_ota"):
                self._datastore.record_network_failure(
                    recorded_at, "http_error", message, tag
                )

            # Track relay operations (only log actual state changes)
            elif tag == "relay_controller" and ("Relay: ON" in message or "Relay: OFF" in message):
                new_state = 1 if "ON" in message else 0
                last_state = self._datastore.get_last_relay_state()

                # Only record if state actually changed
                if last_state is None or last_state != new_state:
                    # Calculate duration of previous state
                    if last_state is not None:
                        last_change_time = self._datastore.get_last_relay_change_time()
                        if last_change_time:
                            try:
                                from datetime import datetime
                                last_dt = datetime.fromisoformat(last_change_time.replace('Z', '+00:00'))
                                current_dt = datetime.fromisoformat(recorded_at.replace('Z', '+00:00'))
                                duration = int((current_dt - last_dt).total_seconds())
                                self._datastore.update_last_relay_duration(duration)
                            except (ValueError, AttributeError):
                                pass  # Couldn't calculate duration

                    triggered_by = "server_command"  # Assume server command unless we detect otherwise
                    if "fail-safe" in message.lower() or "forced" in message.lower() or "locked" in message.lower():
                        triggered_by = "fail_safe"
                    self._datastore.record_relay_operation(recorded_at, new_state, triggered_by, message)

        except (ValueError, IndexError) as exc:
            # Parsing error - log but don't crash
            logging.debug("Failed to parse enhanced metrics from %s: %s", message, exc)

    def run(self) -> None:
        backoff = max(1, int(self._cfg.get("reconnect_interval_seconds", 5)))
        while not self._stop_event.is_set():
            if not self._serial:
                self._connect()
                if not self._serial:
                    self._stop_event.wait(backoff)
                    continue
            try:
                raw = self._serial.readline()
                if not raw:
                    continue
                decoded = raw.decode("utf-8", errors="replace").rstrip("\r\n")
                if not decoded:
                    continue
                recorded_at = iso_now()
                level, tag, message = parse_serial_line(decoded)
                self._datastore.record_serial(recorded_at, level, tag, message, decoded)
                self._raw_logger.write({
                    "ts": recorded_at,
                    "level": level,
                    "tag": tag,
                    "msg": message,
                    "line": decoded,
                })
                # Enhanced parsing for long-term monitoring
                self._parse_enhanced_metrics(recorded_at, level, tag, message)
            except SerialException as exc:
                logging.error("Serial exception: %s", exc)
                self._disconnect()
                self._stop_event.wait(backoff)
            except Exception as exc:  # pylint: disable=broad-except
                logging.exception("Unexpected error reading serial: %s", exc)
                self._stop_event.wait(1)
        self._disconnect()


class GPIOMonitor(threading.Thread):
    def __init__(self, config: dict, datastore: DataStore,
                 stop_event: threading.Event):
        super().__init__(daemon=True)
        self._cfg = config
        self._datastore = datastore
        self._stop_event = stop_event
        self._devices = {}
        self._initialized = threading.Event()
        self._queue: queue.Queue[tuple[str, int, int]] = queue.Queue()
        self._setup_devices()

    def _setup_devices(self) -> None:
        if DigitalInputDevice is None:
            logging.warning("gpiozero not available; GPIO monitoring disabled")
            return
        try:
            debounce_sec = float(self._cfg.get("debounce_ms", 20)) / 1000.0
            relay_pin = int(self._cfg.get("relay_pin", 17))
            led_pin = int(self._cfg.get("led_pin", 27))
            self._devices = {
                "relay": DigitalInputDevice(relay_pin, pull_up=False,
                                            bounce_time=debounce_sec),
                "identify_led": DigitalInputDevice(led_pin, pull_up=False,
                                                   bounce_time=debounce_sec),
            }
            self._initialized.set()
            logging.info("GPIO monitor initialized (relay=BCM%d, led=BCM%d)", relay_pin, led_pin)
        except Exception as exc:  # pragma: no cover - GPIO init failures
            logging.error("Failed to initialize GPIO devices: %s", exc)
            self._devices = {}

    def is_ok(self) -> bool:
        return self._initialized.is_set()

    def _poll_inputs(self) -> None:
        prev_states = {name: None for name in self._devices}
        while not self._stop_event.is_set():
            for name, device in self._devices.items():
                state = int(device.value)
                if prev_states[name] is None or prev_states[name] != state:
                    prev_states[name] = state
                    pin = device.pin.number  # type: ignore[attr-defined]
                    self._queue.put((name, pin, state))
            self._stop_event.wait(0.05)

    def run(self) -> None:
        if not self._devices:
            return
        poll_thread = threading.Thread(target=self._poll_inputs, daemon=True)
        poll_thread.start()
        while not self._stop_event.is_set():
            try:
                name, pin, state = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            recorded_at = iso_now()
            self._datastore.record_gpio(recorded_at, pin, state, name)
        for device in self._devices.values():
            device.close()


def read_cpu_temp() -> Optional[float]:
    try:
        temps = psutil.sensors_temperatures()
        for entries in temps.values():
            if entries:
                return entries[0].current
    except Exception:
        pass
    try:
        with open("/sys/class/thermal/thermal_zone0/temp", "r", encoding="utf-8") as f:
            return int(f.read().strip()) / 1000.0
    except Exception:
        return None


def read_wifi_rssi(interface: str) -> Optional[int]:
    try:
        output = subprocess.check_output(
            ["iw", "dev", interface, "link"],
            stderr=subprocess.STDOUT,
            text=True,
            timeout=2,
        )
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return None
    for line in output.splitlines():
        line = line.strip()
        if line.startswith("signal:"):
            parts = line.split()
            if len(parts) >= 2:
                try:
                    return int(parts[1])
                except ValueError:
                    return None
    return None


class MetricsWorker(threading.Thread):
    def __init__(self, config: dict, datastore: DataStore,
                 stop_event: threading.Event):
        super().__init__(daemon=True)
        self._cfg = config
        self._datastore = datastore
        self._stop_event = stop_event

    def run(self) -> None:
        interval = max(10, int(self._cfg.get("sample_interval_seconds", 60)))
        wifi_iface = self._cfg.get("wifi_interface", "wlan0")
        low_disk_threshold = int(self._cfg.get("low_disk_mb_warning", 512))
        while not self._stop_event.is_set():
            recorded_at = iso_now()
            cpu_temp = read_cpu_temp()
            load_1m = os.getloadavg()[0] if hasattr(os, "getloadavg") else None
            mem = psutil.virtual_memory()
            disk = psutil.disk_usage("/")
            disk_free_mb = disk.free / (1024 * 1024)
            if low_disk_threshold and disk_free_mb < low_disk_threshold:
                logging.warning("Disk free space low: %.1f MB", disk_free_mb)
            wifi_rssi = read_wifi_rssi(wifi_iface)
            uptime = int(time.time() - psutil.boot_time())
            self._datastore.record_metrics(
                recorded_at,
                cpu_temp,
                load_1m,
                mem.percent,
                disk_free_mb,
                wifi_rssi,
                uptime,
            )
            self._stop_event.wait(interval)


class HeartbeatWorker(threading.Thread):
    def __init__(self, config: dict, datastore: DataStore,
                 serial_worker: SerialWorker, gpio_monitor: GPIOMonitor,
                 stop_event: threading.Event):
        super().__init__(daemon=True)
        self._cfg = config
        self._datastore = datastore
        self._serial_worker = serial_worker
        self._gpio_monitor = gpio_monitor
        self._stop_event = stop_event

    def run(self) -> None:
        interval = max(15, int(self._cfg.get("interval_seconds", 60)))
        vacuum_days = int(self._cfg.get("vacuum_interval_days", 1))
        while not self._stop_event.is_set():
            recorded_at = iso_now()
            serial_connected = self._serial_worker.is_connected()
            gpio_ok = self._gpio_monitor.is_ok()
            notes = ""
            if not serial_connected:
                notes += "serial_disconnected "
            if not gpio_ok:
                notes += "gpio_unavailable"
            self._datastore.record_heartbeat(recorded_at, serial_connected, gpio_ok, notes.strip())
            self._datastore.vacuum_if_needed(vacuum_days)
            self._stop_event.wait(interval)


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%SZ",
    )


def main() -> None:
    configure_logging()
    config_path = os.environ.get("PI_MONITOR_CONFIG", DEFAULT_CONFIG_PATH)
    config = load_config(config_path)

    logging.info("Starting Pi monitor with config %s", config_path)

    log_cfg = config.get("logging", {})
    log_dir = Path(log_cfg.get("log_dir", "/var/log/bunker"))
    raw_prefix = log_cfg.get("raw_serial_prefix", "esp32-serial")
    max_mb = int(log_cfg.get("max_raw_file_mb", 50))

    datastore = DataStore(Path(log_cfg.get("sqlite_path", log_dir / "bunker_monitor.db")))
    raw_logger = RawSerialLogger(log_dir, raw_prefix, max_mb)

    stop_event = threading.Event()

    serial_worker = SerialWorker(config.get("serial", {}), datastore, raw_logger, stop_event)
    gpio_monitor = GPIOMonitor(config.get("gpio", {}), datastore, stop_event)
    metrics_worker = MetricsWorker(config.get("system_metrics", {}), datastore, stop_event)
    heartbeat_worker = HeartbeatWorker(
        config.get("heartbeat", {}),
        datastore,
        serial_worker,
        gpio_monitor,
        stop_event,
    )

    workers = [serial_worker, gpio_monitor, metrics_worker, heartbeat_worker]
    for worker in workers:
        worker.start()

    def handle_signal(signum, _frame):
        if signum in (signal.SIGTERM, signal.SIGINT):
            logging.info("Received signal %s, shutting down", signum)
            stop_event.set()
        elif signum == signal.SIGHUP:
            logging.info("Received SIGHUP, rotating raw log")
            raw_logger.request_rotation()

    signal.signal(signal.SIGTERM, handle_signal)
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGHUP, handle_signal)

    try:
        while not stop_event.is_set():
            stop_event.wait(1)
    finally:
        stop_event.set()
        for worker in workers:
            worker.join(timeout=2)
        raw_logger.close()
        datastore.close()
        logging.info("Pi monitor stopped")


if __name__ == "__main__":
    main()
