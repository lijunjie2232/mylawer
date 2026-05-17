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
          env.LINE_CHANNEL_ACCESS_TOKEN
        );
      }
    }

    return new Response("OK", { status: 200 });
  },
};

/**
 * Modern Web Crypto implementation for HMAC-SHA256
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
 * Standard fetch-based reply
 */
async function replyMessage(replyToken, text, accessToken) {
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: `Echo: ${text}` }],
    }),
  });
  return response;
}