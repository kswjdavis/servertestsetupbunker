#!/bin/bash
# Auto-deployment script with health checks and automatic rollback
# This script should be run on the production server as the bunkercolab user
#
# Usage: ./auto-deploy.sh [--dry-run]
#
# Features:
# - Pulls latest changes from server-main branch
# - Runs backend and frontend deployment scripts
# - Performs comprehensive health checks
# - Automatically rolls back on any failure
# - Logs all deployment activity

set -e  # Exit on error

# Configuration
REPO_DIR="/home/bunkercolab/Bunkercolab"
BRANCH="server-main"
REMOTE="origin"
LOG_FILE="/var/log/bunkercolab/auto-deploy.log"
HEALTH_CHECK_RETRIES=3
HEALTH_CHECK_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to log messages
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "${GREEN}$@${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$@${NC}"
}

log_error() {
    log "ERROR" "${RED}$@${NC}"
}

# Function to check if running as correct user
check_user() {
    if [ "$(whoami)" != "bunkercolab" ]; then
        log_error "This script must be run as the bunkercolab user"
        exit 1
    fi
}

# Function to initialize Git repository if needed
init_git_repo() {
    if [ ! -d "$REPO_DIR/.git" ]; then
        log_info "Initializing Git repository..."
        cd "$REPO_DIR"
        git init
        git remote add $REMOTE https://github.com/kswjdavis/servertestsetupbunker.git
        git fetch $REMOTE $BRANCH
        git checkout -b $BRANCH $REMOTE/$BRANCH
        log_info "Git repository initialized"
    fi
}

# Function to check for updates
check_for_updates() {
    cd "$REPO_DIR"
    git fetch $REMOTE $BRANCH

    LOCAL=$(git rev-parse $BRANCH)
    REMOTE_REF=$(git rev-parse $REMOTE/$BRANCH)

    if [ "$LOCAL" = "$REMOTE_REF" ]; then
        log_info "No updates available. Current commit: $LOCAL"
        return 1  # No updates
    else
        log_info "Updates available:"
        log_info "  Current: $LOCAL"
        log_info "  New:     $REMOTE_REF"
        return 0  # Updates available
    fi
}

# Function to perform health checks
health_check() {
    local check_name=$1
    local check_command=$2
    local retries=$HEALTH_CHECK_RETRIES

    log_info "Performing health check: $check_name"

    while [ $retries -gt 0 ]; do
        if eval "$check_command"; then
            log_info "✓ $check_name passed"
            return 0
        fi

        retries=$((retries - 1))
        if [ $retries -gt 0 ]; then
            log_warn "Health check failed, retrying in ${HEALTH_CHECK_DELAY}s... ($retries retries left)"
            sleep $HEALTH_CHECK_DELAY
        fi
    done

    log_error "✗ $check_name failed after $HEALTH_CHECK_RETRIES attempts"
    return 1
}

# Function to rollback to previous commit
rollback() {
    local previous_commit=$1
    log_error "=========================================="
    log_error "DEPLOYMENT FAILED - INITIATING ROLLBACK"
    log_error "=========================================="

    cd "$REPO_DIR"
    log_info "Rolling back to commit: $previous_commit"

    git reset --hard $previous_commit

    log_info "Re-running deployment scripts after rollback..."
    ./scripts/deploy-server.sh --skip-git || {
        log_error "Rollback deployment failed! Manual intervention required!"
        exit 1
    }

    ./scripts/build-web.sh || {
        log_error "Rollback frontend build failed! Manual intervention required!"
        exit 1
    }

    # Verify rollback worked
    if health_check "Backend (post-rollback)" "curl -f -s http://localhost:8000/healthz > /dev/null"; then
        log_info "Rollback successful!"
    else
        log_error "Rollback verification failed! Manual intervention required!"
        exit 1
    fi
}

# Main deployment function
deploy() {
    local dry_run=$1

    log_info "=========================================="
    log_info "Auto-deployment started"
    log_info "=========================================="

    # Check for updates
    if ! check_for_updates; then
        log_info "Nothing to deploy"
        return 0
    fi

    if [ "$dry_run" = "true" ]; then
        log_info "Dry run mode - would deploy new changes"
        git log --oneline $BRANCH..$REMOTE/$BRANCH
        return 0
    fi

    # Store current commit for rollback
    PREVIOUS_COMMIT=$(git rev-parse HEAD)
    log_info "Storing rollback point: $PREVIOUS_COMMIT"

    # Pull new changes
    log_info "Pulling latest changes from $REMOTE/$BRANCH..."
    git reset --hard $REMOTE/$BRANCH || {
        log_error "Git reset failed!"
        exit 1
    }

    NEW_COMMIT=$(git rev-parse HEAD)
    log_info "Deploying commit: $NEW_COMMIT"

    # Display changes
    log_info "Changes in this deployment:"
    git log --oneline $PREVIOUS_COMMIT..$NEW_COMMIT

    # Run backend deployment
    log_info "Running backend deployment..."
    if ! ./scripts/deploy-server.sh --skip-git; then
        log_error "Backend deployment failed!"
        rollback $PREVIOUS_COMMIT
        exit 1
    fi

    # Run frontend build
    log_info "Running frontend build..."
    if ! ./scripts/build-web.sh; then
        log_error "Frontend build failed!"
        rollback $PREVIOUS_COMMIT
        exit 1
    fi

    # Perform health checks
    log_info "Performing post-deployment health checks..."

    if ! health_check "Backend API" "curl -f -s http://localhost:8000/healthz > /dev/null"; then
        rollback $PREVIOUS_COMMIT
        exit 1
    fi

    if ! health_check "Systemd Service" "systemctl is-active --quiet bunkercolab"; then
        rollback $PREVIOUS_COMMIT
        exit 1
    fi

    if ! health_check "Frontend" "curl -f -s http://localhost/ > /dev/null"; then
        rollback $PREVIOUS_COMMIT
        exit 1
    fi

    log_info "=========================================="
    log_info "Deployment successful!"
    log_info "Deployed commit: $NEW_COMMIT"
    log_info "Previous commit: $PREVIOUS_COMMIT"
    log_info "=========================================="
}

# Main script
main() {
    local dry_run=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                dry_run=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--dry-run]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Check for updates without deploying"
                echo "  --help       Show this help message"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    # Create log directory if it doesn't exist
    sudo mkdir -p "$(dirname $LOG_FILE)"
    sudo chown bunkercolab:bunkercolab "$(dirname $LOG_FILE)"

    # Checks
    check_user
    init_git_repo

    # Deploy
    deploy $dry_run
}

# Run main function
main "$@"
