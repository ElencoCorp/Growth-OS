#!/bin/bash
set -e

echo "Pulling latest changes from git..."
git pull

echo "Building and restarting containers in detached background mode..."
docker-compose up -d --build

echo "Running hard prune cleanup operation..."
docker system prune -f

echo "Deployment complete! App is running on port 3000."
