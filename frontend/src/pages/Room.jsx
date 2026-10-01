import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api } from "../api.js"
import ThemeToggle from "../ThemeToggle.jsx"

export default function Room() {
  const { roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.getRoom(roomId), api.profile()])
      .then(([loadedRoom, loadedProfile]) => {
        setRoom(loadedRoom)
        setProfile(loadedProfile)
      })
      .catch((requestError) => setError(requestError.message))
  }, [roomId])

  async function leaveRoom() {
    try {
      await api.leaveRoom(roomId)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function deleteRoom() {
    if (!window.confirm("Удалить комнату для всех участников?")) return
    try {
      await api.deleteRoom(roomId)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="page">
      <nav><button className="secondary" onClick={() => navigate("/")}>К списку комнат</button><span className="nav-actions"><button className="secondary" onClick={() => navigate("/help")}>Помощь</button><ThemeToggle /></span></nav>
      {error && <p className="error">{error}</p>}
      {room && <section className="card room-page"><span className="room-type">{room.is_public ? "Публичная комната" : "Закрытая комната"}</span><h1>{room.name}</h1><p className="muted">Отправьте код тем, кого хотите пригласить.</p><div className="invite-code"><span>Код комнаты</span><strong>{room.invite_code}</strong></div>{profile && (profile.id === room.owner_id ? <div className="room-action"><p className="muted">Если удалить комнату, она исчезнет у всех участников.</p><button className="danger" onClick={deleteRoom}>Удалить комнату</button></div> : <div className="room-action"><p className="muted">Вы сможете вернуться в комнату по её коду.</p><button className="secondary" onClick={leaveRoom}>Выйти из комнаты</button></div>)}</section>}
    </main>
  )
}

