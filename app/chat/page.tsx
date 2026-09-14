'use client'

import { useState } from 'react'

export default function ChatDemo() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [loading, setLoading] = useState(false)

  async function send() {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      })
      const json = await res.json()
      const assistantText = json?.choices?.[0]?.message?.content ?? json?.reply ?? '[no response]'
      setMessages((m) => [...m, { role: 'assistant', content: assistantText }])
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${(e as Error).message}` }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 20, maxWidth: 700 }}>
      <h1>Chat Demo (mockable)</h1>
      <div style={{ border: '1px solid #ddd', padding: 12, minHeight: 200 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ margin: '8px 0' }}>
            <strong>{m.role}:</strong> <span>{m.content}</span>
          </div>
        ))}
        {loading && <div>Loading...</div>}
      </div>
      <div style={{ marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ width: '70%' }} />
        <button onClick={send} style={{ marginLeft: 8 }}>
          Send
        </button>
      </div>
    </main>
  )
}
