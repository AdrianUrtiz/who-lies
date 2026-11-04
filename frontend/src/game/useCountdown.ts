import { useEffect, useRef, useState } from 'react'

function fmt(total: number): string {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Cuenta atrás por fase. `key` reinicia el temporizador (p. ej. nº de ronda).
 * `onExpire` se llama una sola vez al llegar a cero (siempre la última
 * versión del callback, sin stale closures).
 */
export function useCountdown(
  seconds: number,
  key: string | number,
  onExpire?: () => void,
): string {
  const [left, setLeft] = useState(seconds)
  const cbRef = useRef(onExpire)
  cbRef.current = onExpire

  useEffect(() => {
    setLeft(seconds)
    if (seconds <= 0) return
    let fired = false
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          clearInterval(id)
          if (!fired) {
            fired = true
            cbRef.current?.()
          }
          return 0
        }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return fmt(left)
}

export const DISCUSSION_SECONDS = 120
export const VOTING_SECONDS = 60
