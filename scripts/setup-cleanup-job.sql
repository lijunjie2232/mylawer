-- 1. Enable the pg_cron extension (Must be run by a superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the cleanup job
-- This job runs every day at midnight ('0 0 * * *')
SELECT cron.schedule('daily-user-cleanup', '0 0 * * *', $$
    DO i$
    DECLARE
        target_date TIMESTAMP := NOW() - INTERVAL '7 days';
    BEGIN
        -- A. Delete LangGraph Checkpoints first
        -- These are linked via thread_id (text) to ChatSession.id (uuid)
        
        -- Delete from checkpoint_writes
        DELETE FROM checkpoint_writes WHERE thread_id IN (
            SELECT s.id::text FROM "ChatSession" s 
            JOIN "User" u ON s."userId" = u.id 
            WHERE u."createdAt" < target_date
        );
        
        -- Delete from checkpoint_blobs
        DELETE FROM checkpoint_blobs WHERE thread_id IN (
            SELECT s.id::text FROM "ChatSession" s 
            JOIN "User" u ON s."userId" = u.id 
            WHERE u."createdAt" < target_date
        );
        
        -- Delete from checkpoints
        DELETE FROM checkpoints WHERE thread_id IN (
            SELECT s.id::text FROM "ChatSession" s 
            JOIN "User" u ON s."userId" = u.id 
            WHERE u."createdAt" < target_date
        );

        -- B. Delete the Users
        -- This will automatically cascade to "ChatSession" and "Message" 
        -- due to the 'onDelete: Cascade' defined in prisma/schema.prisma
        DELETE FROM "User" WHERE "createdAt" < target_date;
        
        RAISE NOTICE 'Cleanup completed for data older than %', target_date;
    END i$;
$$);
