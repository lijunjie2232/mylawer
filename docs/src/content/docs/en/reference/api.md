---
title: API Reference
description: Documentation for the Law Assistant REST API.
---

Law Assistant provides a comprehensive REST API for integration with other applications. All API endpoints (except Webhooks and Public Info) require JWT authentication.

## Authentication

Include your JWT token in the `Authorization` header of every request:

```http
Authorization: Bearer <your_jwt_token>
```

## Core Endpoints

### 1. Legal Query Engine

#### `POST /api/legal/query`
The primary endpoint for non-streaming legal questions.

- **Body**: `{ "question": "...", "model": "...", "sessionId": "..." }`
- **Response**: `{ "success": true, "answer": "...", "sessionId": "..." }`

#### `POST /api/legal/query/stream`
The streaming version of the query engine. Returns a `text/event-stream`.

### 2. Chat Session Management

#### `GET /api/chat/sessions`
Returns a list of all chat sessions for the authenticated user.

#### `POST /api/chat/sessions`
Create a new session with a custom title.

#### `GET /api/chat/sessions/:sessionId/messages`
Retrieve the message history for a specific session.

### 3. System & Models

#### `GET /health` (Public)
Checks the status of the server and database.

#### `GET /models` (Public)
Returns a list of LLM models that are currently configured and allowed by the administrator.

## Webhooks

#### `POST /webhook` (Public)
Endpoint for the LINE Messaging API. This endpoint performs its own signature validation.

## Documentation (Swagger)

A full, interactive OpenAPI/Swagger specification is available directly from your running instance:

- **Swagger UI**: [http://localhost:3000/docs](http://localhost:3000/docs)
- **OpenAPI JSON**: [http://localhost:3000/docs-json](http://localhost:3000/docs-json)

## Error Handling

The API uses standard HTTP status codes:
- `200/201`: Success.
- `400`: Bad Request (invalid parameters).
- `401`: Unauthorized (missing or invalid token).
- `403`: Forbidden (insufficient permissions).
- `500`: Internal Server Error.

Responses for errors usually follow this format:
```json
{
  "success": false,
  "message": "Detailed error message here"
}
```
