import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { api, saveToken } from "../api.js"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    try {
      const result = await api.login(username, password)
      saveToken(result.access_token)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="centered-page">
      <form className="card form-card" onSubmit={handleSubmit}>
        <p className="brand">Co-Study</p>
        <h1>Вход</h1>
        <label>Email или имя пользователя<input value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Войти</button>
        <p>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </form>
    </main>
  )
}

