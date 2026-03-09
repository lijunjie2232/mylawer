#!/bin/bash
set -e

echo "=== Law Assistant Docker Container Startup ==="

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

# Function to wait for PostgreSQL to be ready
wait_for_postgres() {
    echo "Waiting for PostgreSQL to be ready..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if pg_isready -h localhost -U postgres > /dev/null 2>&1; then
            echo "PostgreSQL is ready!"
            return 0
        fi
        attempt=$((attempt + 1))
        echo "Attempt $attempt/$max_attempts - PostgreSQL not ready yet, waiting..."
        sleep 2
    done
    
    echo "ERROR: PostgreSQL failed to start after $max_attempts attempts"
    return 1
}

# Initialize PostgreSQL if needed
if [ ! -f /var/lib/postgresql/data/PG_VERSION ]; then
    echo "Initializing PostgreSQL database..."
    
    # Use environment variables or defaults
    export POSTGRES_USER="${POSTGRES_USER:-law_user}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-law_password}"
    export POSTGRES_DB="${POSTGRES_DB:-law_assistant}"
    
    echo "Using POSTGRES_USER: $POSTGRES_USER"
    echo "Using POSTGRES_DB: $POSTGRES_DB"
    
    # Switch to postgres user to initialize
    su - postgres -c "/usr/lib/postgresql/*/bin/initdb -D /var/lib/postgresql/data"
    
    # Start PostgreSQL temporarily for initialization
    echo "Starting PostgreSQL for initialization..."
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/data/logfile start"
    
    # Wait for PostgreSQL to be ready
    wait_for_postgres
    
    # Create database and user with full permissions
    echo "Creating database and user with full permissions..."
    su - postgres -c "psql -c \"CREATE DATABASE $POSTGRES_DB;\"" || true
    su - postgres -c "psql -c \"CREATE USER $POSTGRES_USER WITH PASSWORD '$POSTGRES_PASSWORD';\"" || true
    su - postgres -c "psql -c \"ALTER USER $POSTGRES_USER WITH SUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL ON SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $POSTGRES_USER;\"" || true
    
    # Stop PostgreSQL
    echo "Stopping PostgreSQL..."
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data stop"
else
    echo "PostgreSQL data already exists, skipping initialization"
    
    # Ensure user permissions are set even for existing databases
    echo "Checking and fixing user permissions..."
    export POSTGRES_USER="${POSTGRES_USER:-law_user}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-law_password}"
    export POSTGRES_DB="${POSTGRES_DB:-law_assistant}"
    
    # Start PostgreSQL temporarily to fix permissions
    echo "Starting PostgreSQL temporarily to apply permissions..."
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/data/logfile start"
    wait_for_postgres
    
    # Grant full permissions to the user (idempotent operation)
    echo "Granting full permissions to $POSTGRES_USER..."
    su - postgres -c "psql -c \"ALTER USER $POSTGRES_USER WITH SUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN;\"" || true
    su - postgres -c "psql -c \"GRANT ALL ON SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $POSTGRES_DB TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;\"" || true
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO $POSTGRES_USER;\"" || true
    
    # Stop PostgreSQL
    echo "Stopping PostgreSQL after permission fix..."
    su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data stop"
fi



# Start PostgreSQL in background
echo "Starting PostgreSQL..."
chown -R postgres:postgres /var/lib/postgresql/data
chown -R postgres:postgres /run/postgresql
su - postgres -c "/usr/lib/postgresql/*/bin/pg_ctl -D /var/lib/postgresql/data -l /var/lib/postgresql/data/logfile start"

# Wait for PostgreSQL to be ready
wait_for_postgres


# Update DATABASE_URL environment variable if not set
if [ -z "$DATABASE_URL" ]; then
    # Use environment variables or defaults
    export POSTGRES_USER="${POSTGRES_USER:-law_user}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-law_password}"
    export POSTGRES_DB="${POSTGRES_DB:-law_assistant}"
    
    export DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@localhost:5432/$POSTGRES_DB?schema=public"
    echo "Set default DATABASE_URL: $DATABASE_URL"
fi

# Ensure other required environment variables are set
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET="docker_default_jwt_secret_change_in_production_$(date +%s)"
    echo "Set default JWT_SECRET"
fi

if [ -z "$LLM_API_KEY" ]; then
    echo "WARNING: LLM_API_KEY is not set. The application may not work correctly."
fi

# Run database migrations (includes admin initialization)
if [ "$RUN_MIGRATIONS" = "true" ] || [ "$INIT_ADMIN" = "true" ]; then
    echo "========================================"
    echo "Database Initialization"
    echo "========================================"
    cd /app

    # 测试数据库连接
    pnpm db:test-connection
    # Generate Prisma Client first
    echo "Generating Prisma Client..."
    # npx prisma generate || echo "WARNING: Prisma generate failed"
    pnpm dlx prisma migrate deploy --schema ./prisma/schema.prisma --config ./prisma.config.ts
    pnpm dlx prisma generate
    # 测试数据库连接
    pnpm db:test-connection

    
    # Run database migrations
    if [ "$RUN_MIGRATIONS" = "true" ]; then
        echo ""
        echo "Running database migrations..."
        # npx tsx scripts/run-migrations.ts || echo "WARNING: Database migration failed"
        pnpm tsx scripts/run-migrations.ts
    fi
    
    # Initialize admin user separately
    if [ "$INIT_ADMIN" = "true" ]; then
        echo ""
        echo "Initializing admin user..."
        # npx tsx scripts/init-admin.ts || echo "WARNING: Admin initialization failed"
        pnpm tsx scripts/init-admin.ts
    fi
    
    echo ""
    echo "========================================"
    echo "Database initialization completed"
    echo "========================================"
fi

echo "=== Starting Application ==="

# Execute the main command
exec "$@"
