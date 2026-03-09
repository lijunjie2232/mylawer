-- Fix PostgreSQL user permissions for Prisma migrations
-- Run this if you already have a law_user without full permissions

-- Grant full permissions to law_user (for development environment)
-- This includes SUPERUSER, CREATEDB, CREATEROLE, and REPLICATION
ALTER USER law_user WITH SUPERUSER CREATEDB CREATEROLE REPLICATION LOGIN;

-- Verify the permissions were granted
\du law_user

-- You should see all attributes enabled:
-- Superuser, Create role, Create DB, Replication
