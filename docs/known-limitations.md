# Known Limitations (POC)

The current demonstrator intentionally trades long-term robustness for rapid delivery. These constraints should be addressed before production rollout.

1. **Single Weather Station** — All bunkers rely on one configured station; no per-location overrides.
2. **No Multi-Tenancy** — Single organization deployment; authorization is per user only.
3. **Basic Security** — No multi-factor authentication or password reset UI; manual database intervention required.
4. **No Audit Logging** — User actions are not persisted for compliance review.
5. **Manual Scaling** — Backend runs on a single droplet; manual effort required to scale resources.
6. **Limited Monitoring** — Lacks centralized metrics stack (Prometheus/Grafana); relies on logs.
7. **No Native Mobile App** — Responsive web UI only; no offline capabilities.
8. **Partial Error Handling** — Edge-case API and firmware errors may not present actionable guidance.
9. **Manual Backups** — Database backups and restores are manual processes.
10. **OTA Optional** — Over-the-air firmware updates supported experimentally; manual flashing remains primary path.
