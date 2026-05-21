psql -U postgres -c 'SHOW config_file;'
#!/bin/bash
set -e

# --- Configuration Setup ---
# Default fallbacks if environment variables aren't passed at runtime
DB_DATA_DIR="/var/lib/postgresql/18/main"
DB_USER="${POSTGRES_USER:-myuser}"
DB_PASSWORD="${POSTGRES_PASSWORD:-mypassword}"
DB_NAME="${POSTGRES_DB:-mydatabase}"

# --- Step 1: Ensure Correct Directory Ownership ---
# PostgreSQL binaries refuse to run if data directories are owned by root
echo "Setting up storage permissions..."
mkdir -p "$DB_DATA_DIR" /var/run/postgresql
chown -R postgres:postgres "$DB_DATA_DIR" /var/run/postgresql
chmod 700 "$DB_DATA_DIR"

# --- Step 2: Initialize Database Cluster ---
# Check if the data directory is empty. If it is, run initdb.
if [ -z "$(ls -A "$DB_DATA_DIR")" ]; then
    echo "No database found. Initializing PostgreSQL data directory..."
    sudo -u postgres /usr/lib/postgresql/18/bin/initdb -D "$DB_DATA_DIR"
    
    # --- Step 3: Start a Temporary Postgres Instance ---
    echo "Starting temporary PostgreSQL server for provisioning..."
    # We bind listen_addresses to empty '' so it only accepts local Unix sockets during setup (secure)
    sudo -u postgres /usr/lib/postgresql/18/bin/pg_ctl -D "$DB_DATA_DIR" -o "-c listen_addresses=''" -w start

    # --- Step 4: Provision User, Database, and Tables ---
    echo "Creating user '$DB_USER' and database '$DB_NAME'..."
    
    # Handle the superuser password first (or create a new user if not using default 'postgres')
    if [ "$DB_USER" = "postgres" ]; then
        sudo -u postgres psql --command "ALTER USER postgres WITH PASSWORD '$DB_PASSWORD';"
    else
        sudo -u postgres psql --command "CREATE USER $DB_USER WITH SUPERUSER PASSWORD '$DB_PASSWORD';"
    fi

    # Create the application database owned by your specified user
    sudo -u postgres psql --command "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

EOSQL

    # --- Step 5: Graceful Shutdown ---
    echo "Database provisioning complete. Shutting down temporary instance..."
    sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl -D "$DB_DATA_DIR" -m fast -w stop

else
    echo "Database directory already initialized. Skipping provisioning step."
fi

# --- Step 6: Handover Execution ---
# Keep your container alive by forwarding execution to whatever process manager (like supervisor) or CMD you use.
echo "Starting final process manager..."
exec "$@"