import React, { useState, useRef, useEffect } from 'react'
import './App.css'

const API_URL = 'http://localhost:1234/v1/chat/completions'

function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-40 z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
          onClick={onClose}
          aria-label="Cerrar"
        >
          ×
        </button>
        <h2 className="text-xl font-bold mb-2">Acerca de Simple AI Chat</h2>
        <p className="mb-2 text-gray-700">
          Chat simple en React + Vite + TypeScript + Tailwind que permite conversar con una IA local usando la API de LM Studio.
        </p>
        <ul className="mb-2 text-gray-600 text-sm list-disc pl-5">
          <li>Muestra el modelo cargado desde LM Studio.</li>
          <li>Animación "Thinking..." mientras responde.</li>
        </ul>
        <p className="text-xs text-gray-400">Desarrollado por Javert Galicia · {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}

function App() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant' | 'system'; content: string }[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [modelName, setModelName] = useState<string>('')
  const [thinkingDots, setThinkingDots] = useState(1)
  const [aboutOpen, setAboutOpen] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Obtener el nombre del modelo desde la API
  async function fetchModelName() {
    try {
      const res = await fetch('http://localhost:1234/v1/models')
      if (!res.ok) throw new Error('No response')
      const data = await res.json()
      // Para debug: muestra el JSON recibido en consola
      console.log('Respuesta /v1/models:', data)
      if (data && (Array.isArray(data.models) || Array.isArray(data.data))) {
        // LM Studio puede devolver 'models' o 'data' según versión
        const modelsArr = data.models || data.data
        if (modelsArr.length > 0) {
          setModelName(modelsArr[0].id || modelsArr[0].model || 'Unknown Model')
        } else {
          setModelName('Unknown Model')
        }
      } else {
        setModelName('Unknown Model')
      }
    } catch (e) {
      setModelName('No disponible')
      // Para debug: muestra el error en consola
      console.error('Error obteniendo modelo:', e)
    }
  }

  // Llama a la API para obtener la respuesta del modelo
  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)
    controllerRef.current = new AbortController()
    try {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: input }
      ])
      setInput('')
      // Muestra el recuadro animado "Thinking..." antes de la respuesta
      setMessages(prev => [
        ...prev,
        { role: 'system', content: '__thinking__' }
      ])
      setThinkingDots(1)
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
      thinkingIntervalRef.current = setInterval(() => {
        setThinkingDots(dots => (dots % 3) + 1)
      }, 500)
      // Construye el historial para la API
      const chatHistory = [
        ...messages,
        { role: 'user', content: input }
      ].map(m => ({ role: m.role, content: m.content }))
      // Asegura que siempre se envía el campo 'messages' aunque esté vacío
      const body = {
        model: modelName || undefined,
        messages: chatHistory.length > 0 ? chatHistory : [{ role: 'user', content: input }],
        stream: true
      }
      // Llama a la API (modo streaming)
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controllerRef.current.signal
      })
      if (!response.body) throw new Error('No stream')
      const reader = response.body.getReader()
      let aiMsg = ''
      let done = false
      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading
        if (value) {
          const chunk = new TextDecoder().decode(value)
          chunk.split('\n').forEach(line => {
            if (line.startsWith('data: ')) {
              const data = line.replace('data: ', '').trim()
              if (data && data !== '[DONE]') {
                try {
                  const delta = JSON.parse(data)
                  let content = delta.choices?.[0]?.delta?.content || delta.choices?.[0]?.message?.content || ''
                  // Elimina cualquier tag <think>...</think> del contenido
                  content = content.replace(/<think>(.|\n|\r)*?<\/think>/gi, '')
                  // NO modificar espacios, deja el texto tal como lo envía la API
                  aiMsg += content
                } catch {}
              }
            }
          })
        }
      }
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
      // Al terminar, muestra solo la respuesta completa
      setMessages(prev => [
        ...prev.filter(m => m.content !== '__thinking__'),
        { role: 'assistant', content: aiMsg }
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Error: ' + (err as Error).message },
      ])
    } finally {
      setLoading(false)
    }
  }

  // Obtener el modelo al montar
  useEffect(() => {
    fetchModelName()
  }, [])

  return (
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-xl flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">Simple AI Chat</h1>
        <button
          className="text-blue-500 hover:underline text-sm"
          onClick={() => setAboutOpen(true)}
        >
          About
        </button>
      </div>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div className="mb-4 text-gray-600 text-sm">Modelo: {modelName || 'Cargando...'}</div>
      <div className="w-full max-w-xl bg-white rounded shadow p-4 mb-4 h-96 overflow-y-auto flex flex-col">
        {messages.map((msg, i) => (
          msg.content === '__thinking__' ? (
            <div key={i} className="flex justify-center my-2">
              <div className="animate-pulse bg-blue-100 text-blue-600 px-4 py-2 rounded shadow font-semibold border border-blue-300">
                Thinking{'.'.repeat(thinkingDots)}
              </div>
            </div>
          ) : (
            <div key={i} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
              <span className={msg.role === 'user' ? 'font-semibold text-blue-600' : msg.role === 'assistant' ? 'font-semibold text-green-600' : 'font-semibold text-gray-500'}>
                {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : 'System'}:
              </span>
              <span className="ml-2 whitespace-pre-wrap">{msg.content}</span>
            </div>
          )
        ))}
        {loading && (
          <div className="text-green-600">AI is typing...</div>
        )}
      </div>
      <form onSubmit={sendMessage} className="w-full max-w-xl flex gap-2">
        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default App
