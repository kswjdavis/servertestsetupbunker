#!/usr/bin/env bats
# Tests for scripts/rollback.sh

setup() {
  export ORIGINAL_DIR="$PWD"
  cd "$BATS_TEST_DIRNAME/.." || exit 1
  export SCRIPT="./scripts/rollback.sh"
}

teardown() {
  cd "$ORIGINAL_DIR" || exit 1
}

@test "rollback.sh: script exists and is executable" {
  [ -f "$SCRIPT" ]
  [ -x "$SCRIPT" ]
}

@test "rollback.sh: shows usage with --help" {
  run "$SCRIPT" --help
  [ "$status" -eq 0 ]
  [[ "$output" =~ "Usage:" ]]
  [[ "$output" =~ "rollback.sh" ]]
}

@test "rollback.sh: requires git reference argument" {
  run "$SCRIPT"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Usage:" ]]
}

@test "rollback.sh: accepts --no-restart flag" {
  run "$SCRIPT" --help
  [[ "$output" =~ "--no-restart" ]]
}

@test "rollback.sh: validates git repository exists" {
  # Just verify the check exists in script
  grep -q "not a git repository" "$SCRIPT"
}

@test "rollback.sh: validates git ref exists before prompting" {
  # Test with clearly invalid ref
  run bash -c "echo 'n' | $SCRIPT nonexistent_ref_12345"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "does not exist or is invalid" ]]
}

@test "rollback.sh: shows available tags on invalid ref" {
  run bash -c "echo 'n' | $SCRIPT invalid_tag_xyz"
  [ "$status" -eq 1 ]
  [[ "$output" =~ "Available tags:" ]] || [[ "$output" =~ "does not exist" ]]
}

@test "rollback.sh: fetches refs before validation" {
  grep -q "git.*fetch.*--all.*--prune" "$SCRIPT"
}

@test "rollback.sh: resolves target ref to commit SHA" {
  grep -q 'RESOLVED_TARGET.*git.*rev-parse' "$SCRIPT"
}

@test "rollback.sh: prompts for confirmation before reset" {
  grep -q 'read.*Proceed with hard reset' "$SCRIPT"
}

@test "rollback.sh: uses resolved SHA for reset (not user input)" {
  grep -q 'reset --hard.*RESOLVED_TARGET' "$SCRIPT"
}

@test "rollback.sh: script has proper shebang" {
  run head -n 1 "$SCRIPT"
  [[ "$output" =~ "#!/usr/bin/env bash" ]]
}

@test "rollback.sh: script uses set -euo pipefail" {
  grep -q "set -euo pipefail" "$SCRIPT"
}

@test "rollback.sh: provides next steps after rollback" {
  grep -q "deploy-server.sh --skip-git" "$SCRIPT"
  grep -q "build-web.sh" "$SCRIPT"
}

@test "rollback.sh: checks for sudo before service restart" {
  grep -q "command -v sudo" "$SCRIPT"
}
