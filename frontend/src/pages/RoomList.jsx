import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, clearToken } from "../api.js"
import ThemeToggle from "../ThemeToggle.jsx"

const roomNotFoundMessage = "Не удалось найти комнату. Проверьте код и попробуйте ещё раз."

export default function RoomList() {
  const [rooms, setRooms] = useState([])
  const [publicRooms, setPublicRooms] = useState([])
  const [name, setName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const [createError, setCreateError] = useState("")
  const [joinError, setJoinError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    let disposed = false
    let loading = false

    async function loadRooms() {
      if (loading || document.hidden) return
      loading = true
      try {
        const [myRooms, availableRooms] = await Promise.all([api.myRooms(), api.publicRooms()])
        if (disposed) return
        setRooms(myRooms)
        setPublicRooms(availableRooms)
        setError("")
      } catch (requestError) {
        if (!disposed) setError(requestError.message)
      } finally {
        loading = false
      }
    }

    // Список обновляем отдельно от соединения внутри конкретной комнаты.
    loadRooms()
    const interval = setInterval(loadRooms, 3000)
    window.addEventListener("focus", loadRooms)
    document.addEventListener("visibilitychange", loadRooms)
    return () => {
      disposed = true
      clearInterval(interval)
      window.removeEventListener("focus", loadRooms)
      document.removeEventListener("visibilitychange", loadRooms)
    }
  }, [])

  async function createRoom(event) {
    event.preventDefault()
    setCreateError("")
    const roomName = name.trim()
    if (!roomName) {
      setCreateError("Введите название комнаты.")
      return
    }
    try {
      const room = await api.createRoom(roomName, isPublic)
      navigate(`/rooms/${room.id}`)
    } catch (requestError) {
      setCreateError(requestError.message)
    }
  }

  async function joinByCode(event) {
    event.preventDefault()
    setJoinError("")
    const code = inviteCode.trim()
    if (!/^[a-f0-9]{8}$/i.test(code)) {
      setJoinError(roomNotFoundMessage)
      return
    }
    try {
      const room = await api.joinRoom(code.toLowerCase())
      navigate(`/rooms/${room.id}`)
    } catch (requestError) {
      setJoinError(requestError.message === "Комната с таким кодом не найдена" ? roomNotFoundMessage : requestError.message)
    }
  }

  async function joinPublicRoom(room) {
    try {
      const joinedRoom = await api.joinRoom(room.invite_code)
      navigate(`/rooms/${joinedRoom.id}`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  function logout() {
    clearToken()
    navigate("/login")
  }

  return (
    <main className="page">
      <nav>
        <strong className="brand">Co-Study</strong>
        <span className="nav-actions">
          <button className="secondary" onClick={() => navigate("/help")}>Помощь</button>
          <ThemeToggle />
          <button className="secondary" onClick={() => navigate("/profile")}>Профиль</button>
          <button className="secondary" onClick={logout}>Выйти</button>
        </span>
      </nav>

      <header className="hero">
        <h1>Учебные комнаты</h1>
        <p>Создайте учебную комнату или присоединитесь к существующей</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="two-columns">
        <form className="card form-card" onSubmit={createRoom} noValidate>
          <h2>Создать комнату</h2>
          <label>Название<input value={name} onChange={(event) => { setName(event.target.value); setCreateError("") }} maxLength={80} aria-invalid={Boolean(createError)} aria-describedby={createError ? "create-room-error" : undefined} /></label>
          <label className="checkbox"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Публичная комната</label>
          <p className="field-help">Публичную комнату увидят другие пользователи. Закрытую можно найти только по коду.</p>
          <p id="create-room-error" className="error form-error-slot" aria-live="polite">{createError}</p>
          <button type="submit">Создать</button>
        </form>

        <form className="card form-card" onSubmit={joinByCode}>
          <h2>Войти по коду</h2>
          <label>Код приглашения<input value={inviteCode} onChange={(event) => { setInviteCode(event.target.value); setJoinError("") }} maxLength={8} aria-invalid={Boolean(joinError)} aria-describedby="invite-code-help" /></label>
          <p id="invite-code-help" className="field-help">Код состоит из 8 символов</p>
          <p className="error form-error-slot" aria-live="polite">{joinError}</p>
          <button type="submit">Присоединиться</button>
        </form>
      </section>

      <section>
        <div className="section-heading"><h2>Мои комнаты</h2><span>{rooms.length}</span></div>
        <div className="room-grid">
          {rooms.map((room) => <button className="card room-card" key={room.id} onClick={() => navigate(`/rooms/${room.id}`)}><span className="room-type">{room.is_public ? "Публичная" : "Закрытая"}</span><strong>{room.name}</strong><span>Код: {room.invite_code}</span><span className="room-link">Открыть комнату</span></button>)}
          {rooms.length === 0 && <div className="card empty-state"><strong>У вас пока нет комнат</strong><p>Создайте свою комнату или присоединитесь по коду</p></div>}
        </div>
      </section>

      {publicRooms.length > 0 && <section><h2>Публичные комнаты</h2><div className="room-grid">{publicRooms.map((room) => <div className="card room-card" key={room.id}><span className="room-type">Публичная</span><strong>{room.name}</strong><button onClick={() => joinPublicRoom(room)}>Присоединиться</button></div>)}</div></section>}
    </main>
  )
}

