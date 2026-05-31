import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

export default function DashboardCoord() {
  const [stats, setStats] = useState({ pendiente: 0, en_atencion: 0, escalada: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/operador/bandeja?estado=pendiente'),
      client.get('/operador/bandeja?estado=en_atencion'),
      client.get('/coordinador/solicitudes-escaladas'),
    ]).then(([pend, aten, esc]) => {
      setStats({
        pendiente: pend.data.length,
        en_atencion: aten.data.length,
        escalada: esc.data.length,
      })
    }).finally(() => setLoading(false))
  }, [])

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Resumen</h1>
          <p className="page-subtitle">Estado actual del sistema</p>
        </div>
      </div>

      {loading ? <p className="loading-msg">Cargando...</p> : (
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-value">{stats.pendiente}</p>
            <p className="stat-label">Pendientes</p>
          </div>
          <div className="stat-card">
            <p className="stat-value">{stats.en_atencion}</p>
            <p className="stat-label">En atención</p>
          </div>
          <div className={`stat-card${stats.escalada > 0 ? '' : ''}`}>
            <p className={`stat-value${stats.escalada > 0 ? ' red' : ''}`}>{stats.escalada}</p>
            <p className="stat-label">Escaladas</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 380 }}>
        <Link to="/coordinador/tramites" className="btn-primary">Gestionar tipos de trámite →</Link>
        <Link to="/coordinador/escaladas" className="btn-ghost">Ver solicitudes escaladas →</Link>
        <Link to="/coordinador/usuarios" className="btn-ghost">Gestionar operadores →</Link>
      </div>
    </CoordShell>
  )
}
