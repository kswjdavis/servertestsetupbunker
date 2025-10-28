#!/usr/bin/env python3
"""Asynchronous load test harness for the Device Status endpoint.

Simulates multiple ESP32 devices posting telemetry to
`/api/v1/control/status` at a configurable interval. Collects latency
statistics (average, p95, max) and error counts to validate AC9
performance targets.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import random
import signal
import sys
import time
from collections import Counter
from dataclasses import dataclass, field
from statistics import mean
from typing import Iterable, Sequence

import httpx

DEFAULT_DEVICE_COUNT = 10
DEFAULT_INTERVAL = 60.0  # seconds
DEFAULT_DURATION = 300.0  # seconds
DEFAULT_TIMEOUT = 10.0  # seconds


@dataclass
class DeviceMetrics:
    """Aggregated metrics captured for a simulated device."""

    latencies_ms: list[float] = field(default_factory=list)
    successes: int = 0
    errors: int = 0
    status_counts: Counter[int] = field(default_factory=Counter)

    def merge(self, other: "DeviceMetrics") -> None:
        """Merge another metrics object into this one."""
        self.latencies_ms.extend(other.latencies_ms)
        self.successes += other.successes
        self.errors += other.errors
        self.status_counts.update(other.status_counts)


def percentile(values: Sequence[float], pct: float) -> float:
    """Return the percentile for a sorted sequence."""
    if not values:
        return 0.0
    if pct <= 0:
        return values[0]
    if pct >= 1:
        return values[-1]
    index = int(round((len(values) - 1) * pct))
    return values[index]


def load_tokens(tokens_path: str | None, default_token: str | None, device_count: int) -> list[str]:
    """Load bearer tokens from file (JSON list or newline-delimited)."""
    if tokens_path:
        path = os.path.abspath(tokens_path)
        with open(path, "r", encoding="utf-8") as handle:
            content = handle.read().strip()
            try:
                tokens = json.loads(content)
                if not isinstance(tokens, list):
                    raise ValueError("Tokens JSON must be a list of strings.")
            except json.JSONDecodeError:
                tokens = [line.strip() for line in content.splitlines() if line.strip()]
        if len(tokens) < device_count:
            raise ValueError(f"Need at least {device_count} tokens, found {len(tokens)}.")
        return [str(token) for token in tokens[:device_count]]

    if default_token is None:
        raise ValueError("Provide either --token or --tokens-file for authentication.")
    return [default_token for _ in range(device_count)]


def build_payload(device_index: int, iteration: int) -> dict[str, object]:
    """Construct a realistic status payload for a simulated device."""
    uptime_seconds = iteration * int(DEFAULT_INTERVAL) + device_index * 5
    countdown = max(0, 60 - (iteration % 60))
    return {
        "relay_state": "ON" if iteration % 5 != 0 else "OFF",
        "uptime_seconds": uptime_seconds,
        "wifi_rssi": -60 - random.randint(0, 15),
        "countdown_timer_remaining": countdown,
        "firmware_version": "1.0.0",
        "free_heap_bytes": 180_000 - random.randint(0, 20_000),
        "wifi_ps_mode": random.randint(0, 2),
        "cpu_freq_mhz": 160,
        "watchdog_reset_count": random.randint(0, 2),
        "last_reset_reason": "PowerOnReset",
    }


async def simulate_device(
    client: httpx.AsyncClient,
    device_index: int,
    token: str,
    interval: float,
    stop_event: asyncio.Event,
    endpoint: str,
) -> DeviceMetrics:
    """Simulate a single device posting telemetry until stop_event is set."""
    headers = {"Authorization": f"Bearer {token}"}
    metrics = DeviceMetrics()
    iteration = 0

    while not stop_event.is_set():
        payload = build_payload(device_index, iteration)
        start = time.perf_counter()
        try:
            response = await client.post(endpoint, json=payload, headers=headers)
            latency = (time.perf_counter() - start) * 1000.0
            metrics.latencies_ms.append(latency)
            metrics.status_counts[response.status_code] += 1
            if response.is_success:
                metrics.successes += 1
            else:
                metrics.errors += 1
                logging.warning(
                    "Device %s received HTTP %s: %s",
                    device_index,
                    response.status_code,
                    response.text,
                )
        except Exception as exc:  # noqa: BLE001 - diagnostics important for load test
            metrics.errors += 1
            logging.exception("Device %s request failed: %s", device_index, exc)

        iteration += 1
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue

    return metrics


async def run_load_test(args: argparse.Namespace) -> int:
    """Execute the load test and print a metrics summary."""
    tokens = load_tokens(args.tokens_file, args.token, args.device_count)
    base_url = args.base_url.rstrip("/")
    endpoint = f"{base_url}/api/v1/control/status"
    stop_event = asyncio.Event()

    # Allow Ctrl+C to stop the test gracefully
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop_event.set)

    async with httpx.AsyncClient(timeout=args.timeout) as client:
        tasks = [
            asyncio.create_task(
                simulate_device(
                    client=client,
                    device_index=index,
                    token=tokens[index],
                    interval=args.interval,
                    stop_event=stop_event,
                    endpoint=endpoint,
                )
            )
            for index in range(args.device_count)
        ]

        try:
            await asyncio.wait_for(stop_event.wait(), timeout=args.duration)
        except asyncio.TimeoutError:
            stop_event.set()

        results = await asyncio.gather(*tasks, return_exceptions=False)

    aggregate = DeviceMetrics()
    for result in results:
        aggregate.merge(result)

    total_requests = aggregate.successes + aggregate.errors
    latencies_sorted = sorted(aggregate.latencies_ms)
    avg_latency = mean(latencies_sorted) if latencies_sorted else 0.0
    p95_latency = percentile(latencies_sorted, 0.95)
    max_latency = latencies_sorted[-1] if latencies_sorted else 0.0
    error_rate = (aggregate.errors / total_requests) * 100 if total_requests else 0.0

    logging.info("Load test complete:")
    logging.info("  Requests: %s (success=%s, errors=%s, error_rate=%.2f%%)", total_requests, aggregate.successes, aggregate.errors, error_rate)
    logging.info("  Latency (ms): avg=%.2f, p95=%.2f, max=%.2f", avg_latency, p95_latency, max_latency)
    logging.info("  Status codes: %s", dict(aggregate.status_counts))

    if args.latency_budget_ms and p95_latency > args.latency_budget_ms:
        logging.error("p95 latency %.2fms exceeds budget %.2fms", p95_latency, args.latency_budget_ms)
        return 1

    return 0


def parse_args(argv: Iterable[str]) -> argparse.Namespace:
    """Parse CLI arguments."""
    parser = argparse.ArgumentParser(description="Simulate device telemetry load against the control API.")
    parser.add_argument("--base-url", required=True, help="Server base URL, e.g. https://api.example.com")
    parser.add_argument("--token", help="Bearer token to reuse for all devices (useful for staging).")
    parser.add_argument("--tokens-file", help="Path to JSON list or newline-delimited file of bearer tokens.")
    parser.add_argument("--device-count", type=int, default=DEFAULT_DEVICE_COUNT, help="Number of simulated devices.")
    parser.add_argument("--interval", type=float, default=DEFAULT_INTERVAL, help="Seconds between status posts per device.")
    parser.add_argument("--duration", type=float, default=DEFAULT_DURATION, help="Total test duration in seconds.")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT, help="Request timeout in seconds.")
    parser.add_argument("--latency-budget-ms", type=float, help="Alert when p95 latency exceeds this threshold.")
    parser.add_argument("--log-level", default="INFO", help="Logging level (DEBUG, INFO, WARNING, ERROR).")
    return parser.parse_args(argv)


def main(argv: Iterable[str] | None = None) -> int:
    """Entrypoint for CLI execution."""
    args = parse_args(argv or sys.argv[1:])
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(message)s",
    )

    try:
        return asyncio.run(run_load_test(args))
    except ValueError as exc:
        logging.error("%s", exc)
        return 2
    except KeyboardInterrupt:
        logging.info("Load test interrupted.")
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
