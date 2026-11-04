import { useSyncExternalStore } from 'react'
import { es, type Strings } from './es'
import { en } from './en'

export type Lang = 'es' | 'en'

const KEY = 'who-lies-lang'

const dicts: Record<Lang, Strings> = { es, en }

function initialLang(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

let current: Lang = initialLang()
const listeners = new Set<() => void>()

function setLang(l: Lang): void {
  if (current === l) return
  current = l
  try {
    localStorage.setItem(KEY, l)
  } catch {
    // noop
  }
  for (const fn of [...listeners]) fn()
}

/** Sustituye {placeholders} por valores. */
export function fill(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)),
    template
  )
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function useI18n(): {
  t: Strings
  lang: Lang
  setLang: (l: Lang) => void
} {
  const lang = useSyncExternalStore(
    subscribe,
    () => current,
    () => current
  )
  return { t: dicts[lang], lang, setLang }
}
