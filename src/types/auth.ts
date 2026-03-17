// ユーザーロール列挙型
export type UserRole = 'USER' | 'ADMIN';

// ユーザー基本情報
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

// データベース内のユーザーモデル（パスワードハッシュを含む）
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

// ロール情報
export interface Role {
  id: string;
  name: UserRole;
  description?: string;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
}

// JWT ペイロード
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// ログインリクエスト
export interface LoginRequest {
  email: string;
  password: string;
}

// 登録リクエスト
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
}

// ログインレスポンス
export interface LoginResponse {
  success: boolean;
  token: string;
  expiresIn: number;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
  timestamp: string;
}

// 登録レスポンス
export interface SignupResponse {
  success: boolean;
  message: string;
  user: Omit<User, 'passwordHash'>;
  timestamp: string;
}

// ユーザープロファイルレスポンス
export interface UserProfileResponse {
  success: boolean;
  user: User;
  timestamp: string;
}

// 管理者 - ユーザーリストレスポンス
export interface UserListResponse {
  success: boolean;
  users: User[];
  total: number;
  timestamp: string;
}

// 管理者 - ユーザー更新リクエスト
export interface UpdateUserRequest {
  email?: string;
  name?: string;
  role?: UserRole;
  isActive?: boolean;
}

// トークン検証ミドルウェアの リクエスト拡張
export interface AuthenticatedRequest {
  user?: JWTPayload;
}

// サーバー統計情報
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

// 管理者ダッシュボードレスポンス
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
