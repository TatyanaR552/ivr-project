import { useCallback, useEffect, useRef, useState } from "react"

import { api, getRoomSocketUrl, getToken } from "./api.js"

export function useRoomSocket(roomId, enabled) {
  const [status, setStatus] = useState("connecting")
  const [timer, setTimer] = useState(null)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)
  const socketRef = useRef(null)
  const commandTimeout = useRef(null)
  const [messages, setMessages] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const chatRequest = useRef(null)
  const [taskVersion, setTaskVersion] = useState(0)
  const [membersVersion, setMembersVersion] = useState(0)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [olderPageVersion, setOlderPageVersion] = useState(0)
  const historyGeneration = useRef(0)

  useEffect(() => {
    if (!enabled) return
    setTimer(null)
    setError("")
    setMessages([])
    setHasOlderMessages(false)
    setHistoryLoaded(false)
    let disposed = false
    let retry
    let heartbeat
    let socket
    let lastReply

    function connect() {
      historyGeneration.current += 1
      setStatus("connecting")
      setHistoryLoaded(false)
      socket = new WebSocket(getRoomSocketUrl(roomId))
      socketRef.current = socket
      socket.onopen = () => {
        if (disposed) return
        socket.send(JSON.stringify({ type: "auth", token: getToken() }))
      }
      socket.onmessage = (event) => {
        if (disposed) return
        let message
        try {
          message = JSON.parse(event.data)
        } catch {
          socket.close()
          return
        }
        lastReply = Date.now()
        if (message.type === "ready") {
          setStatus("connected")
          setTaskVersion((version) => version + 1)
          setMembersVersion((version) => version + 1)
          socket.send(JSON.stringify({ type: "chat_history" }))
          heartbeat = setInterval(() => {
            if (Date.now() - lastReply > 60000) {
              socket.close()
              return
            }
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping" }))
            }
          }, 25000)
        } else if (message.type === "members_changed") {
          setMembersVersion((version) => version + 1)
        } else if (message.type === "task_changed") {
          setTaskVersion((version) => version + 1)
        } else if (message.type === "chat_history") {
          setMessages(message.messages)
          setHasOlderMessages(message.has_more)
          setHistoryLoaded(true)
        } else if (message.type === "chat_message") {
          setMessages((previous) => previous.some((item) => item.id === message.id)
            ? previous : [...previous, message])
        } else if (message.type === "chat_ack") {
          const request = chatRequest.current
          if (request && request.clientId === message.client_id) {
            clearTimeout(request.timeout)
            chatRequest.current = null
            request.resolve()
          }
        } else if (message.type === "timer_state") {
          setTimer({ ...message, receivedAt: performance.now() })
          setPending(false)
          clearTimeout(commandTimeout.current)
        } else if (message.type === "error") {
          if (message.code === "invalid_chat_message") {
            const request = chatRequest.current
            if (request) {
              clearTimeout(request.timeout)
              chatRequest.current = null
              request.reject(new Error("Не удалось отправить сообщение. Проверьте текст"))
            }
            return
          }
          const errors = {
            timer_already_started: "Таймер уже запущен. Обновлено его текущее состояние.",
            timer_not_running: "Таймер уже остановлен. Обновлено его текущее состояние.",
            timer_not_paused: "Таймер уже не на паузе. Обновлено его текущее состояние.",
          }
          setError(errors[message.code] || "Не удалось изменить таймер. Попробуйте ещё раз.")
          setPending(false)
          clearTimeout(commandTimeout.current)
        }
      }
      socket.onclose = (event) => {
        clearInterval(heartbeat)
        if (disposed) return
        historyGeneration.current += 1
        if (chatRequest.current) {
          clearTimeout(chatRequest.current.timeout)
          chatRequest.current.reject(new Error(event.code === 4404
            ? "Комната не найдена"
            : "Связь прервалась. Проверьте историю перед повторной отправкой."))
          chatRequest.current = null
        }
        setPending(false)
        clearTimeout(commandTimeout.current)
        if (event.code === 4401) {
          setStatus("unauthorized")
        } else if (event.code === 4404) {
          setStatus("deleted")
        } else if (event.code === 4403) {
          setStatus("forbidden")
        } else {
          setStatus("disconnected")
          retry = setTimeout(connect, 3000)
        }
      }
    }

    connect()
    return () => {
      disposed = true
      historyGeneration.current += 1
      clearTimeout(retry)
      clearInterval(heartbeat)
      clearTimeout(commandTimeout.current)
      socketRef.current = null
      if (chatRequest.current) {
        clearTimeout(chatRequest.current.timeout)
        chatRequest.current.reject(new Error("Соединение закрыто."))
        chatRequest.current = null
      }
      socket.close()
    }
  }, [roomId, enabled])

  const send = useCallback((message) => {
    const socket = socketRef.current
    if (socket?.readyState !== WebSocket.OPEN) {
      setError("Нет соединения с комнатой. Дождитесь подключения.")
      return
    }
    setError("")
    setPending(true)
    socket.send(JSON.stringify(message))
    clearTimeout(commandTimeout.current)
    commandTimeout.current = setTimeout(() => {
      setPending(false)
      setError("Сервер не подтвердил действие. Подключаемся снова...")
      socket.close()
    }, 10000)
  }, [])

  const sendChat = useCallback((text, clientId) => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current
      if (socket?.readyState !== WebSocket.OPEN) {
        reject(new Error("Нет соединения с комнатой. Дождитесь подключения."))
        return
      }
      if (chatRequest.current) {
        reject(new Error("Дождитесь отправки предыдущего сообщения."))
        return
      }
      const request = { clientId, resolve, reject }
      chatRequest.current = request
      request.timeout = setTimeout(() => {
        chatRequest.current = null
        reject(new Error("Нет подтверждения отправки. Проверьте историю перед повторной отправкой."))
        socket.close()
      }, 10000)
      socket.send(JSON.stringify({ type: "chat_message", text, client_id: clientId }))
    })
  }, [])

  const loadOlderMessages = useCallback(async (before) => {
    const generation = historyGeneration.current
    const page = await api.olderMessages(roomId, before)
    if (generation !== historyGeneration.current) return false
    setMessages((previous) => {
      const existing = new Set(previous.map((message) => message.id))
      return [...page.messages.filter((message) => !existing.has(message.id)), ...previous]
    })
    setHasOlderMessages(page.has_more)
    setOlderPageVersion((version) => version + 1)
    return true
  }, [roomId])

  return { status, timer, error, pending, send, messages, historyLoaded, sendChat, taskVersion, membersVersion, hasOlderMessages, olderPageVersion, loadOlderMessages }
}
