import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api } from "../api.js"
import ThemeToggle from "../ThemeToggle.jsx"
import { useRoomSocket } from "../useRoomSocket.js"
import PomodoroTimer from "../components/PomodoroTimer.jsx"
import Chat from "../components/Chat.jsx"
import KanbanBoard from "../components/KanbanBoard.jsx"

export default function Room() {
  const { roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [profile, setProfile] = useState(null)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const { status: connection, timer, error: timerError, pending, send, messages, historyLoaded, sendChat, taskVersion } = useRoomSocket(roomId, Boolean(room && room.id === roomId))
  const connectionText = {
    connecting: "Подключаем обновления комнаты...",
    connected: "Обновления комнаты подключены.",
    disconnected: "Связь прервалась. Подключаемся снова...",
    unauthorized: "Сеанс завершён. Войдите снова.",
    forbidden: "Нет доступа к обновлениям комнаты.",
  }

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
    <main className="page room-workspace">
      <nav><button className="secondary" onClick={() => navigate("/")}>К списку комнат</button><span className="nav-actions"><button className="secondary" onClick={() => navigate("/help")}>Помощь</button><ThemeToggle /></span></nav>
      {error && <p className="error">{error}</p>}
      {room && <p className="muted" role="status">{connectionText[connection]}</p>}
      {room && <>
        <section className="card room-summary">
          <div className="room-summary-main">
            <span className="room-type">{room.is_public ? "Публичная комната" : "Закрытая комната"}</span>
            <h1>{room.name}</h1>
            {profile && (profile.id === room.owner_id ? <div className="room-action"><p className="muted">Если удалить комнату, она исчезнет у всех участников.</p><button className="danger" onClick={deleteRoom}>Удалить комнату</button></div> : <div className="room-action"><p className="muted">Вы сможете вернуться в комнату по её коду.</p><button className="secondary" onClick={leaveRoom}>Выйти из комнаты</button></div>)}
          </div>
          <div className="room-summary-invite">
            <p className="muted">Отправьте код тем, кого хотите пригласить.</p>
            <div className="invite-code"><span>Код комнаты</span><strong>{room.invite_code}</strong></div>
          </div>
        </section>
        <div className="room-tools">
          <PomodoroTimer timer={timer} connected={connection === "connected"} pending={pending} send={send} error={timerError} />
          <Chat key={roomId} messages={messages} connected={connection === "connected"} historyLoaded={historyLoaded} sendChat={sendChat} userId={profile?.id} />
        </div>
        <KanbanBoard key={roomId} roomId={roomId} taskVersion={taskVersion} connected={connection === "connected"} />
      </>}
    </main>
  )
}

