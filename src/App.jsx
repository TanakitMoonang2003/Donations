import Index from './pages/index.jsx'
import OwnerDashboard from './pages/OwnerDashboard.jsx'
import OverlayPage from './pages/OverlayPage.jsx'

function App() {
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