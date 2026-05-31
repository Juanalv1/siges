import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function AppShell({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="topbar-brand">Si<span>GES</span></span>
        <div className="topbar-right">
          {user && (
            <span className="topbar-user">{user.nombre} · {user.rol}</span>
          )}
          <button className="topbar-logout" onClick={handleLogout}>Salir</button>
        </div>
      </header>
      <div className="page-content">
        {children}
      </div>
    </div>
  )
}
