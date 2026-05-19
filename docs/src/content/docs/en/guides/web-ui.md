---
title: Web UI Guide
description: How to use the Law Assistant web chat interface.
---

The Web UI is the primary way for users to interact with Law Assistant. It provides a sleek, modern chat interface with support for multiple sessions and detailed AI responses.

## Getting Started

1.  Start the application and navigate to `http://localhost:3000`.
2.  Login with your credentials.
    - Default Admin: `admin@example.com` / `Admin123!@#`

## Key Features

### 1. Chat Dashboard
The main screen features a clean chat area where you can ask legal questions. Responses are streamed character-by-character as the AI processes them.

### 2. Session Sidebar
On the left, you'll find your chat history. You can:
- **Create New Sessions**: Start a fresh conversation.
- **Switch Sessions**: Go back to previous legal consultations.
- **Delete Sessions**: Clean up your history.

### 3. Model Selection
In the chat settings, you can choose which LLM to use for the current session (e.g., GPT-4o, Claude 3.5 Sonnet), provided they are enabled in your configuration.

## Using Tools in the UI

You don't need to manually trigger tools. When you ask a question like *"What does the Labor Contract Act say about dismissal?"*, you will see status indicators in the chat area showing that the agent is "Searching Legal Documents" or "Consulting the Web".

## User Settings

- **Profile**: Change your password and view account details.
- **Logout**: Securely end your session.

## Troubleshooting

- **Connection Lost**: If the chat stops responding, refresh the page. The system will automatically restore your session history from the database.
- **Unauthorized**: Your session may have expired. Log in again to obtain a new JWT token.
