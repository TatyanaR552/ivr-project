import { useState } from "react"

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light")

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light"
    document.documentElement.dataset.theme = nextTheme
    localStorage.setItem("theme", nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button className="secondary" type="button" onClick={toggleTheme}>
      {theme === "light" ? "Тёмная тема" : "Светлая тема"}
    </button>
  )
}
