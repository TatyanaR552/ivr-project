import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"

import { api, saveToken } from "../api.js"
import ThemeToggle from "../ThemeToggle.jsx"

export default function Register() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [errorField, setErrorField] = useState("")
  const navigate = useNavigate()

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setErrorField("")
    const cleanEmail = email.trim()
    const cleanUsername = username.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError("Введите адрес электронной почты.")
      setErrorField("email")
      return
    }
    if (cleanUsername.length < 3) {
      setError("Имя пользователя должно содержать не меньше 3 символов.")
      setErrorField("username")
      return
    }
    if (!/^[A-Za-zА-Яа-яЁё0-9_-]+$/.test(cleanUsername)) {
      setError("В имени можно использовать буквы, цифры, _ и -.")
      setErrorField("username")
      return
    }
    if (password.length < 8) {
      setError("Пароль должен содержать не меньше 8 символов.")
      setErrorField("password")
      return
    }
    try {
      await api.register(cleanEmail, cleanUsername, password)
      const result = await api.login(cleanUsername, password)
      saveToken(result.access_token)
      navigate("/")
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <main className="centered-page auth-page">
      <div className="auth-intro"><p className="eyebrow">Co-Study</p><h1>Учебные комнаты</h1><p>Зарегистрируйтесь, чтобы создать свою комнату или присоединиться к существующей.</p><ThemeToggle /></div>
      <form className="card form-card" onSubmit={handleSubmit} noValidate>
        <p className="brand">Co-Study</p>
        <h1>Регистрация</h1>
        <p className="muted">Придумайте имя пользователя и пароль.</p>
        <label>Email<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); setErrorField("") }} aria-invalid={errorField === "email"} /></label>
        {error && errorField === "email" && <p className="field-error">{error}</p>}
        <label>Имя пользователя<input value={username} onChange={(event) => { setUsername(event.target.value); setError(""); setErrorField("") }} maxLength={30} aria-invalid={errorField === "username"} /></label>
        {error && errorField === "username" && <p className="field-error">{error}</p>}
        <label>Пароль<input type="password" value={password} onChange={(event) => { setPassword(event.target.value); setError(""); setErrorField("") }} maxLength={72} aria-invalid={errorField === "password"} /></label>
        {error && errorField === "password" && <p className="field-error">{error}</p>}
        {error && !errorField && <p className="field-error">{error}</p>}
        <button type="submit">Зарегистрироваться</button>
        <p>Уже есть аккаунт? <Link to="/login">Войти</Link></p>
      </form>
    </main>
  )
}

