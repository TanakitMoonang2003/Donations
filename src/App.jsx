import { useEffect } from 'react'
import { API_URL } from './config/apiUrl.js'
import Index from './pages/index.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import OverlayPage from './pages/OverlayPage.jsx'
import OverlayGoalPage from './pages/OverlayGoalPage.jsx'

function App() {
  useEffect(() => {
    let active = true
    let controller
    let timeoutId

    async function pingBackend() {
      controller = new AbortController()
      timeoutId = window.setTimeout(() => controller.abort(), 10_000)

      try {
        const response = await fetch(`${API_URL}/api/health`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!response.ok) {
          console.warn(`Backend keep-alive ping failed with status ${response.status}`)
        }
      } catch (error) {
        if (active) {
          console.warn('Backend keep-alive ping failed:', error.message)
        }
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    void pingBackend()
    const intervalId = window.setInterval(() => {
      void pingBackend()
    }, 5 * 60 * 1000)

    return () => {
      active = false
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
      controller?.abort()
    }
  }, [])

  const goalOverlayMatch = window.location.pathname.match(/^\/overlay\/([^/]+)\/goal\/?$/)
  if (goalOverlayMatch) {
    return <OverlayGoalPage token={goalOverlayMatch[1]} />
  }

  const overlayMatch = window.location.pathname.match(/^\/overlay\/([^/]+)\/?$/)
  if (overlayMatch) {
    return <OverlayPage token={overlayMatch[1]} />
  }

  if (window.location.pathname === "/dashboard") {
    return <OwnerDashboard />
  }

  return <Index />
}
export default App