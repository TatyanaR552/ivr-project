import { useEffect, useRef, useState } from "react"

import { api } from "../api.js"
import { useAutoResize } from "../useAutoResize.js"
import { submitWithCtrlEnter } from "../formShortcuts.js"

const COLUMNS = [
  { status: "todo", title: "Нужно сделать" },
  { status: "in_progress", title: "В работе" },
  { status: "done", title: "Готово" },
]

export default function KanbanBoard({ roomId, taskVersion, connected }) {
  const [tasks, setTasks] = useState([])
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState("")
  const [loadError, setLoadError] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [pending, setPending] = useState(false)
  const [formPending, setFormPending] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const titleRef = useRef(null)
  const descriptionRef = useRef(null)
  const [draggedId, setDraggedId] = useState(null)
  const [dropStatus, setDropStatus] = useState(null)

  useAutoResize(descriptionRef, description)
  useAutoResize(titleRef, title)

  useEffect(() => {
    let disposed = false
    api.listTasks(roomId)
      .then((result) => {
        if (disposed) return
        setTasks(result)
        setLoaded(true)
        setLoadError("")
      })
      .catch((requestError) => {
        if (!disposed) setLoadError(requestError.message)
      })
    return () => { disposed = true }
  }, [roomId, taskVersion, refresh])

  function clearForm() {
    setEditingId(null)
    setTitle("")
    setDescription("")
    setError("")
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (formPending) return
    if (!connected || !loaded) {
      setError("Дождитесь подключения и загрузки доски.")
      return
    }
    const cleanTitle = title.trim()
    if (!cleanTitle || cleanTitle.length > 120) {
      setError("Введите название задачи от 1 до 120 символов.")
      return
    }
    if (description.trim().length > 1000) {
      setError("Описание должно содержать не больше 1000 символов.")
      return
    }
    setFormPending(true)
    setError("")
    try {
      if (editingId) {
        await api.updateTask(roomId, editingId, { title: cleanTitle, description: description.trim() })
      } else {
        await api.createTask(roomId, cleanTitle, description.trim())
      }
      clearForm()
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setFormPending(false)
    }
  }

  function editTask(task) {
    setEditingId(task.id)
    setTitle(task.title)
    setDescription(task.description)
    setError("")
    titleRef.current?.focus()
  }

  async function moveTask(task, status) {
    if (pending || formPending || !connected) return
    setPending(true)
    setError("")
    try {
      await api.updateTask(roomId, task.id, { status })
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  async function deleteTask(task) {
    if (pending || formPending || !connected || !window.confirm(`Удалить задачу "${task.title}"?`)) return
    setPending(true)
    setError("")
    try {
      await api.deleteTask(roomId, task.id)
      if (editingId === task.id) clearForm()
      setRefresh((value) => value + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  const disabled = pending || formPending || !connected || !loaded
  const formDisabled = formPending || !connected || !loaded

  function dropTask(event, status) {
    event.preventDefault()
    const task = tasks.find((item) => item.id === draggedId)
    setDraggedId(null)
    setDropStatus(null)
    if (!disabled && task && task.status !== status) moveTask(task, status)
  }

  return (
    <section className="card kanban-board">
      <h2>Доска задач</h2>
      <form className="task-form" onSubmit={handleSubmit} onKeyDown={submitWithCtrlEnter} noValidate>
        {editingId && <p className="muted">Редактирование задачи</p>}
        <label>Название<textarea ref={titleRef} value={title} rows={2} maxLength={120} disabled={formPending} onChange={(event) => { setTitle(event.target.value); setError("") }} /></label>
        <label>Описание<textarea ref={descriptionRef} value={description} rows={2} maxLength={1000} disabled={formPending} onChange={(event) => { setDescription(event.target.value); setError("") }} /></label>
        <div className="task-form-actions">
          <button type="submit" disabled={formDisabled}>{editingId ? "Сохранить" : "Добавить задачу"}</button>
          {editingId && <button type="button" className="secondary" disabled={formPending} onClick={clearForm}>Отмена</button>}
        </div>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {loadError && <div className="board-load-error"><p className="error" role="alert">Не удалось обновить доску. {loadError}</p><button className="secondary" onClick={() => setRefresh((value) => value + 1)}>Повторить</button></div>}
      {!loaded && !loadError && <p className="muted">Загружаем задачи...</p>}
      <div className="kanban-columns">
        {COLUMNS.map((column) => (
          <section className={`kanban-column${dropStatus === column.status ? " kanban-column-drop" : ""}`} key={column.status} onDragOver={(event) => {
            if (disabled || !draggedId) return
            event.preventDefault()
            event.dataTransfer.dropEffect = "move"
            setDropStatus(column.status)
          }} onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setDropStatus(null)
          }} onDrop={(event) => dropTask(event, column.status)}>
            <h3>{column.title} <span className="task-count">{tasks.filter((task) => task.status === column.status).length}</span></h3>
            {loaded && !tasks.some((task) => task.status === column.status) && <p className="muted">Нет задач</p>}
            {tasks.filter((task) => task.status === column.status).map((task) => (
              <article className={`task-card${draggedId === task.id ? " task-card-dragging" : ""}`} key={task.id} draggable={!disabled} onDragStart={(event) => {
                if (disabled || event.target.closest("button")) {
                  event.preventDefault()
                  return
                }
                event.dataTransfer.effectAllowed = "move"
                event.dataTransfer.setData("text/plain", task.id)
                setDraggedId(task.id)
              }} onDragEnd={() => { setDraggedId(null); setDropStatus(null) }}>
                <h4>{task.title}</h4>
                {task.description && <p>{task.description}</p>}
                <div className="task-actions">
                  {COLUMNS.filter((target) => target.status !== task.status).map((target) => (
                    <button key={target.status} className="secondary" disabled={disabled} aria-label={`Переместить задачу "${task.title}" в "${target.title}"`} onClick={() => moveTask(task, target.status)}>{target.title}</button>
                  ))}
                </div>
                <div className="task-actions task-edit-actions">
                  <button className="secondary" disabled={disabled} onClick={() => editTask(task)}>Изменить</button>
                  <button className="secondary" disabled={disabled} onClick={() => deleteTask(task)}>Удалить</button>
                </div>
              </article>
            ))}
          </section>
        ))}
      </div>
    </section>
  )
}
