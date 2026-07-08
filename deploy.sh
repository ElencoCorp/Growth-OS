#!/bin/bash
# Deployment script for VPS automation

set -e

echo "=> Fetching latest updates from origin main..."
git pull origin main

echo "=> Tearing down old containers..."
docker compose down

echo "=> Rebuilding and starting Docker containers in detached mode..."
docker compose up -d --build

echo "=> Cleaning up unused Docker resources to save VPS disk space..."
docker system prune -f

echo "=> Deployment completed successfully! Application is live on port 3000."
