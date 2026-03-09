#!/usr/bin/env tsx
/**
 * 数据库迁移脚本
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

    // 使用 PrismaPg 适配器创建连接
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
        console.log('Running database migrations...');

        await prisma.$connect();
        console.log('✓ Database connected');

        // 使用 $queryRaw 执行原始 SQL 查询检查 Role 表是否存在
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
            
            // 断开 Prisma 连接，让 prisma migrate deploy 可以执行
            await prisma.$disconnect();
            
            // 使用 child_process 执行 prisma migrate deploy 命令
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
                
                // 重新连接数据库
                await prisma.$connect();
            } catch (migrationError) {
                console.error('❌ Migration failed:', migrationError);
                throw migrationError;
            }
        }

        // 检查是否需要初始化
        const roleCount = await prisma.role.count();

        if (roleCount === 0) {
            console.log('Initializing default roles...');

            // 创建默认角色
            await prisma.role.createMany({
                data: [
                    {
                        id: 'user-role-id',
                        name: 'USER',
                        description: '普通用户',
                        permissions: ['chat', 'search']
                    },
                    {
                        id: 'admin-role-id',
                        name: 'ADMIN',
                        description: '管理员',
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
