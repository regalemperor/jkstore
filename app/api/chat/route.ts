import { NextResponse } from 'next/server'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const messages: ChatMessage[] = body.messages ?? (body.message ? [{ role: 'user', content: String(body.message) }] : [])
    const MOCK = process.env.MOCK_MODE === 'true'

    if (MOCK) {
      const userText = messages.length ? messages[messages.length - 1].content.slice(0, 500) : ''
      const reply = `Mock reply: Received "${userText}"`
      const responsePayload = {
        id: 'mock',
        object: 'chat.completion',
        choices: [{ index: 0, message: { role: 'assistant', content: reply } }],
        reply,
      }
      return NextResponse.json(responsePayload)
    }

    const key = process.env.OPENAI_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
        messages,
        max_tokens: 512,
      }),
    })

    const data = await openaiResp.json()
    return NextResponse.json(data)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'unknown error' }, { status: 500 })
  }
}
