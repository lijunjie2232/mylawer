# How to Connect Your LINE Bot to This Express Backend

This guide explains how to connect your LINE bot to this existing Express backend. The backend is already set up to handle LINE webhooks, so you just need to configure it correctly and expose it to the internet.

## 1. Configure Environment Variables

First, you need to configure the environment variables for your LINE bot. Create a `.env` file in the root of the project by copying the `.env.example` file:

```bash
cp .env.example .env
```

Now, open the `.env` file and fill in the following values:

```
# .env

# LINE Bot settings
LINE_CHANNEL_SECRET="YOUR_LINE_CHANNEL_SECRET"
LINE_ACCESS_TOKEN="YOUR_LINE_CHANNEL_ACCESS_TOKEN"

# ... other environment variables
```

You can get your `LINE_CHANNEL_SECRET` and `LINE_CHANNEL_ACCESS_TOKEN` from the LINE Developer Console.

## 2. Start Your Express Server

Start your Express server with the following command:

```bash
npm run dev
```

This will start the server on the port specified in your `.env` file (default is 3000).

## 3. Expose Your Local Server to the Internet

Your Express server is running on your local machine, so you need to expose it to the internet so that the LINE Platform can send webhook events to it. A simple way to do this is to use a tunneling service like `cloudflared`.

If you have `cloudflared` installed, you can expose your local server with the following command:

```bash
cloudflared tunnel --url http://localhost:3000
```

This will give you a public URL (e.g., `https://random-name.trycloudflare.com`) that you can use to access your local server from the internet.

## 4. Set the Webhook URL in the LINE Developer Console

Now, you need to set the webhook URL in the LINE Developer Console.

1.  Go to the LINE Developer Console and select your channel.
2.  Go to the "Messaging API" tab.
3.  In the "Webhook URL" field, enter the public URL you got from `cloudflared`, followed by `/webhook`. For example:
    `https://random-name.trycloudflare.com/webhook`
4.  Click "Update" to save the changes.
5.  Click the "Verify" button to make sure your webhook is working correctly. You should see a "Success" message.

## 5. Test the Integration

Now that everything is set up, you can test the integration by sending a message to your LINE bot. The bot should reply with a response from your Express backend.

If you encounter any issues, check the logs of your Express server and the `cloudflared` tunnel for any error messages.
