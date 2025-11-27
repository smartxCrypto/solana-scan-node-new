#!/bin/bash

set -e

rm -rf dist
npm run build
cp -r dist/* ../solana-scan/
cd ../solana-scan && npm install --production && cd ../solana-scan-node-new

pm2 stop all
sleep 3
pm2 start all
sleep 2
pm2 status