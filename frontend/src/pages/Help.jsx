import { useNavigate } from "react-router-dom"

import ThemeToggle from "../ThemeToggle.jsx"

export default function Help() {
  const navigate = useNavigate()

  return (
    <main className="page">
      <nav>
        <button className="secondary" onClick={() => navigate("/")}>К комнатам</button>
        <ThemeToggle />
      </nav>
      <header className="hero">
        <p className="eyebrow">Co-Study</p>
        <h1>Помощь</h1>
        <p>Ответы на основные вопросы о комнатах и аккаунте.</p>
      </header>
      <div className="help-grid">
        <section className="card">
          <h2>Как войти</h2>
          <p>При регистрации укажите почту, имя пользователя и пароль. Для следующего входа подойдут имя пользователя или почта.</p>
        </section>
        <section className="card">
          <h2>Как создать комнату</h2>
          <p>Введите название и нажмите "Создать". Комната может быть закрытой или публичной. Публичные комнаты видны в общем списке.</p>
        </section>
        <section className="card">
          <h2>Как присоединиться</h2>
          <p>Введите код комнаты или выберите публичную комнату из списка. После этого она появится в разделе "Мои комнаты".</p>
        </section>
        <section className="card">
          <h2>Как выйти или удалить комнату</h2>
          <p>Участник может выйти из комнаты. Создатель может удалить её для всех участников. Перед удалением потребуется подтверждение.</p>
        </section>
      </div>
    </main>
  )
}
