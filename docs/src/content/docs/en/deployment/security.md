---
title: Security & Authentication
description: Protecting your Law Assistant deployment.
---

Security is a top priority for Law Assistant. We implement multiple layers of protection to ensure that your legal data and AI sessions are secure.

## Authentication System

Law Assistant uses **JSON Web Tokens (JWT)** for stateless authentication.

### User Roles
1.  **User**: Can create sessions, chat with the AI, and manage their own history.
2.  **Admin**: Can manage all users, view system statistics, and configure global settings.

### Configuration
Set these in your `.env`:
- **`JWT_SECRET`**: A strong, unique string used to sign tokens. Never share this.
- **`JWT_EXPIRES_IN`**: How long a session remains valid (default 24h).

## Initial Admin Setup

The first time you run the application, it creates a default administrator if `INIT_ADMIN=true` is set.

- **Default Email**: `admin@example.com`
- **Default Password**: `Admin123!@#`

**Action Required**: Immediately change the admin password via the Profile section of the Web UI after your first login.

## CORS & Network Security

### Cross-Origin Resource Sharing (CORS)
In development, the server allows requests from all origins. In production, you should restrict this to your specific frontend domain.

```typescript
// CORS 設定
if (config.app.env === 'development') {
  this.app.use(cors({ origin: '*' }));
}
```

### LINE Signature Validation
For the LINE Bot integration, every request from LINE is validated against the `LINE_CHANNEL_SECRET`. This prevents unauthorized parties from triggering the AI or accessing chat data via the webhook endpoint.

## Data Encryption

- **Passwords**: Stored as hashed strings using modern cryptographic algorithms. We never store plain-text passwords.
- **Tokens**: Sensitive API keys for LLM providers are stored in memory from environment variables and never logged or exposed in the UI.

## Best Practices

1.  **HTTPS**: Always run Law Assistant behind an SSL/TLS proxy (like Nginx or Caddy) in production.
2.  **Environment Isolation**: Use different `.env` files for development and production.
3.  **Audit Logs**: Monitor the `LOG_LEVEL=info` output to track logins and administrative actions.

## Next Steps

- Explore the [API Reference](../../reference/api/).
- Learn about [LLM Providers](../../config/llm/).
