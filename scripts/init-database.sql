-- Law Assistant Database Initialization Script
-- This script creates database, user and grants all necessary permissions

-- Parameters (to be replaced by environment variables in shell script):
-- :POSTGRES_USER - The database user name
-- :POSTGRES_PASSWORD - The database password  
-- :POSTGRES_DB - The database name

-- Create database if not exists
SELECT 'CREATE DATABASE ${POSTGRES_DB}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${POSTGRES_DB}')\gexec

-- Create user if not exists
SELECT 'CREATE USER ${POSTGRES_USER} WITH PASSWORD '\''${POSTGRES_PASSWORD}'\''' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${POSTGRES_USER}')\gexec

-- Grant superuser and admin privileges
ALTER USER ${POSTGRES_USER} WITH SUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN;

-- Grant database permissions
GRANT ALL PRIVILEGES ON DATABASE ${POSTGRES_DB} TO ${POSTGRES_USER};

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO ${POSTGRES_USER};

-- Grant permissions for all existing objects
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${POSTGRES_USER};
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${POSTGRES_USER};
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${POSTGRES_USER};

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${POSTGRES_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${POSTGRES_USER};
