# React Native (TypeScript) client snippet for JKstore

Use this snippet in your mobile app to call the Next.js serverless API at /api/chat. Do NOT store your OpenAI API key in the mobile app — keep it on the server.

Example (TypeScript):

export async function sendChatToServer(text: string) {
  const base =
    __DEV__ && process.env.NEXT_PUBLIC_LOCAL_HOST
      ? process.env.NEXT_PUBLIC_LOCAL_HOST // set e.g. http://192.168.1.100:3000 in env
      : 'https://your-deployment.vercel.app'
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: text }] }),
  })
  const json = await res.json()
  return json?.choices?.[0]?.message?.content ?? json?.reply ?? null
}

Notes:
- For local device testing: set NEXT_PUBLIC_LOCAL_HOST to http://<YOUR_MACHINE_IP>:3000 so the device can reach your dev server.
- Android emulator: use 10.0.2.2 instead of localhost.
- iOS simulator: you can use http://localhost:3000.
- Production: point base to your deployed URL (Vercel/etc.).
