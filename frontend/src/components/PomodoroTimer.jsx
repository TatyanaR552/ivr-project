import { useEffect, useState } from "react"

export default function PomodoroTimer({ timer, connected, pending, send, error }) {
  const [now, setNow] = useState(performance.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(interval)
  }, [])

  if (!timer) {
    return <section className="card timer-card"><h2>Таймер Помодоро</h2><p className="muted">Подключаем таймер...</p></section>
  }

  const elapsed = timer.status === "running" ? Math.max(0, (now - timer.receivedAt) / 1000) : 0
  const remaining = Math.max(0, Math.ceil(timer.remaining_seconds - elapsed))
  const finished = remaining === 0 && (timer.status === "running" || timer.status === "finished")
  const running = timer.status === "running" && !finished
  const paused = timer.status === "paused"
  const disabled = !connected || pending
  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0")
  const seconds = String(remaining % 60).padStart(2, "0")

  return (
    <section className="card timer-card">
      <h2>Таймер Помодоро</h2>
      <p className="muted">Работа - 25 минут, перерыв - 5 минут</p>
      <div className="timer-time" role="timer" aria-label="Оставшееся время">{minutes}:{seconds}</div>
      <div className="timer-controls">
        {!running && !paused && <>
          <button disabled={disabled} onClick={() => send({ type: "timer_start", mode: "work" })}>Начать работу</button>
          <button className="secondary" disabled={disabled} onClick={() => send({ type: "timer_start", mode: "break" })}>Начать перерыв</button>
        </>}
        {running && <button disabled={disabled} onClick={() => send({ type: "timer_pause" })}>Пауза</button>}
        {paused && <button disabled={disabled} onClick={() => send({ type: "timer_resume" })}>Продолжить</button>}
        <button className="secondary" disabled={disabled} onClick={() => send({ type: "timer_reset" })}>Сбросить</button>
      </div>
      {!connected && <p className="error" role="status">Нет связи с комнатой. Дождитесь подключения.</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
