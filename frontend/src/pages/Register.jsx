import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { api, saveToken } from "../api.js"

export default function Register() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    try {
      await api.register(email, username, password)
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
        <h1>Регистрация</h1>
        <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>Имя пользователя<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={3} maxLength={30} required /></label>
        <label>Пароль<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={72} required /></label>
        {error && <p className="error">{error}</p>}
        <button type="submit">Зарегистрироваться</button>
        <p>Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </form>
    </main>
  )
}

