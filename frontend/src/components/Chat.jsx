import { useLayoutEffect, useRef, useState } from "react"

import { useAutoResize } from "../useAutoResize.js"
import { submitWithCtrlEnter } from "../formShortcuts.js"

export default function Chat({ messages, connected, historyLoaded, sendChat, userId, hasOlderMessages, olderPageVersion, loadOlderMessages }) {
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const followMessages = useRef(true)
  const clientId = useRef(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const olderRequest = useRef(false)
  const [historyError, setHistoryError] = useState("")
  const scrollAnchor = useRef(null)

  useAutoResize(inputRef, text)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const anchor = scrollAnchor.current
    if (anchor && olderPageVersion > anchor.version) {
      if (anchor.element?.isConnected) {
        const offset = anchor.element.getBoundingClientRect().top - list.getBoundingClientRect().top
        list.scrollTop += offset - anchor.offset
      } else {
        list.scrollTop = anchor.top + list.scrollHeight - anchor.height
      }
      scrollAnchor.current = null
    } else if (!anchor && followMessages.current) {
      list.scrollTop = list.scrollHeight
    }
  }, [messages, olderPageVersion])

  async function loadPrevious() {
    if (olderRequest.current || !connected || !historyLoaded || !hasOlderMessages || !messages.length) return
    olderRequest.current = true
    const list = listRef.current
    const listTop = list.getBoundingClientRect().top
    const element = [...list.querySelectorAll("[data-message-id]")].find((item) => item.getBoundingClientRect().bottom > listTop)
    scrollAnchor.current = {
      version: olderPageVersion, element,
      offset: element ? element.getBoundingClientRect().top - listTop : 0,
      top: list.scrollTop, height: list.scrollHeight,
    }
    followMessages.current = false
    setLoadingOlder(true)
    setHistoryError("")
    try {
      const applied = await loadOlderMessages(messages[0].id)
      if (!applied) scrollAnchor.current = null
    } catch (requestError) {
      scrollAnchor.current = null
      setHistoryError(requestError.message)
    } finally {
      olderRequest.current = false
      setLoadingOlder(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (pending) return
    if (!connected || !historyLoaded) {
      setError("Дождитесь подключения и загрузки сообщений.")
      return
    }
    const cleanText = text.trim()
    if (!cleanText) {
      setError("Введите сообщение")
      return
    }
    if (cleanText.length > 2000) {
      setError("Сообщение слишком длинное: максимум 2000 символов")
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
      <div className="chat-messages" ref={listRef} tabIndex={0} aria-label="Сообщения комнаты" aria-busy={loadingOlder} onScroll={() => {
        const list = listRef.current
        followMessages.current = list.scrollHeight - list.scrollTop - list.clientHeight < 60
        if (list.scrollTop < 48 && !historyError) loadPrevious()
      }}>
        {!historyLoaded && <p className="muted">Загружаем сообщения...</p>}
        {historyError && <div><p className="error" role="alert">Не удалось загрузить предыдущие сообщения. {historyError}</p><button type="button" className="secondary chat-history-button" disabled={loadingOlder || !connected || !historyLoaded} onClick={loadPrevious}>Повторить</button></div>}
        {historyLoaded && messages.length === 0 && <p className="muted">Сообщений пока нет</p>}
        {messages.map((message) => (
          <article key={message.id} data-message-id={message.id} className={`chat-message${message.author_id === userId ? " chat-message-own" : ""}`}>
            <div className="chat-message-heading">
              <strong>{message.author_username}</strong>
              <time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>
      <form className="chat-form" onSubmit={handleSubmit} onKeyDown={submitWithCtrlEnter} noValidate>
        <label htmlFor="chat-text">Сообщение</label>
        <textarea id="chat-text" ref={inputRef} value={text} maxLength={2000} rows={2} disabled={pending} onChange={(event) => {
          setText(event.target.value)
          setError("")
          clientId.current = null
        }} />
        <p className="error form-error-slot" aria-live="polite">{error}</p>
        <button type="submit" disabled={!connected || !historyLoaded || pending}>Отправить</button>
      </form>
    </section>
  )
}
