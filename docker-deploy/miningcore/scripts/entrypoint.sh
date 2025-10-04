#!/bin/bash
set -e

# Create necessary directories
mkdir -p /app/build

# Copy the config file if it exists
if [ -f /config/config.json ]; then
    echo "Copying config.json to /app/"
    cp /config/config.json /app/config.json
    chmod 644 /app/config.json
else
    echo "Error: /config/config.json not found"
    exit 1
fi

# Copy the coins.json file if it exists
if [ -f /config/coins.json ]; then
    echo "Copying coins.json to /app/build/"
    cp /config/coins.json /app/build/coins.json
    chmod 644 /app/build/coins.json
else
    echo "Warning: /config/coins.json not found, using default coins.json"
fi

# Execute the original command
exec "$@"
