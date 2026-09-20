import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, clearToken } from "../api.js"

export default function RoomList() {
  const [rooms, setRooms] = useState([])
  const [publicRooms, setPublicRooms] = useState([])
  const [name, setName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  function loadRooms() {
    api.myRooms().then(setRooms).catch((requestError) => setError(requestError.message))
    api.publicRooms().then(setPublicRooms).catch((requestError) => setError(requestError.message))
  }

  useEffect(loadRooms, [])

  async function createRoom(event) {
    event.preventDefault()
    try {
      const room = await api.createRoom(name.trim(), isPublic)
      navigate(`/rooms/${room.id}`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function joinByCode(event) {
    event.preventDefault()
    try {
      const room = await api.joinRoom(inviteCode.trim())
      navigate(`/rooms/${room.id}`)
    } catch (requestError) {
      setError(requestError.message)
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
        <strong>Co-Study</strong>
        <span className="nav-actions">
          <button className="secondary" onClick={() => navigate("/profile")}>Профиль</button>
          <button className="secondary" onClick={logout}>Выйти</button>
        </span>
      </nav>

      <h1>Учебные комнаты</h1>
      {error && <p className="error">{error}</p>}

      <section className="two-columns">
        <form className="card form-card" onSubmit={createRoom}>
          <h2>Создать комнату</h2>
          <label>Название<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>
          <label className="checkbox"><input type="checkbox" checked={isPublic} onChange={(event) => setIsPublic(event.target.checked)} />Публичная комната</label>
          <button type="submit">Создать</button>
        </form>

        <form className="card form-card" onSubmit={joinByCode}>
          <h2>Войти по коду</h2>
          <label>Код приглашения<input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} minLength={8} maxLength={8} required /></label>
          <button type="submit">Присоединиться</button>
        </form>
      </section>

      <section>
        <h2>Мои комнаты</h2>
        <div className="room-grid">
          {rooms.map((room) => <button className="card room-card" key={room.id} onClick={() => navigate(`/rooms/${room.id}`)}><strong>{room.name}</strong><span>Код: {room.invite_code}</span></button>)}
          {rooms.length === 0 && <p>У вас пока нет комнат.</p>}
        </div>
      </section>

      {publicRooms.length > 0 && <section><h2>Публичные комнаты</h2><div className="room-grid">{publicRooms.map((room) => <div className="card room-card" key={room.id}><strong>{room.name}</strong><button onClick={() => joinPublicRoom(room)}>Присоединиться</button></div>)}</div></section>}
    </main>
  )
}

