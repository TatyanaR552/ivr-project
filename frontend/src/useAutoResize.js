import { useEffect, useLayoutEffect } from "react"

function resizeField(field) {
  if (!field) return
  field.style.overflowY = "hidden"
  field.style.height = "auto"
  field.style.height = `${Math.min(field.scrollHeight + 2, 200)}px`
  field.style.overflowY = "auto"
}

export function useAutoResize(ref, value) {
  useLayoutEffect(() => {
    resizeField(ref.current)
  }, [ref, value])

  useEffect(() => {
    const field = ref.current
    if (!field) return
    let previousWidth = field.clientWidth
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== previousWidth) {
        previousWidth = field.clientWidth
        resizeField(field)
      }
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [ref])
}
