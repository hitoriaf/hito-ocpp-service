#!/bin/bash

echo "Waiting for database..."
sleep 5

echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec npm start