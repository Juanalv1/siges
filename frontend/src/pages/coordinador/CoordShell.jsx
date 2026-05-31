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
          {user && <span className="topbar-user">{user.nombre} · coordinador</span>}
          <button className="topbar-logout" onClick={handleLogout}>Salir</button>
        </div>
      </header>
      <div className="coord-body">
        <nav className="coord-sidenav">
          <div className="coord-nav-section">
            <span className="coord-nav-label">Panel</span>
            <NavLink to="/coordinador" end className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Resumen
            </NavLink>
          </div>
          <div className="coord-nav-section">
            <span className="coord-nav-label">Gestión</span>
            <NavLink to="/coordinador/tramites" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Tipos de trámite
            </NavLink>
            <NavLink to="/coordinador/escaladas" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Solicitudes escaladas
            </NavLink>
            <NavLink to="/coordinador/usuarios" className={({ isActive }) => `coord-nav-link${isActive ? ' active' : ''}`}>
              Operadores
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
