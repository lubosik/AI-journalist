'use client'
import { useEffect } from 'react'

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

        // When a new SW activates (skipWaiting fires), reload so the page
        // uses the fresh caches instead of serving stale content.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload()
        })

        // Immediately check for an update on every page load
        registration.update().catch(() => {})
      } catch {
        // SW registration is non-critical — app works fine without it
      }
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
    }
  }, [])

  return null
}
