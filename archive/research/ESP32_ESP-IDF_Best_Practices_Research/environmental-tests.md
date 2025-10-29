# Environmental Tests
- [ ] Operation at -20°C
- [ ] Operation at +60°C
- [ ] Power supply voltage 4.5V-5.5V
- [ ] EMI/EMC compliance
```

## Best Practices

1. **Test early and often** - Run tests on every commit
2. **Test on real hardware** - Simulators miss real-world issues
3. **Automate regression tests** - Use pytest-embedded for CI/CD
4. **Test failure modes** - Explicitly test error conditions
5. **Monitor test coverage** - Aim for >80% code coverage
6. **Use meaningful test names** - Describe what's being tested
7. **Keep tests fast** - Slow tests won't get run
8. **Test hardware integration** - Don't just mock everything
9. **Document test setup** - Hardware configurations, pin connections
10. **Version test data** - Store test configurations in git

## Official Documentation
- Unit Testing: https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-guides/unit-tests.html
- pytest-embedded: https://docs.espressif.com/projects/pytest-embedded/en/latest/

---
