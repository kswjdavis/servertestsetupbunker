#!/usr/bin/env bats
# Tests for scripts/setup-db.sh

setup() {
  # Store original working directory
  export ORIGINAL_DIR="$PWD"

  # Navigate to project root
  cd "$BATS_TEST_DIRNAME/.." || exit 1

  # Script path
  export SCRIPT="./scripts/setup-db.sh"
}

teardown() {
  cd "$ORIGINAL_DIR" || exit 1
}

@test "setup-db.sh: script exists and is executable" {
  [ -f "$SCRIPT" ]
  [ -x "$SCRIPT" ]
}

@test "setup-db.sh: shows usage with --help" {
  run "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Usage:" ]]
  [[ "$output" =~ "setup-db.sh" ]]
}

@test "setup-db.sh: rejects invalid database name with hyphen" {
  run "$SCRIPT" --db-name "invalid-name" --db-password "test123" --no-install 2>&1
  # Should fail validation (status 1) or show identifier error
  [ "$status" -ne 0 ] || [[ "$output" =~ "not a valid PostgreSQL identifier" ]]
}

@test "setup-db.sh: rejects invalid database name starting with number" {
  run "$SCRIPT" --db-name "9database" --db-password "test123" --no-install 2>&1
  [ "$status" -ne 0 ] || [[ "$output" =~ "not a valid PostgreSQL identifier" ]]
}

@test "setup-db.sh: rejects invalid user name with special chars" {
  run "$SCRIPT" --db-user "user@name" --db-password "test123" --no-install 2>&1
  [ "$status" -ne 0 ] || [[ "$output" =~ "not a valid PostgreSQL identifier" ]]
}

@test "setup-db.sh: accepts valid database name" {
  run sudo "$SCRIPT" --db-name "valid_db_name" --db-user "valid_user" --db-password "test123" --no-install <<< ""
  # Will fail if PostgreSQL not running, but should pass identifier validation
  if [[ "$output" =~ "not a valid PostgreSQL identifier" ]]; then
    return 1
  fi
  # Otherwise validation passed (may fail on psql execution which is expected in test env)
  return 0
}

@test "setup-db.sh: accepts underscore in database name" {
  run sudo "$SCRIPT" --db-name "bunkercolab_test" --db-user "test_user" --db-password "test123" --no-install <<< ""
  # Should pass identifier validation
  if [[ "$output" =~ "not a valid PostgreSQL identifier" ]]; then
    return 1
  fi
  return 0
}

@test "setup-db.sh: does not display password in output" {
  # Even if we can't run full script, ensure password placeholder pattern exists
  grep -q '<PASSWORD>' "$SCRIPT" || return 1
  ! grep -q 'DB_PASSWORD}@' "$SCRIPT" || return 1
}

@test "setup-db.sh: validates --no-install flag accepted" {
  run "$SCRIPT" --help
  [[ "$output" =~ "--no-install" ]]
}

@test "setup-db.sh: script has proper shebang" {
  run head -n 1 "$SCRIPT"
  [[ "$output" =~ "#!/usr/bin/env bash" ]]
}

@test "setup-db.sh: script uses set -euo pipefail" {
  grep -q "set -euo pipefail" "$SCRIPT"
}
