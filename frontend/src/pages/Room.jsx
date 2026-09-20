import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { api } from "../api.js"

export default function Room() {
  const { roomId } = useParams()
  const [room, setRoom] = useState(null)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    api.getRoom(roomId).then(setRoom).catch((requestError) => setError(requestError.message))
  }, [roomId])

  return (
    <main className="page">
      <button className="secondary" onClick={() => navigate("/")}>К списку комнат</button>
      {error && <p className="error">{error}</p>}
      {room && <section className="card room-page"><h1>{room.name}</h1><p>Код приглашения: <strong>{room.invite_code}</strong></p><p>{room.is_public ? "Публичная комната" : "Закрытая комната"}</p></section>}
    </main>
  )
}

