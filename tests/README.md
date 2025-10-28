# Deployment Script Tests

This directory contains automated tests for the deployment scripts using [BATS](https://github.com/bats-core/bats-core) (Bash Automated Testing System).

## Installation

### macOS
```bash
brew install bats-core
```

### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install -y bats
```

### Manual Installation
```bash
git clone https://github.com/bats-core/bats-core.git
cd bats-core
sudo ./install.sh /usr/local
```

## Running Tests

### Run all tests
```bash
bats tests/*.bats
```

### Run specific test file
```bash
bats tests/setup-db.bats
```

### Run with verbose output
```bash
bats -t tests/*.bats
```

## Test Structure

- `setup-db.bats` - PostgreSQL database provisioning tests
- `build-web.bats` - Frontend build and deployment tests
- `rollback.bats` - Git rollback functionality tests
- `deploy-server.bats` - Backend deployment tests
- `fixtures/` - Test fixture files and mock data

## Test Coverage

Each test file validates:
- Input validation and error handling
- Command-line argument parsing
- Safety checks (file paths, git refs, etc.)
- Idempotency where applicable
- Error messages and exit codes

## CI/CD Integration

To run tests in GitHub Actions, add to `.github/workflows/test.yml`:

```yaml
- name: Install BATS
  run: |
    sudo apt-get update
    sudo apt-get install -y bats

- name: Run deployment script tests
  run: bats tests/*.bats
```

## Contributing

When modifying deployment scripts, ensure corresponding tests are updated or added.
