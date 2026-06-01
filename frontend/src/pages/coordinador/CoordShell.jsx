import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './coordinador.css'

export default function CoordShell({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="coord-layout">
      <header className="topbar">
        <span className="topbar-brand" style={{ fontFamily: 'DM Serif Display, serif', fontSize: '1.3rem', color: 'white', letterSpacing: '-0.5px' }}>
          Si<span style={{ color: 'var(--red)' }}>GES</span>
        </span>
        <div className="topbar-right">
          {user && <span className="topbar-user">{user.name} · coordinator</span>}
          <button className="topbar-logout" onClick={handleLogout}>Sign out</button>
        </div>
      </header>
      <div className="coord-body">
        <nav className="coord-sidenav">
          <div className="coord-nav-section">
            <span className="coord-nav-label">Dashboard</span>
            <NavLink to="/coordinator" end className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Overview
            </NavLink>
          </div>
          <div className="coord-nav-section">
            <span className="coord-nav-label">Management</span>
            <NavLink to="/coordinator/request-types" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Request types
            </NavLink>
            <NavLink to="/coordinator/escalated" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Escalated requests
            </NavLink>
            <NavLink to="/coordinator/users" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Operators
            </NavLink>
          </div>
        </nav>
        <main className="coord-main">
          {children}
        </main>
      </div>
    </div>
  )
}
