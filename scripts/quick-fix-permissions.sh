#!/bin/bash
# Quick fix script to grant full permissions to law_user
# Usage: ./scripts/quick-fix-permissions.sh [container_name]

CONTAINER_NAME="${1:-law-assistant-single}"

echo "=== PostgreSQL User Permission Fix ==="
echo "Container: $CONTAINER_NAME"
echo ""

# Check if container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "❌ Container '$CONTAINER_NAME' is not running!"
    echo "Please start the container first."
    exit 1
fi

echo "✅ Container found, granting permissions..."
echo ""

# Grant full permissions
echo "Granting SUPERUSER, CREATEDB, CREATEROLE, REPLICATION permissions..."
docker exec -i "$CONTAINER_NAME" psql -U postgres -c "ALTER USER law_user WITH SUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN;"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Permissions granted successfully!"
    echo ""
    echo "Verifying permissions..."
    docker exec -i "$CONTAINER_NAME" psql -U postgres -c "\du law_user"
    echo ""
    echo "Detailed permission info:"
    docker exec -i "$CONTAINER_NAME" psql -U postgres -c "SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname = 'law_user';"
    echo ""
    echo "🎉 All permissions have been granted!"
    echo ""
    echo "You can now run: pnpm db:migrate"
else
    echo ""
    echo "❌ Failed to grant permissions!"
    echo "Make sure the container name is correct and PostgreSQL is running."
    exit 1
fi
