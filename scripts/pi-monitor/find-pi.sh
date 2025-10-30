#!/bin/bash
# Find Raspberry Pi on network

echo "Scanning for Raspberry Pi..."
ping -c 1 raspberrypi.local &>/dev/null && echo "Found via mDNS: raspberrypi.local" && exit 0

echo "Trying common IPs..."
for ip in {1..254}; do
    timeout 0.2 ping -c 1 192.168.1.$ip &>/dev/null && \
    timeout 1 nc -zv 192.168.1.$ip 22 2>&1 | grep -q succeeded && \
    echo "Found Pi at: 192.168.1.$ip"
done
