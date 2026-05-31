import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import '../estudiante/estudiante.css'
import './operador.css'

function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{estado.replace('_', ' ')}</span>
}

function tiempoTranscurrido(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hrs >= 24) return { texto: `${Math.floor(hrs / 24)}d`, urgente: true }
  if (hrs > 0) return { texto: `${hrs}h ${mins}m`, urgente: hrs >= 8 }
  return { texto: `${mins}m`, urgente: false }
}

export default function Bandeja() {
  const navigate = useNavigate()
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtros, setFiltros] = useState({ estado: '', tipo_tramite_id: '' })
  const [tipos, setTipos] = useState([])

  useEffect(() => {
    client.get('/tipos-tramite').then(r => setTipos(r.data))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filtros.estado) params.set('estado', filtros.estado)
    if (filtros.tipo_tramite_id) params.set('tipo_tramite_id', filtros.tipo_tramite_id)
    setLoading(true)
    client.get(`/operador/bandeja?${params}`)
      .then(r => setSolicitudes(r.data))
      .finally(() => setLoading(false))
  }, [filtros])

  async function handleAbrir(s) {
    try {
      await client.post(`/operador/solicitudes/${s.id}/abrir`)
      navigate(`/operador/solicitudes/${s.id}`)
    } catch (err) {
      if (err.response?.status === 409) {
        navigate(`/operador/solicitudes/${s.id}`)
      }
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bandeja</h1>
          <p className="page-subtitle">Solicitudes pendientes y en atención</p>
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: 'var(--gray-400)' }}>
          {solicitudes.length} solicitud{solicitudes.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="filtros-bar">
        <div className="filtro-group">
          <span className="filtro-label">Estado</span>
          <select
            className="filtro-select"
            value={filtros.estado}
            onChange={e => setFiltros(f => ({ ...f, estado: e.target.value }))}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_atencion">En atención</option>
          </select>
        </div>
        <div className="filtro-group">
          <span className="filtro-label">Tipo de trámite</span>
          <select
            className="filtro-select"
            value={filtros.tipo_tramite_id}
            onChange={e => setFiltros(f => ({ ...f, tipo_tramite_id: e.target.value }))}
          >
            <option value="">Todos</option>
            {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
      </div>

      {loading && <p className="loading-msg">Cargando bandeja...</p>}

      {!loading && solicitudes.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">Bandeja vacía</p>
          <p className="empty-state-sub">No hay solicitudes que atender en este momento.</p>
        </div>
      )}

      {!loading && solicitudes.length > 0 && (
        <table className="bandeja-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Tipo</th>
              <th>Solicitante</th>
              <th>Estado</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map(s => {
              const t = tiempoTranscurrido(s.created_at)
              return (
                <tr key={s.id} onClick={() => handleAbrir(s)}>
                  <td><span className="ticket-code">{s.ticket}</span></td>
                  <td>{s.tipo_tramite}</td>
                  <td>{s.usuario}</td>
                  <td><EstadoBadge estado={s.estado} /></td>
                  <td><span className={`tiempo-transcurrido${t.urgente ? ' tiempo-urgente' : ''}`}>{t.texto}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  )
}
