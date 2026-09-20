import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"

import { api, clearToken } from "../api.js"

export default function Profile() {
  const [user, setUser] = useState(null)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    api.profile().then(setUser).catch((requestError) => setError(requestError.message))
  }, [])

  function logout() {
    clearToken()
    navigate("/login")
  }

  return (
    <main className="page">
      <nav><button className="secondary" onClick={() => navigate("/")}>К комнатам</button></nav>
      <section className="card profile-card">
        <h1>Профиль</h1>
        {user && <><p>Имя: {user.username}</p><p>Email: {user.email}</p></>}
        {error && <p className="error">{error}</p>}
        <button onClick={logout}>Выйти из аккаунта</button>
      </section>
    </main>
  )
}

