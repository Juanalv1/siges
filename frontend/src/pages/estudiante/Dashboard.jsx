import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{estado.replace('_', ' ')}</span>
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Dashboard() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get('/solicitudes/mis-solicitudes')
      .then(r => setSolicitudes(r.data))
      .catch(() => setError('No se pudieron cargar las solicitudes'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis solicitudes</h1>
          <p className="page-subtitle">Control de estudios · Taquilla</p>
        </div>
        <Link to="/solicitudes/nueva" className="btn-primary">+ Nueva solicitud</Link>
      </div>

      {error && <div className="global-error">{error}</div>}
      {loading && <p className="loading-msg">Cargando...</p>}

      {!loading && solicitudes.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">Sin solicitudes</p>
          <p className="empty-state-sub">No has realizado ningún trámite todavía.</p>
          <Link to="/solicitudes/nueva" className="btn-primary">Crear primera solicitud</Link>
        </div>
      )}

      {!loading && solicitudes.length > 0 && (
        <table className="solicitudes-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Trámite</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map(s => (
              <tr key={s.id}>
                <td><span className="ticket-code">{s.ticket}</span></td>
                <td>{s.tipo_tramite.nombre}</td>
                <td><EstadoBadge estado={s.estado} /></td>
                <td><span className="table-date">{formatFecha(s.created_at)}</span></td>
                <td>
                  <Link to={`/solicitudes/${s.ticket}`} className="table-link">
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  )
}
