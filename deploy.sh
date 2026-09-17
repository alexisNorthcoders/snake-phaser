#!/bin/bash

# Deploy script for snake-phaser game
# Rebuilds the game and copies to nginx directory

set -e

echo "🎮 Building snake-phaser..."
npm run build

echo "📋 Copying to /var/www/snakemp..."
sudo rm -rf /var/www/snakemp/*
sudo cp -r dist/* /var/www/snakemp/
sudo chown -R www-data:www-data /var/www/snakemp

echo "✅ Deployment complete! Game updated at https://snakemp.duckdns.org/"
