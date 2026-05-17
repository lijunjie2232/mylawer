/**
 * Cloudflare Worker for LINE Bot Webhook
 *
 * This worker handles incoming webhook requests from the LINE Platform.
 * It performs the following tasks:
 * 1. Verifies the signature of incoming requests to ensure they are from LINE.
 * 2. Parses the webhook event object.
 * 3. Responds to text messages by echoing them back to the user.
 *
 * To use this worker, you need to set the following environment variables in your Cloudflare Worker settings:
 * - LINE_CHANNEL_SECRET: Your LINE channel secret.
 * - LINE_CHANNEL_ACCESS_TOKEN: Your LINE channel access token.
 */
export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    // Get the signature from headers
    const signature = request.headers.get("x-line-signature");
    if (!signature) {
      return new Response("Missing Signature", { status: 401 });
    }

    // Read body as text for signature verification
    const body = await request.text();

    // 1. Verify the signature using Web Crypto API
    const isValid = await verifySignature(
      body,
      env.LINE_CHANNEL_SECRET,
      signature
    );

    if (!isValid) {
      return new Response("Invalid Signature", { status: 401 });
    }

    const data = JSON.parse(body);

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

/**
 * Verifies the signature of the request against the channel secret.
 * @param {string} body - The request body.
 * @param {string} secret - The LINE channel secret.
 * @param {string} signature - The signature from the x-line-signature header.
 * @returns {Promise<boolean>} - True if the signature is valid, false otherwise.
 */
async function verifySignature(body, secret, signature) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const mac = await crypto.subtle.sign("HMAC", key, bodyData);

  // Convert ArrayBuffer to Base64
  const base64Mac = btoa(String.fromCharCode(...new Uint8Array(mac)));

  return base64Mac === signature;
}

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
