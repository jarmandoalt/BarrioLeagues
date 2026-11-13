import { useEffect, useState } from 'react'

const FloatingNotification = ({ notification }) => {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setVisible(false), 6000)
    return () => window.clearTimeout(timeoutId)
  }, [notification.id, notification.type, notification.message])

  if (!visible) return null

  return <div className={`floating-notification ${notification.type}`} role={['error', 'warning'].includes(notification.type) ? 'alert' : 'status'}>
    <div className="floating-notification-content">
      <p>{notification.message}</p>
      {notification.action && <button
        className="floating-notification-action"
        type="button"
        onClick={notification.action.onClick}
      >{notification.action.label}</button>}
    </div>
    <button type="button" aria-label="Cerrar notificación" onClick={() => setVisible(false)}><span aria-hidden="true">&times;</span></button>
  </div>
}

const FloatingNotifications = ({ notifications }) => {
  const visibleNotifications = notifications.filter((notification) => notification?.message)
  if (visibleNotifications.length === 0) return null

  return <div className="floating-notification-stack" aria-live="polite" aria-relevant="additions">
    {visibleNotifications.map((notification, index) => <FloatingNotification
      key={`${notification.id || 'notification'}-${notification.type}-${notification.message}-${index}`}
      notification={notification}
    />)}
  </div>
}

export default FloatingNotifications