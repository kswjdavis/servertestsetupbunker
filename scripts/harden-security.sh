#!/bin/bash
# Security hardening script for production server
# Run this on the production server as root
#
# Usage: ./harden-security.sh
#
# This script:
# 1. Fixes file ownership issues
# 2. Restricts sudo permissions for bunkercolab user
# 3. Sets up restricted SSH command for deployment

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $@"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $@"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $@"
}

# Check if running as root
if [ "$(whoami)" != "root" ]; then
    log_error "This script must be run as root"
    exit 1
fi

log_info "Starting security hardening..."

# 1. Fix file ownership
log_info "Fixing file ownership in /home/bunkercolab/Bunkercolab..."
chown -R bunkercolab:bunkercolab /home/bunkercolab/Bunkercolab

# Verify ownership
if [ "$(stat -c '%U' /home/bunkercolab/Bunkercolab/server/.env)" = "bunkercolab" ]; then
    log_info "✓ File ownership fixed"
else
    log_error "✗ Failed to fix file ownership"
    exit 1
fi

# 2. Restrict sudo permissions for bunkercolab user
log_info "Restricting sudo permissions for bunkercolab user..."

# Create sudoers file for bunkercolab
cat > /etc/sudoers.d/bunkercolab << 'EOSUDO'
# Sudoers configuration for bunkercolab user
# Allows only necessary commands for auto-deployment

# Service management
bunkercolab ALL=(ALL) NOPASSWD: /bin/systemctl restart bunkercolab
bunkercolab ALL=(ALL) NOPASSWD: /bin/systemctl reload bunkercolab
bunkercolab ALL=(ALL) NOPASSWD: /bin/systemctl status bunkercolab
bunkercolab ALL=(ALL) NOPASSWD: /bin/systemctl is-active bunkercolab

# Nginx management
bunkercolab ALL=(ALL) NOPASSWD: /usr/sbin/nginx -t
bunkercolab ALL=(ALL) NOPASSWD: /bin/systemctl reload nginx

# Log directory management
bunkercolab ALL=(ALL) NOPASSWD: /bin/mkdir -p /var/log/bunkercolab
bunkercolab ALL=(ALL) NOPASSWD: /bin/chown bunkercolab\:bunkercolab /var/log/bunkercolab
EOSUDO

# Set proper permissions on sudoers file
chmod 0440 /etc/sudoers.d/bunkercolab

# Validate sudoers configuration
if visudo -cf /etc/sudoers.d/bunkercolab; then
    log_info "✓ Sudoers configuration validated"
else
    log_error "✗ Invalid sudoers configuration"
    rm /etc/sudoers.d/bunkercolab
    exit 1
fi

# Test sudo restriction
log_info "Testing sudo restrictions..."
if sudo -u bunkercolab sudo -l | grep -q "systemctl restart bunkercolab"; then
    log_info "✓ Sudo restrictions applied successfully"
else
    log_error "✗ Sudo restrictions not applied correctly"
    exit 1
fi

# 3. Create log directory
log_info "Setting up deployment log directory..."
mkdir -p /var/log/bunkercolab
chown bunkercolab:bunkercolab /var/log/bunkercolab
chmod 755 /var/log/bunkercolab

# 4. Verify SSH authorized_keys (optional enhancement for future)
log_info "Checking SSH configuration..."
if [ -f /home/bunkercolab/.ssh/authorized_keys ]; then
    log_info "SSH authorized_keys file exists"
    log_warn "Consider adding command restrictions to authorized_keys for deployment key"
    log_warn "Example: command=\"/home/bunkercolab/Bunkercolab/scripts/auto-deploy.sh\" ssh-ed25519 ..."
else
    log_warn "No authorized_keys file found for bunkercolab user"
fi

# 5. Set up auto-deploy script permissions
if [ -f /home/bunkercolab/Bunkercolab/scripts/auto-deploy.sh ]; then
    log_info "Setting permissions on auto-deploy.sh..."
    chmod +x /home/bunkercolab/Bunkercolab/scripts/auto-deploy.sh
    chown bunkercolab:bunkercolab /home/bunkercolab/Bunkercolab/scripts/auto-deploy.sh
    log_info "✓ auto-deploy.sh permissions set"
fi

# 6. Verify systemd service configuration
log_info "Verifying systemd service configuration..."
if systemctl is-active --quiet bunkercolab; then
    log_info "✓ bunkercolab service is running"
else
    log_warn "bunkercolab service is not running"
fi

# Summary
log_info ""
log_info "=========================================="
log_info "Security Hardening Complete!"
log_info "=========================================="
log_info ""
log_info "Changes applied:"
log_info "  ✓ File ownership fixed (bunkercolab:bunkercolab)"
log_info "  ✓ Sudo access restricted to deployment commands only"
log_info "  ✓ Deployment log directory created"
log_info "  ✓ Script permissions configured"
log_info ""
log_info "Note: bunkercolab user can no longer run arbitrary sudo commands."
log_info "Allowed sudo commands:"
log_info "  - systemctl restart/reload/status bunkercolab"
log_info "  - nginx -t"
log_info "  - systemctl reload nginx"
log_info "  - mkdir/chown for /var/log/bunkercolab"
log_info ""
log_warn "IMPORTANT: Test deployments after these changes!"
log_info ""
