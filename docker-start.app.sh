#!/bin/bash
set -e

echo "=== Law Assistant Application Container Startup ==="

# Setup XVFB for headless browser automation
export DISPLAY=:99
if command -v Xvfb &> /dev/null; then
   echo "Starting XVFB on display :99..."
    Xvfb :99 -screen 0 1280x720x24 &
    XVFB_PID=$!
    sleep 2
   echo "XVFB started with PID: $XVFB_PID"
else
   echo "WARNING: XVFB not found, browser automation may not work"
fi

# Function to wait for database to be ready
wait_for_database() {
   echo "Waiting for database to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${POSTGRES_USER:-law_user}" > /dev/null 2>&1; then
           echo "Database is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
       echo "Attempt $attempt/$max_attempts - Database not ready yet, waiting..."
        sleep 2
    done
    
   echo "ERROR: Database failed to be ready after $max_attempts attempts"
    return 1
}

# Wait for external database to be ready
echo "========================================"
echo "Database Connection Check"
echo "========================================"
echo "Connecting to database at ${DB_HOST:-postgres}:${DB_PORT:-5432}"
wait_for_database

# Update DATABASE_URL environment variable if not set
if [ -z "$DATABASE_URL" ]; then
    export POSTGRES_USER="${POSTGRES_USER:-law_user}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-law_password}"
    export POSTGRES_DB="${POSTGRES_DB:-law_assistant}"
    export DB_HOST="${DB_HOST:-postgres}"
    export DB_PORT="${DB_PORT:-5432}"
    
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@$DB_HOST:$DB_PORT/$POSTGRES_DB?schema=public"
   echo "Set DATABASE_URL: $DATABASE_URL"
fi

# Ensure other required environment variables are set
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET="docker_default_jwt_secret_change_in_production_$(date +%s)"
   echo "Set default JWT_SECRET"
fi

if [ -z "$LLM_API_KEY" ]; then
   echo "WARNING: LLM_API_KEY is not set. The application may not work correctly."
fi

# Run database migrations and initialize admin
echo "========================================"
echo "Database Initialization"
echo "========================================"
cd /app

# Test database connection
pnpm db:test-connection

# Generate Prisma Client
echo "Generating Prisma Client..."
pnpm dlx prisma generate

# Apply database migrations
echo "Applying database migrations..."
pnpm dlx prisma migrate dev --name init --schema ./prisma/schema.prisma --config ./prisma.config.ts

# Test database connection again
pnpm db:test-connection

# Run database migrations script
echo "Running database migration scripts..."
pnpm tsx scripts/run-migrations.ts

# Initialize admin user
echo "Initializing admin user..."
pnpm tsx scripts/init-admin.ts

echo ""
echo "========================================"
echo "Database initialization completed"
echo "========================================"

echo "=== Starting Application ==="

# Execute the main command
exec "$@"
