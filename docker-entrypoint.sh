#!/bin/sh
set -e

echo "Pushing database schema..."
npx drizzle-kit push --force
echo "Schema ready."

echo "Seeding default admin user..."
npx tsx server/seed.ts
echo "Seed complete."

echo "Starting application..."
exec node dist/index.js
