import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { api, saveToken } from "../api.js"
import ThemeToggle from "../ThemeToggle.jsx"

export default function Login() {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [errorField, setErrorField] = useState("")
  const navigate = useNavigate()
  const sessionExpired = new URLSearchParams(window.location.search).get("session") === "expired"

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setErrorField("")
    if (!username.trim()) {
      setError("Введите почту или имя пользователя.")
      setErrorField("username")
      return
    }
    if (!password) {
      setError("Введите пароль.")
      setErrorField("password")
      return
    }
    try {
      const result = await api.login(username.trim(), password)
      saveToken(result.access_token)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="centered-page auth-page">
      <div className="auth-intro"><p className="eyebrow">Co-Study</p><h1>Учитесь вместе</h1><p>Создавайте учебные комнаты и присоединяйтесь к существующим.</p><ThemeToggle /></div>
      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <p className="brand">Co-Study</p>
        <h1>Вход</h1>
        {sessionExpired && <p className="notice">Сеанс завершён. Войдите снова.</p>}
        <label>Email или имя пользователя<input value={username} onChange={(event) => { setUsername(event.target.value); setError(""); setErrorField("") }} aria-invalid={errorField === "username"} /></label>
        {error && errorField === "username" && <p className="field-error">{error}</p>}
        <label>Пароль<input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); setErrorField("") }} aria-invalid={errorField === "password"} /></label>
        {error && errorField === "password" && <p className="field-error">{error}</p>}
        {error && !errorField && <p className="field-error">{error}</p>}
        <button type="submit">Войти</button>
        <p>Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
      </form>
    </main>
  )
}

