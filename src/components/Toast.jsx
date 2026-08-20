import { createContext, useCallback, useContext, useRef, useState } from 'react'

/*
  ==========================================================
  SISTEMA DE NOTIFICAÇÕES (TOAST)

  Dá feedback rápido e não-intrusivo para ações do usuário
  (sucesso, erro, aviso), sem depender de mensagens fixas
  espalhadas pela tela. Empilha várias notificações e some
  sozinho depois de alguns segundos.
  ==========================================================
*/

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)

  if (!ctx) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>')
  }

  return ctx
}

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id))

    if (timers.current[id]) {
      clearTimeout(timers.current[id])
      delete timers.current[id]
    }
  }, [])

  const push = useCallback((message, options = {}) => {
    const id = ++toastId
    const type = options.type || 'info'
    const duration = options.duration ?? 4200

    setToasts((list) => [...list, { id, message, type }])

    timers.current[id] = setTimeout(() => dismiss(id), duration)

    return id
  }, [dismiss])

  const toast = {
    success: (message, options) => push(message, { ...options, type: 'success' }),
    error: (message, options) => push(message, { ...options, type: 'error' }),
    info: (message, options) => push(message, { ...options, type: 'info' }),
    warning: (message, options) => push(message, { ...options, type: 'warning' }),
    dismiss,
  }

  return (
    <ToastContext.Provider value={toast}>

      {children}

      <div className="toast-stack" role="status" aria-live="polite">

        {toasts.map((t) => (

          <div
            key={t.id}
            className={`toast toast-${t.type}`}
            onClick={() => dismiss(t.id)}
          >

            <span className="toast-icon">
              {t.type === 'success' && '✓'}
              {t.type === 'error' && '!'}
              {t.type === 'warning' && '!'}
              {t.type === 'info' && 'i'}
            </span>

            <span className="toast-message">
              {t.message}
            </span>

          </div>

        ))}

      </div>

    </ToastContext.Provider>
  )
}
