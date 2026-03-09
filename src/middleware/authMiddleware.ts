import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger.js';
import { AuthService } from '../services/authService.js';
import type { JWTPayload, AuthenticatedRequest } from '../types/auth';

// 扩展 Express Request 类型
interface AuthRequest extends Request, AuthenticatedRequest {}

/**
 * 验证 JWT Token 中间件
 */
export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      Logger.warn('缺少 Authorization header');
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header is required',
      });
      return;
    }

    // 支持 "Bearer <token>" 格式
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      Logger.warn('Authorization header 格式错误');
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header must be in format: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // 验证 token
    const authService = AuthService.getInstance();
    const payload = authService.verifyToken(token);

    // 将用户信息附加到 request 上
    req.user = payload;

    Logger.debug('Token 验证成功', { 
      userId: payload.userId, 
      role: payload.role 
    });

    next();
  } catch (error) {
    Logger.error('Token 验证失败', { error: (error as Error).message });
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: `Invalid or expired token: ${(error as Error).message}`,
    });
  }
}

/**
 * 角色授权中间件
 * @param allowedRoles 允许访问的角色列表
 */
export function authorizeRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        Logger.warn('未找到用户信息，请先登录');
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'User not authenticated',
        });
        return;
      }

      const userRole = req.user.role;

      // 检查用户角色是否在允许列表中
      if (!allowedRoles.includes(userRole)) {
        Logger.warn('用户权限不足', { 
          userId: req.user.userId, 
          role: userRole,
          requiredRoles: allowedRoles 
        });
        
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `Insufficient permissions. Required one of: ${allowedRoles.join(', ')}`,
        });
        return;
      }

      Logger.debug('角色授权通过', { 
        userId: req.user.userId, 
        role: userRole 
      });

      next();
    } catch (error) {
      Logger.error('角色授权失败', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to authorize user',
      });
    }
  };
}

/**
 * 可选的认证中间件（有 token 则验证，没有也允许访问）
 */
export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      // 没有 token，继续执行
      next();
      return;
    }

    const parts = authHeader.split(' ');
    
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const authService = AuthService.getInstance();
      
      try {
        const payload = authService.verifyToken(token);
        req.user = payload;
        Logger.debug('可选认证 - Token 验证成功', { userId: payload.userId });
      } catch (error) {
        Logger.debug('可选认证 - Token 无效，继续执行', { 
          error: (error as Error).message 
        });
      }
    }

    next();
  } catch (error) {
    Logger.debug('可选认证失败，继续执行', { 
      error: (error as Error).message 
    });
    next();
  }
}
