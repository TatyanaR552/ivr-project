import { useEffect, useRef, useState } from "react"

import { useAutoResize } from "../useAutoResize.js"
import { submitWithCtrlEnter } from "../formShortcuts.js"

export default function Chat({ messages, connected, historyLoaded, sendChat, userId }) {
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const followMessages = useRef(true)
  const clientId = useRef(null)

  useAutoResize(inputRef, text)

  useEffect(() => {
    if (followMessages.current && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages])

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending) return
    if (!connected || !historyLoaded) {
      setError("Дождитесь подключения и загрузки сообщений.")
      return
    }
    const cleanText = text.trim()
    if (!cleanText || cleanText.length > 2000) {
      setError("Введите сообщение от 1 до 2000 символов.")
      return
    }
    if (!clientId.current) clientId.current = crypto.randomUUID()
    setError("")
    setPending(true)
    followMessages.current = true
    try {
      await sendChat(cleanText, clientId.current)
      setText("")
      clientId.current = null
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="card chat-card">
      <h2>Чат комнаты</h2>
      <div className="chat-messages" ref={listRef} tabIndex={0} aria-label="Сообщения комнаты" onScroll={() => {
        const list = listRef.current
        followMessages.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60
      }}>
        {!historyLoaded && <p className="muted">Загружаем сообщения...</p>}
        {historyLoaded && messages.length === 0 && <p className="muted">Пока нет сообщений.</p>}
        {messages.map((message) => (
          <article key={message.id} className={`chat-message${message.author_id === userId ? " chat-message-own" : ""}`}>
            <div className="chat-message-heading">
              <strong>{message.author_username}</strong>
              <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      {messages.length >= 100 && <p className="muted">Показаны последние 100 сообщений.</p>}
      <form className="chat-form" onSubmit={handleSubmit} onKeyDown={submitWithCtrlEnter} noValidate>
        <label htmlFor="chat-text">Сообщение</label>
        <textarea id="chat-text" ref={inputRef} value={text} maxLength={2000} rows={2} disabled={pending} onChange={(event) => {
          setText(event.target.value)
          setError("")
          clientId.current = null
        }} />
        {error && <p className="error" role="alert">{error}</p>}
        <button type="submit" disabled={!connected || !historyLoaded || pending}>Отправить</button>
      </form>
    </section>
  )
}
