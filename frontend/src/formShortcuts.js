export function submitWithCtrlEnter(event) {
  if (event.key !== "Enter" || !event.ctrlKey || event.nativeEvent.isComposing) return
  if (event.target.tagName !== "TEXTAREA") return
  event.preventDefault()
  const button = event.currentTarget.querySelector('button[type="submit"]')
  if (button && !button.disabled) event.currentTarget.requestSubmit(button)
}
