const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

// Старый общий токен не переносим: каждая вкладка начинает свою сессию.
localStorage.removeItem("token")

export function getToken() {
  return sessionStorage.getItem("token")
}

export function getRoomSocketUrl(roomId) {
  const url = new URL(`${API_BASE}/ws/rooms/${roomId}`, window.location.origin)
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
  return url.href
}

async function apiFetch(path, options = {}) {
  const isPublicAuth = path === "/auth/login" || path === "/auth/register"
  const token = isPublicAuth ? null : getToken()
  const isForm = options.body instanceof URLSearchParams
  const headers = {
    ...(!isForm && options.body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  }

  let response
  const attempts = !options.method || options.method === "GET" ? 3 : 1
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      response = await fetch(`${API_BASE}${path}`, { ...options, headers })
      break
    } catch {
      if (attempt === attempts - 1) {
        throw new Error("Не удалось связаться с сервером.")
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
    }
  }
  if (!response.ok) {
    if (response.status === 401 && token && getToken() === token) {
      clearToken()
      window.location.replace("/login?session=expired")
    }
    const body = await response.json().catch(() => ({}))
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => item.msg).join(". ")
      : body.detail
    throw new Error(detail || `Ошибка запроса: ${response.status}`)
  }
  return response.json()
}

export const api = {
  register: (email, username, password) => apiFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password }),
  }),
  login: (username, password) => {
    const form = new URLSearchParams()
    form.set("username", username)
    form.set("password", password)
    return apiFetch("/auth/login", { method: "POST", body: form })
  },
  profile: () => apiFetch("/auth/me"),
  myRooms: () => apiFetch("/rooms"),
  publicRooms: () => apiFetch("/rooms/public"),
  createRoom: (name, isPublic) => apiFetch("/rooms", {
    method: "POST",
    body: JSON.stringify({ name, is_public: isPublic }),
  }),
  joinRoom: (inviteCode) => apiFetch("/rooms/join", {
    method: "POST",
    body: JSON.stringify({ invite_code: inviteCode }),
  }),
  getRoom: (roomId) => apiFetch(`/rooms/${roomId}`),
  roomMembers: (roomId) => apiFetch(`/rooms/${roomId}/members`),
  olderMessages: (roomId, before) => apiFetch(`/rooms/${roomId}/messages?before=${encodeURIComponent(before)}`),
  leaveRoom: (roomId) => apiFetch(`/rooms/${roomId}/leave`, { method: "POST" }),
  deleteRoom: (roomId) => apiFetch(`/rooms/${roomId}`, { method: "DELETE" }),
  listTasks: (roomId) => apiFetch(`/rooms/${roomId}/tasks`),
  createTask: (roomId, title, description) => apiFetch(`/rooms/${roomId}/tasks`, {
    method: "POST",
    body: JSON.stringify({ title, description }),
  }),
  updateTask: (roomId, taskId, changes) => apiFetch(`/rooms/${roomId}/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  }),
  deleteTask: (roomId, taskId) => apiFetch(`/rooms/${roomId}/tasks/${taskId}`, { method: "DELETE" }),
}

export function saveToken(token) {
  sessionStorage.setItem("token", token)
}

export function clearToken() {
  sessionStorage.removeItem("token")
}

export function isAuthenticated() {
  return Boolean(getToken())
}

