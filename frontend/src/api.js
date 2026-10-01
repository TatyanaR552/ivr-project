const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000"

function getToken() {
  return localStorage.getItem("token")
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
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new Error("Не удалось связаться с сервером.")
  }
  if (!response.ok) {
    if (response.status === 401 && token && getToken()) {
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
  leaveRoom: (roomId) => apiFetch(`/rooms/${roomId}/leave`, { method: "POST" }),
  deleteRoom: (roomId) => apiFetch(`/rooms/${roomId}`, { method: "DELETE" }),
}

export function saveToken(token) {
  localStorage.setItem("token", token)
}

export function clearToken() {
  localStorage.removeItem("token")
}

export function isAuthenticated() {
  return Boolean(getToken())
}

