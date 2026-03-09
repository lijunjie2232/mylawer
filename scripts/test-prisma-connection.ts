#!/usr/bin/env tsx
/**
 * Prisma 连接测试脚本
 * 
 * 使用方法:
 * npx tsx scripts/test-prisma-connection.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('Testing database connection...');
  console.log(`DATABASE_URL: ${connectionString.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@')}`);
  
  // 使用 PrismaPg 适配器创建连接
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$connect();
    console.log('✅ Database connection successful!');

    // 检查表是否存在
    const tableExistsResult = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'Role'
      ) as exists;
    `;

    const tableExists = (tableExistsResult as any)[0].exists;
    
    if (tableExists) {
      console.log('✅ Role table exists');
      
      // 查询角色数量
      const roleCount = await prisma.role.count();
      console.log(`📊 Number of roles: ${roleCount}`);
      
      if (roleCount > 0) {
        const roles = await prisma.role.findMany();
        console.log('\nRoles:');
        roles.forEach(role => {
          console.log(`  - ${role.name}: ${role.description}`);
        });
      }
    } else {
      console.log('⚠️  Role table does not exist. Run migrations first.');
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Connection test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testConnection().catch(console.error);
