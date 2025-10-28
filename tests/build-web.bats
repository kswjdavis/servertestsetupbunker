#!/usr/bin/env bats
# Tests for scripts/build-web.sh

setup() {
  export ORIGINAL_DIR="$PWD"
  cd "$BATS_TEST_DIRNAME/.." || exit 1
  export SCRIPT="./scripts/build-web.sh"
}

teardown() {
  cd "$ORIGINAL_DIR" || exit 1
}

@test "build-web.sh: script exists and is executable" {
  [ -f "$SCRIPT" ]
  [ -x "$SCRIPT" ]
}

@test "build-web.sh: shows usage with --help" {
  run "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Usage:" ]]
  [[ "$output" =~ "build-web.sh" ]]
}

@test "build-web.sh: accepts --skip-install flag" {
  run "$SCRIPT" --help
  [[ "$output" =~ "--skip-install" ]]
}

@test "build-web.sh: has safety check for root directory" {
  # Verify the safety pattern exists - full execution test would require mock build
  grep -q "doesn't look like a safe deployment path" "$SCRIPT"
  grep -q "/var/www/" "$SCRIPT"
}

@test "build-web.sh: validates NGINX_ROOT is absolute path" {
  # Verify path validation exists in script
  grep -q "NGINX_ROOT" "$SCRIPT"
  grep -q "/opt/" "$SCRIPT" || grep -q "/var/www/" "$SCRIPT"
}

@test "build-web.sh: rejects unsafe paths with validation logic" {
  # Verify regex pattern for path validation exists
  grep -q '\[\[.*NGINX_ROOT.*=~' "$SCRIPT"
}

@test "build-web.sh: accepts safe NGINX_ROOT under /var/www/" {
  export WEB_DEPLOY_ROOT="/var/www/test"
  # Script will fail on web dir check, but should pass path validation
  run "$SCRIPT" --skip-install
  # Should NOT contain the safety error
  ! [[ "$output" =~ "doesn't look like a safe deployment path" ]]
}

@test "build-web.sh: accepts safe NGINX_ROOT under /opt/" {
  export WEB_DEPLOY_ROOT="/opt/bunkercolab"
  run "$SCRIPT" --skip-install
  # Should NOT contain the safety error
  ! [[ "$output" =~ "doesn't look like a safe deployment path" ]]
}

@test "build-web.sh: validates web directory exists" {
  export WEB_DEPLOY_ROOT="/var/www/bunkercolab"
  # Temporarily move web dir if it exists
  if [ -d "web" ]; then
    mv web web.backup
  fi

  run "$SCRIPT" --skip-install
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Frontend directory not found" ]]

  # Restore web dir
  if [ -d "web.backup" ]; then
    mv web.backup web
  fi
}

@test "build-web.sh: script has proper shebang" {
  run head -n 1 "$SCRIPT"
  [[ "$output" =~ "#!/usr/bin/env bash" ]]
}

@test "build-web.sh: script uses set -euo pipefail" {
  grep -q "set -euo pipefail" "$SCRIPT"
}

@test "build-web.sh: uses find -delete instead of rm -rf glob" {
  grep -q "find.*-mindepth 1 -delete" "$SCRIPT"
  ! grep -q 'rm -rf.*\*' "$SCRIPT"
}

@test "build-web.sh: validates NGINX_ROOT before deletion" {
  # Ensure path validation exists before find command
  grep -B 5 "find.*-mindepth 1 -delete" "$SCRIPT" | grep -q "doesn't look like a safe deployment path"
}

@test "build-web.sh: checks for dist directory after build" {
  grep -q "Build output not found at.*DIST_DIR" "$SCRIPT"
}
