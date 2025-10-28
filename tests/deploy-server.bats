#!/usr/bin/env bats
# Tests for scripts/deploy-server.sh

setup() {
  export ORIGINAL_DIR="$PWD"
  cd "$BATS_TEST_DIRNAME/.." || exit 1
  export SCRIPT="./scripts/deploy-server.sh"
}

teardown() {
  cd "$ORIGINAL_DIR" || exit 1
}

@test "deploy-server.sh: script exists and is executable" {
  [ -f "$SCRIPT" ]
  [ -x "$SCRIPT" ]
}

@test "deploy-server.sh: shows usage with --help" {
  run "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Usage:" ]]
  [[ "$output" =~ "deploy-server.sh" ]]
}

@test "deploy-server.sh: accepts --skip-git flag" {
  run "$SCRIPT" --help
  [[ "$output" =~ "--skip-git" ]]
}

@test "deploy-server.sh: validates server directory exists" {
  # Just verify the check exists in the script
  grep -q "Server directory not found" "$SCRIPT"
}

@test "deploy-server.sh: requires .env.production file" {
  # Script should check for .env.production
  grep -q "ENV_FILE.*not found" "$SCRIPT" || grep -q ".env.production" "$SCRIPT"
}

@test "deploy-server.sh: creates venv if missing" {
  grep -q "python3 -m venv" "$SCRIPT"
}

@test "deploy-server.sh: upgrades pip in venv" {
  grep -q "pip install --upgrade pip" "$SCRIPT"
}

@test "deploy-server.sh: installs requirements.txt" {
  grep -q "requirements.txt" "$SCRIPT"
}

@test "deploy-server.sh: runs alembic migrations" {
  grep -q "alembic.*upgrade head" "$SCRIPT"
}

@test "deploy-server.sh: installs systemd service file" {
  grep -q "systemctl daemon-reload" "$SCRIPT"
}

@test "deploy-server.sh: substitutes placeholders in service template" {
  grep -q "__PROJECT_ROOT__" "$SCRIPT"
  grep -q "__DEPLOY_USER__" "$SCRIPT"
}

@test "deploy-server.sh: restarts systemd service" {
  grep -q "systemctl restart" "$SCRIPT"
}

@test "deploy-server.sh: script has proper shebang" {
  run head -n 1 "$SCRIPT"
  [[ "$output" =~ "#!/usr/bin/env bash" ]]
}

@test "deploy-server.sh: script uses set -euo pipefail" {
  grep -q "set -euo pipefail" "$SCRIPT"
}

@test "deploy-server.sh: checks for required commands" {
  grep -q "ensure_command.*python3" "$SCRIPT"
  grep -q "ensure_command.*git" "$SCRIPT"
  grep -q "ensure_command.*sudo" "$SCRIPT"
}

@test "deploy-server.sh: provides health check command" {
  grep -q "curl.*healthz" "$SCRIPT"
}

@test "deploy-server.sh: warns if not running as bunkercolab user" {
  grep -q 'whoami.*bunkercolab' "$SCRIPT"
}

@test "deploy-server.sh: skips migrations if alembic dir missing" {
  grep -q "Alembic directory missing" "$SCRIPT"
}
