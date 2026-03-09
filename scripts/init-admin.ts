#!/usr/bin/env tsx
/**
 * 初始化管理员账户脚本
 * 
 * 使用方法:
 * npx tsx scripts/init-admin.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';

// 创建 Prisma 客户端实例
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function initializeAdmin() {
  try {
    console.log('========================================');
    console.log('初始化默认管理员账户');
    console.log('========================================\n');

    // 连接数据库
    console.log('正在连接数据库...');
    await prisma.$connect();
    console.log('✓ 数据库连接成功\n');

    // 检查是否存在 ADMIN 角色
    let adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('正在创建 ADMIN 角色...');
      adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: '系统管理员',
          permissions: ['*'] // 所有权限
        }
      });
      console.log('✓ ADMIN 角色创建成功\n');
    } else {
      console.log('✓ ADMIN 角色已存在\n');
    }

    // 检查是否已存在管理员账户
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@example.com' }
    });

    if (existingAdmin) {
      console.log('✓ 管理员账户已存在，跳过创建');
      console.log(`邮箱：${existingAdmin.email}`);
    } else {
      // 创建默认管理员账户
      console.log('正在创建默认管理员账户...');
      
      const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
      const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
      
      // 密码加密
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(defaultAdminPassword, saltRounds);
      
      const adminUser = await prisma.user.create({
        data: {
          email: defaultAdminEmail,
          passwordHash,
          name: '系统管理员',
          roleId: adminRole.id,
          isActive: true
        }
      });
      
      console.log('✓ 管理员账户创建成功\n');
      console.log('\n========================================');
      console.log('✓ 初始化完成！');
      console.log('========================================');
      console.log('\n默认管理员账户信息:');
      console.log(`邮箱：${defaultAdminEmail}`);
      console.log(`密码：${defaultAdminPassword}`);
      console.log('\n⚠️  重要提示：请在首次登录后立即修改密码！\n');
    }

    // 断开数据库连接
    await prisma.$disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', (error as Error).message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// 运行初始化
initializeAdmin();
