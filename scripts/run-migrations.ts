#!/usr/bin/env tsx
/**
 * データベースマイグレーションスクリプト
 * 
 * 使用方法:
 * npx tsx scripts/run-migrations.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function runMigrations() {
    const connectionString = process.env.DATABASE_URL;
    
    if (!connectionString) {
        throw new Error('DATABASE_URL environment variable is not set');
    }

    // PrismaPg アダプターを使用して接続を作成
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
        console.log('Running database migrations...');

        await prisma.$connect();
        console.log('✓ Database connected');

        // $queryRaw を使用して Role テーブルが存在するか生 SQL クエリを実行
        const tableExistsResult = await prisma.$queryRaw`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'Role'
            ) as exists;
        `;

        const tableExists = (tableExistsResult as any)[0].exists;

        if (!tableExists) {
            throw new Error('Database tables not found. Please run database migrations.');
            console.log('⚠️  Database tables not yet created. Running migrations...');
            
            // Prisma 接続を切断して prisma migrate deploy の実行を許可
            await prisma.$disconnect();
            
            // child_process を使用して prisma migrate deploy コマンドを実行
            const { exec } = await import('child_process');
            const util = await import('util');
            const execPromise = util.promisify(exec);
            
            try {
                console.log('Executing: pnpm prisma migrate dev --name init');
                const { stdout, stderr } = await execPromise('pnpm prisma migrate dev --name init');
                
                if (stdout) {
                    console.log('Migration output:', stdout);
                }
                if (stderr) {
                    console.warn('Migration warnings:', stderr);
                }
                
                console.log('✓ Database tables created successfully');
                
                // データベース接続を再開
                await prisma.$connect();
            } catch (migrationError) {
                console.error('❌ Migration failed:', migrationError);
                throw migrationError;
            }
        }

        // 初期化が必要か確認
        const roleCount = await prisma.role.count();

        if (roleCount === 0) {
            console.log('Initializing default roles...');

            // デフォルトロールを作成
            await prisma.role.createMany({
                data: [
                    {
                        id: 'user-role-id',
                        name: 'USER',
                        description: '一般ユーザー',
                        permissions: ['chat', 'search']
                    },
                    {
                        id: 'admin-role-id',
                        name: 'ADMIN',
                        description: '管理者',
                        permissions: ['chat', 'search', 'manage_users', 'manage_system']
                    }
                ]
            });

            console.log('✓ Default roles created');
        } else {
            console.log('✓ Roles already exist, skipping initialization');
        }

        console.log('✓ Migrations completed');
    } catch (error) {
        console.error('Migration error:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

runMigrations().catch(console.error);
