# ChatGPT (OpenAI) integration for JKstore

This branch adds a mock-first Next.js App Router serverless API at /api/chat plus a small web demo and mobile client snippets.

Files added (feature/chatgpt-integration):
- app/api/chat/route.ts — serverless handler, supports MOCK_MODE and forwards to OpenAI when MOCK_MODE=false and OPENAI_API_KEY is set.
- app/chat/page.tsx — simple web demo to test the endpoint in the browser.
- .env.example — shows MOCK_MODE and OPENAI_API_KEY.
- mobile-snippets/ReactNativeClient.md — TypeScript snippet and notes for calling the API from a mobile app.

Quick start (mock mode)
1) Checkout the branch:
   git checkout feature/chatgpt-integration
2) Copy env example:
   cp .env.example .env.local
   (ensure MOCK_MODE=true for local dev)
3) Install & run:
   npm install
   npm run dev
4) Open the web demo at http://localhost:3000/chat

Local mobile testing
- For Android emulator use 10.0.2.2 to reach localhost. For iOS simulator use http://localhost:3000. For a physical device, use your machine's LAN IP (e.g. http://192.168.1.100:3000) and set that as the base URL in your mobile client.

Switching to real OpenAI
1) Get an API key at https://platform.openai.com/
2) Deploy to Vercel (recommended) or your host and set the environment variable OPENAI_API_KEY in the deployment settings. In production set MOCK_MODE=false.
3) Optionally set OPENAI_MODEL to the model you want (gpt-4, gpt-3.5-turbo, etc.).

Security notes
- Never store OPENAI_API_KEY inside the mobile app or commit it to the repo.
- Use server-side environment variables / hosting provider secrets (Vercel environment variables, GitHub Secrets for CI, etc.).
- For production, add authentication and rate-limiting to /api/chat to prevent abuse.

Mobile client snippet and notes are in mobile-snippets/ReactNativeClient.md
