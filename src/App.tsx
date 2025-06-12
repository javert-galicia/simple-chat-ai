import React, { useState, useRef, useEffect } from 'react'
import './App.css'

const API_URL = 'http://localhost:3001/api/v1/openai/chat/completions'

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
  const [llmModelName, setLlmModelName] = useState<string>('');
  const [thinkingDots, setThinkingDots] = useState(1)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [token, setToken] = useState<string>(() => localStorage.getItem('llm_token') || '')
  const [tokenInput, setTokenInput] = useState(token);
  const [editToken, setEditToken] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('dark_mode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const controllerRef = useRef<AbortController | null>(null)
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Pedir el token si no existe
  useEffect(() => {
    if (!token) {
      const userToken = window.prompt('Ingresa tu token de AnythingLLM:') || ''
      setToken(userToken)
      localStorage.setItem('llm_token', userToken)
    }
  }, [])

  // Obtener el nombre del modelo desde la API
  async function fetchModelName() {
    try {
      const res = await fetch('http://localhost:3001/api/v1/openai/models', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!res.ok) throw new Error('No response')
      const data = await res.json()
      // Para debug: muestra el JSON recibido en consola
      console.log('Respuesta /v1/models:', data)
      // Soporta ambos formatos: { models: [...] } o { data: [...] }
      const arr = Array.isArray(data.models) ? data.models : Array.isArray(data.data) ? data.data : [];
      // Usar el campo 'model' del primer objeto para enviar a la API
      if (arr.length > 0 && arr[0].model) {
        setModelName(arr[0].model);
        setLlmModelName(arr[0].llm && arr[0].llm.model ? arr[0].llm.model : '');
      } else {
        setModelName('Unknown Model');
        setLlmModelName('');
      }
    } catch (e) {
      setModelName('No disponible')
      // Para debug: muestra el error en consola
      console.error('Error obteniendo modelo:', e)
    }
  }

  // Ejemplo de tool_call: getCurrentTime
  const tools = [
    {
      type: "function",
      function: {
        name: "getCurrentTime",
        description: "Devuelve la hora actual en formato CDMX",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ];

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
      setMessages(prev => [
        ...prev,
        { role: 'system', content: '__thinking__' }
      ])
      setThinkingDots(1)
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
      thinkingIntervalRef.current = setInterval(() => {
        setThinkingDots(dots => (dots % 3) + 1)
      }, 500)
      const chatHistory = [
        ...messages,
        { role: 'user', content: input }
      ].map(m => ({ role: m.role, content: m.content }))
      const body = {
        model: modelName || undefined,
        messages: chatHistory.length > 0 ? chatHistory : [{ role: 'user', content: input }],
        stream: true,
        tools // <-- aquí se agregan las tools
      }
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: controllerRef.current.signal
      })
      if (!response.body) throw new Error('No stream')
      const reader = response.body.getReader()
      let aiMsg = ''
      let done = false
      let toolCallId: string | null = null
      let toolCallPending = false
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
                  // Tool call detection (OpenAI/LM Studio style)
                  const toolCalls = delta.choices?.[0]?.delta?.tool_calls || delta.choices?.[0]?.tool_calls
                  if (toolCalls && toolCalls.length > 0) {
                    const call = toolCalls[0]
                    if (call.function?.name === 'getCurrentTime') {
                      toolCallId = call.id
                      toolCallPending = true
                    }
                  }
                  let content = delta.choices?.[0]?.delta?.content || delta.choices?.[0]?.message?.content || ''
                  content = content.replace(/<think>(.|\n|\r)*?<\/think>/gi, '')
                  aiMsg += content
                } catch {}
              }
            }
          })
        }
      }
      // Si hubo un tool_call, responde con el resultado de la función
      if (toolCallPending && toolCallId) {
        // Hora en formato México (DD/MM/YYYY HH:mm:ss)
        const now = new Date()
        const mxTime = now.toLocaleString('es-MX', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
          timeZone: 'America/Mexico_City'
        }).replace(',', '')
        setMessages(prev => [
          ...prev.filter(m => m.content !== '__thinking__'),
          { role: 'assistant', content: `Hora actual (CDMX): ${mxTime}` }
        ])
        setLoading(false)
        return
      }
      if (thinkingIntervalRef.current) clearInterval(thinkingIntervalRef.current)
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

  // Persistencia de mensajes en localStorage
  useEffect(() => {
    const saved = localStorage.getItem('chat_messages');
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {}
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (!token) {
      setEditToken(true);
    }
  }, [token]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('dark_mode', String(darkMode));
  }, [darkMode]);

  return (
    <div className={
      `flex flex-col items-center min-h-screen p-4 transition-colors duration-300 ` +
      (darkMode ? 'bg-gray-900' : 'bg-gray-100')
    }>
      <div className="w-full max-w-xl flex justify-between items-center mb-2">
        <h1 className={
          'text-2xl font-bold ' + (darkMode ? 'text-white' : '')
        }>Simple AI Chat</h1>
        <div className="flex items-center gap-2">
          <button
            className="text-blue-500 hover:underline text-sm"
            onClick={() => setAboutOpen(true)}
          >
            About
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-gray-400 bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600 ml-2"
            onClick={() => setDarkMode(d => !d)}
            title="Alternar modo oscuro"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <div className="mb-2 text-gray-700 text-xs flex items-center gap-2">
        Token:
        {editToken ? (
          <>
            <input
              className="font-mono bg-gray-200 px-2 py-1 rounded break-all text-xs border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              style={{ minWidth: 180 }}
            />
            <button
              className="ml-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 border border-green-300"
              onClick={() => {
                setToken(tokenInput);
                localStorage.setItem('llm_token', tokenInput);
                setEditToken(false);
                setTimeout(() => window.location.reload(), 100);
              }}
              disabled={!tokenInput.trim()}
            >
              Save
            </button>
            <button
              className="ml-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 border border-gray-300"
              onClick={() => {
                setTokenInput(token);
                setEditToken(false);
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <span className="font-mono bg-gray-200 px-2 py-1 rounded break-all">{token || 'No token'}</span>
            <button
              className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 border border-blue-300"
              onClick={() => setEditToken(true)}
            >
              Change token
            </button>
          </>
        )}
      </div>
      <div className="mb-4 text-gray-600 text-sm">
        Workspace: <span className="font-mono">{modelName || 'Cargando...'}</span><br />
        Model: <span className="font-mono">{llmModelName || 'Cargando...'}</span>
      </div>
      <div className={
        `w-full max-w-xl rounded shadow p-4 mb-4 flex flex-col gap-2 resize-y overflow-auto ` +
        (darkMode ? 'bg-gray-800' : 'bg-white')
      }
        style={{ minHeight: '12rem', maxHeight: '32rem' }}
      >
        {messages.map((msg, i) => (
          msg.content === '__thinking__' ? (
            <div key={i} className="flex justify-center my-2">
              <div className={
                'animate-pulse px-4 py-2 rounded-full shadow font-semibold border ' +
                (darkMode
                  ? 'bg-blue-900 text-blue-200 border-blue-700'
                  : 'bg-blue-100 text-blue-600 border-blue-300')
              }>
                Thinking{'.'.repeat(thinkingDots)}
              </div>
            </div>
          ) : (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={
                  'max-w-[75%] px-4 py-2 rounded-2xl shadow ' +
                  (msg.role === 'user'
                    ? (darkMode ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-blue-500 text-white rounded-br-sm')
                    : msg.role === 'assistant'
                    ? (darkMode ? 'bg-green-900 text-green-100 rounded-bl-sm' : 'bg-green-100 text-green-900 rounded-bl-sm')
                    : (darkMode ? 'bg-gray-700 text-gray-200' : 'bg-gray-200 text-gray-700'))
                }
              >
                <span className="block text-xs font-semibold mb-1 opacity-70">
                  {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : 'System'}
                </span>
                <span className="whitespace-pre-wrap break-words">{msg.content}</span>
              </div>
            </div>
          )
        ))}
        {loading && (
          <div className={darkMode ? 'text-green-200' : 'text-green-600'}>AI is typing...</div>
        )}
      </div>
      <form onSubmit={sendMessage} className="w-full max-w-xl flex gap-2">
        <input
          className={
            'flex-1 border rounded p-2 ' +
            (darkMode ? 'bg-gray-900 text-white border-gray-600 placeholder-gray-400' : '')
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button
          type="submit"
          className={
            'px-4 py-2 rounded disabled:opacity-50 ' +
            (darkMode ? 'bg-blue-700 text-white' : 'bg-blue-500 text-white')
          }
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default App
