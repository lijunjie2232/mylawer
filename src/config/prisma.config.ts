/**
 * Prisma 配置文件
 * 
 * Prisma 7.x 版本要求将数据库连接配置放在这里
 * 而不是在 schema.prisma 中
 */

import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
