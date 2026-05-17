# How to Connect Your Project API to the LINE Bot

This guide explains how to connect your project's API to the LINE bot. The goal is to have the LINE bot receive a message, send it to your API, and then reply to the user with the API's response.

## 1. Expose Your Local API to the Internet

Your project's API is running on your local machine, so you need to expose it to the internet so that the Cloudflare worker can access it. A simple way to do this is to use a tunneling service like `cloudflared`.

If you have `cloudflared` installed, you can expose your local API (e.g., running on `http://localhost:3000`) with the following command:

```bash
cloudflared tunnel --url http://localhost:3000
```

This will give you a public URL (e.g., `https://random-name.trycloudflare.com`) that you can use to access your local API from the internet.

## 2. Modify the Worker to Call Your API

Now, you need to modify the Cloudflare worker to call your project's API. Here's how you can do it:

First, open `linebot/worker.js`. Then, modify the `replyMessage` function to call your API and use the response as the reply.

```javascript
/**
 * Sends a reply message to the user by calling your project's API.
 * @param {string} replyToken - The reply token from the webhook event.
 * @param {string} text - The text to reply with.
 * @param {string} accessToken - The LINE channel access token.
 * @param {string} apiUrl - The URL of your project's API.
 * @returns {Promise<Response>} - The response from the LINE API.
 */
async function replyMessage(replyToken, text, accessToken, apiUrl) {
  // Call your project's API
  const apiResponse = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: text,
    }),
  });
  const apiData = await apiResponse.json();
  const replyText = apiData.reply || "Sorry, I could not understand.";

  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: replyText }],
    }),
  });
  return response;
}
```

And in the `fetch` function, make sure to pass the `apiUrl` to `replyMessage`:

```javascript
export default {
  async fetch(request, env) {
    // ... (the rest of the code is the same)

    // 2. Process events
    for (const event of data.events) {
      if (event.type === "message" && event.message.text) {
        await replyMessage(
          event.replyToken,
          event.message.text,
          env.LINE_CHANNEL_ACCESS_TOKEN,
          env.API_URL // Pass the API_URL from environment variables
        );
      }
    }

    return new Response("OK", { status: 200 });
  },
};
```

## 3. Deploy the Worker and Set Environment Variables

Now, you need to deploy the worker and set the `API_URL` environment variable in your Cloudflare worker's settings.

1.  **Deploy the worker**: Use the `wrangler` CLI or the Cloudflare dashboard to deploy your worker.
2.  **Set the `API_URL` environment variable**: In your Cloudflare worker's settings, add a new environment variable named `API_URL` and set its value to the public URL of your project's API (e.g., `https://random-name.trycloudflare.com`).
3.  **Set the webhook URL**: In the LINE Developer Console, set the webhook URL to your Cloudflare worker's URL.

Now, when you send a message to your LINE bot, it will be sent to your project's API, and the response will be sent back to you as a reply.
