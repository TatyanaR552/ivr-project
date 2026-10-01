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

  function loadRooms() {
    api.myRooms().then(setRooms).catch((requestError) => setError(requestError.message))
    api.publicRooms().then(setPublicRooms).catch((requestError) => setError(requestError.message))
  }

  useEffect(loadRooms, [])

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
        <p>Создайте учебную комнату или присоединитесь к существующей.</p>
      </header>
      {error && <p className="error">{error}</p>}

      <section className="two-columns">
        <form className="card form-card" onSubmit={createRoom} noValidate>
          <h2>Создать комнату</h2>
          <p className="muted">Введите название. Код приглашения появится после создания комнаты.</p>
          <label>Название<input value={name} onChange={(event) => { setName(event.target.value); setCreateError("") }} maxLength={80} aria-invalid={Boolean(createError)} aria-describedby={createError ? "create-room-error" : undefined} /></label>
          {createError && <p id="create-room-error" className="field-error">{createError}</p>}
          <label className="checkbox"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Публичная комната</label>
          <p className="field-help">Публичную комнату увидят другие пользователи. Закрытую можно найти только по коду.</p>
          <button type="submit">Создать</button>
        </form>

        <form className="card form-card" onSubmit={joinByCode}>
          <h2>Войти по коду</h2>
          <p className="muted">Введите код, который вам прислал создатель комнаты.</p>
          <label>Код приглашения<input value={inviteCode} onChange={(event) => { setInviteCode(event.target.value); setJoinError("") }} maxLength={8} aria-invalid={Boolean(joinError)} aria-describedby="invite-code-help" /></label>
          <p id="invite-code-help" className={joinError ? "field-error" : "field-help"}>{joinError || "Код состоит из 8 символов."}</p>
          <button type="submit">Присоединиться</button>
        </form>
      </section>

      <section>
        <div className="section-heading"><h2>Мои комнаты</h2><span>{rooms.length}</span></div>
        <div className="room-grid">
          {rooms.map((room) => <button className="card room-card" key={room.id} onClick={() => navigate(`/rooms/${room.id}`)}><span className="room-type">{room.is_public ? "Публичная" : "Закрытая"}</span><strong>{room.name}</strong><span>Код: {room.invite_code}</span><span className="room-link">Открыть комнату</span></button>)}
          {rooms.length === 0 && <div className="card empty-state"><strong>У вас пока нет комнат</strong><p>Создайте свою комнату или присоединитесь по коду.</p></div>}
        </div>
      </section>

      {publicRooms.length > 0 && <section><h2>Публичные комнаты</h2><p className="muted">Выберите комнату, чтобы присоединиться.</p><div className="room-grid">{publicRooms.map((room) => <div className="card room-card" key={room.id}><span className="room-type">Публичная</span><strong>{room.name}</strong><button onClick={() => joinPublicRoom(room)}>Присоединиться</button></div>)}</div></section>}
    </main>
  )
}

