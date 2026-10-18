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
  const [members, setMembers] = useState(null)
  const [membersError, setMembersError] = useState("")
  const [membersRefresh, setMembersRefresh] = useState(0)
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionPending, setActionPending] = useState(false)
  const navigate = useNavigate()
  const { status: connection, timer, error: timerError, pending, send, messages, historyLoaded, sendChat, taskVersion, membersVersion, hasOlderMessages, olderPageVersion, loadOlderMessages } = useRoomSocket(roomId, Boolean(room && room.id === roomId))
  const connectionText = {
    connecting: "Подключаем обновления комнаты...",
    disconnected: "Связь прервалась. Подключаемся снова...",
    unauthorized: "Сеанс завершён. Войдите снова.",
    forbidden: "Нет доступа к обновлениям комнаты.",
  }

  useEffect(() => {
    if (connection === "deleted") {
      setRoom(null)
      setConfirmAction(null)
      setError("Комната не найдена")
    }
  }, [connection])

  useEffect(() => {
    let disposed = false
    setRoom(null)
    setConfirmAction(null)
    setMembers(null)
    setError("")
    setMembersError("")
    Promise.all([api.getRoom(roomId), api.profile()])
      .then(([loadedRoom, loadedProfile]) => {
        if (disposed) return
        setRoom(loadedRoom)
        setProfile(loadedProfile)
      })
      .catch((requestError) => { if (!disposed) setError(requestError.message) })
    return () => { disposed = true }
  }, [roomId])

  useEffect(() => {
    if (room?.id !== roomId) return
    let disposed = false
    api.roomMembers(roomId)
      .then((result) => {
        if (disposed) return
        setMembers(result)
        setMembersError("")
      })
      .catch((requestError) => { if (!disposed) setMembersError(requestError.message) })
    return () => { disposed = true }
  }, [roomId, room?.id, membersVersion, membersRefresh])

  async function leaveRoom() {
    if (actionPending) return
    setActionPending(true)
    setError("")
    try {
      await api.leaveRoom(roomId)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setActionPending(false)
    }
  }

  async function deleteRoom() {
    if (actionPending) return
    setActionPending(true)
    setError("")
    try {
      await api.deleteRoom(roomId)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setActionPending(false)
    }
  }

  return (
    <main className="page room-workspace">
      <nav><button className="secondary" onClick={() => navigate("/")}>К списку комнат</button><span className="nav-actions"><button className="secondary" onClick={() => navigate("/help")}>Помощь</button><ThemeToggle /></span></nav>
      {error && <p className="error">{error}</p>}
      {room && connectionText[connection] && <p className="muted" role="status">{connectionText[connection]}</p>}
      {room && <>
        <section className="card room-summary">
          <div className="room-summary-main">
            <span className="room-type">{room.is_public ? "Публичная комната" : "Закрытая комната"}</span>
            <h1>{room.name}</h1>
            <section className="room-members" aria-label="Участники комнаты">
              <h2>Участники{members !== null && <span className="members-count">{members.length}</span>}</h2>
              {members === null && !membersError && <p className="muted">Загружаем участников...</p>}
              {membersError && <div><p className="error" role="alert">Не удалось обновить список участников. {membersError}</p><button className="secondary" onClick={() => setMembersRefresh((value) => value + 1)}>Повторить</button></div>}
              {members !== null && <ul className="members-list">{members.map((member) => (
                <li key={member.id}><span>{member.username}</span>{member.is_owner && <span className="member-owner">Владелец</span>}</li>
              ))}</ul>}
            </section>
            {profile && <div className="room-action">
              {confirmAction ? <div role="group" aria-label="Подтверждение действия с комнатой" onKeyDown={(event) => {
                if (event.key === "Escape" && !actionPending) setConfirmAction(null)
              }}>
                <p>{confirmAction === "delete"
                  ? "Удалить комнату?"
                  : "Выйти из комнаты?"}</p>
                <div className="task-edit-actions">
                  <button className="secondary" disabled={actionPending} onClick={() => setConfirmAction(null)} autoFocus>Отмена</button>
                  <button className={confirmAction === "delete" ? "danger" : "secondary"} disabled={actionPending} onClick={confirmAction === "delete" ? deleteRoom : leaveRoom}>
                    {confirmAction === "delete" ? "Удалить комнату" : "Выйти из комнаты"}
                  </button>
                </div>
              </div> : profile.id === room.owner_id ? <>
                <button className="danger" onClick={() => setConfirmAction("delete")}>Удалить комнату</button>
              </> : <>
                <button className="secondary" onClick={() => setConfirmAction("leave")}>Выйти из комнаты</button>
              </>}
            </div>}
          </div>
          <div className="room-summary-invite">
            <div className="invite-code"><span>Код комнаты</span><strong>{room.invite_code}</strong></div>
          </div>
        </section>
        <div className="room-tools">
          <PomodoroTimer timer={timer} connected={connection === "connected"} pending={pending} send={send} error={timerError} />
          <Chat key={roomId} messages={messages} connected={connection === "connected"} historyLoaded={historyLoaded} sendChat={sendChat} userId={profile?.id} hasOlderMessages={hasOlderMessages} olderPageVersion={olderPageVersion} loadOlderMessages={loadOlderMessages} />
        </div>
        <KanbanBoard key={roomId} roomId={roomId} taskVersion={taskVersion} connected={connection === "connected"} />
      </>}
    </main>
  )
}

