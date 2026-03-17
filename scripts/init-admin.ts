#!/usr/bin/env tsx
/**
 * 管理者アカウント初期化スクリプト
 * 
 * 使用方法:
 * npx tsx scripts/init-admin.ts
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';

// Prisma クライアントインスタンスの作成
const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function initializeAdmin() {
  try {
    console.log('========================================');
    console.log('デフォルト管理者アカウントの初期化');
    console.log('========================================\n');

    // データベース接続
    console.log('データベース接続中...');
    await prisma.$connect();
    console.log('✓ データベース接続成功\n');

    // ADMIN ロールが存在するか確認
    let adminRole = await prisma.role.findUnique({
      where: { name: 'ADMIN' }
    });

    if (!adminRole) {
      console.log('ADMIN ロール作成中...');
      adminRole = await prisma.role.create({
        data: {
          name: 'ADMIN',
          description: 'システム管理者',
          permissions: ['*'] // すべての権限
        }
      });
      console.log('✓ ADMIN ロール作成成功\n');
    } else {
      console.log('✓ ADMIN ロールは既に存在します\n');
    }

    // 管理者アカウントが既に存在するか確認
    const existingAdmin = await prisma.user.findFirst({
      where: { email: 'admin@example.com' }
    });

    if (existingAdmin) {
      console.log('✓ 管理者アカウントは既に存在します、スキップします');
      console.log(`邮箱：${existingAdmin.email}`);
    } else {
      // デフォルト管理者アカウントを作成
      console.log('デフォルト管理者アカウント作成中...');
      
      const defaultAdminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
      const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@123';
      
      // パスワードのハッシュ化
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
      
      console.log('✓ 管理者アカウント作成成功\n');
      console.log('\n========================================');
      console.log('✓ 初期化完了！');
      console.log('========================================');
      console.log('\nデフォルト管理者アカウント情報:');
      console.log(`邮箱：${defaultAdminEmail}`);
      console.log(`密码：${defaultAdminPassword}`);
      console.log('\n⚠️  重要：初回ログイン後、直ちにパスワードを変更してください！\n');
    }

    // データベース接続を切断
    await prisma.$disconnect();
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 初始化失败:', (error as Error).message);
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// 初期化を実行
initializeAdmin();
