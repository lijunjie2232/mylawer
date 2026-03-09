// 用户角色枚举
export type UserRole = 'USER' | 'ADMIN';

// 用户基本信息
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 数据库中的用户模型（包含密码哈希）
export interface UserWithPasswordHash {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  roleId: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 角色信息
export interface Role {
  id: string;
  name: UserRole;
  description?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// 登录请求
export interface LoginRequest {
  email: string;
  password: string;
}

// 注册请求
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

// 登录响应
export interface LoginResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
  timestamp: string;
}

// 注册响应
export interface SignupResponse {
  success: boolean;
  message: string;
  user: Omit<User, 'passwordHash'>;
  timestamp: string;
}

// 用户信息响应
export interface UserProfileResponse {
  success: boolean;
  user: User;
  timestamp: string;
}

// 管理员 - 用户列表响应
export interface UserListResponse {
  success: boolean;
  users: User[];
  total: number;
  timestamp: string;
}

// 管理员 - 更新用户请求
export interface UpdateUserRequest {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// Token 验证中间件的 Request 扩展
export interface AuthenticatedRequest {
  user?: JWTPayload;
}

// 服务器统计信息
export interface ServerStats {
  uptime: number;
  memory: {
    used: number;
    total: number;
    free: number;
  };
  platform: string;
  nodeVersion: string;
  cpuCores: number;
}

// 管理员仪表板响应
export interface DashboardResponse {
  success: boolean;
  serverInfo: ServerStats;
  stats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
  };
  timestamp: string;
}
