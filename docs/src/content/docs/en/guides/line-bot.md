---
title: LINE Bot Integration
description: Connecting Law Assistant to the LINE Messaging API.
---

Integrating Law Assistant with LINE allows users to consult with the legal AI directly from their mobile devices.

## Setup Overview

1.  Create a **LINE Developers** account and a **Messaging API** channel.
2.  Configure your **Webhook URL** to point to your Law Assistant instance.
3.  Add the **Channel Secret** and **Access Token** to your `.env`.

## Detailed Steps

### 1. LINE Developers Console
- Visit [LINE Developers](https://developers.line.biz/).
- Create a Provider and then a Messaging API channel.
- **Channel secret**: Found in the "Basic settings" tab.
- **Channel access token**: Issued in the "Messaging API" tab.

### 2. Environment Configuration
Add the following to your `.env` file:

```bash
LINE_CHANNEL_SECRET=your_secret_here
LINE_ACCESS_TOKEN=your_token_here
```

### 3. Webhook URL
In the "Messaging API" tab of the LINE Developers Console:
- **Webhook URL**: `https://your-domain.com/webhook`
- **Verify**: Click the "Verify" button to ensure your server is reachable.
- **Use webhook**: Enable this toggle.

> **Note**: For local development, use a tool like **ngrok** to expose your local port (default 3000) to the internet.

## AI Capabilities on LINE

When a user sends a message on LINE, Law Assistant:
1.  Verifies the `X-Line-Signature`.
2.  Loads the conversation history for that specific LINE User ID.
3.  Runs the Agent with all available **MCP Tools**.
4.  Replies with a series of text messages (splitting long responses if necessary).

## Commands

Users can use special commands in the LINE chat:
- `/start` or `/help`: Display a welcome message and instructions.
- `/clear`: Reset the conversation history for the current user.
- `/models`: View which LLM is currently processing the requests.

## Security Considerations

- **Signature Validation**: Law Assistant automatically validates every request from LINE to prevent spoofing.
- **Data Privacy**: LINE chat history is stored in your PostgreSQL database, separate from the Web UI sessions, linked by the LINE User ID.

## Next Steps

- Learn about [Docker Deployment](../../deployment/docker/).
- View the [MCP Tool System](../../concepts/mcp-tools/).
