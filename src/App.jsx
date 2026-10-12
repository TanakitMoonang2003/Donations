import Index from './pages/index.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import OverlayPage from './pages/OverlayPage.jsx'
import OverlayGoalPage from './pages/OverlayGoalPage.jsx'

function App() {
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