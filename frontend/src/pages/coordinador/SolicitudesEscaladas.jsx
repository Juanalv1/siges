import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

function Modal({ ticket, onConfirm, onCancel, loading }) {
  const [accion, setAccion] = useState('aprobar')
  const [comentario, setComentario] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-title">Resolver — {ticket}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            style={{ flex: 1, padding: '0.6rem', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1.5px solid', borderColor: accion === 'aprobar' ? 'var(--black)' : 'var(--gray-200)', background: accion === 'aprobar' ? 'var(--black)' : 'transparent', color: accion === 'aprobar' ? 'var(--white)' : 'var(--gray-400)' }}
            onClick={() => setAccion('aprobar')}
          >
            Aprobar
          </button>
          <button
            type="button"
            style={{ flex: 1, padding: '0.6rem', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.12em', textTransform: 'uppercase', cursor: 'pointer', border: '1.5px solid', borderColor: accion === 'rechazar' ? 'var(--red)' : 'var(--gray-200)', background: accion === 'rechazar' ? 'var(--red)' : 'transparent', color: accion === 'rechazar' ? 'var(--white)' : 'var(--gray-400)' }}
            onClick={() => setAccion('rechazar')}
          >
            Rechazar
          </button>
        </div>
        <textarea
          className="modal-textarea"
          placeholder="Comentario/motivo (requerido)..."
          value={comentario}
          onChange={e => setComentario(e.target.value)}
        />
        <div className="modal-btn-row">
          <button
            className="modal-confirm"
            onClick={() => onConfirm(accion, comentario)}
            disabled={loading || !comentario.trim()}
            style={{ background: accion === 'aprobar' ? 'var(--black)' : 'var(--red)' }}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function SolicitudesEscaladas() {
  const [solicitudes, setSolicitudes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    client.get('/coordinador/solicitudes-escaladas')
      .then(r => setSolicitudes(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function resolver(id, accion, comentario) {
    setActionLoading(true)
    try {
      await client.post(`/coordinador/solicitudes/${id}/resolver`, { accion, comentario })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al resolver')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <CoordShell>
      {modal && (
        <Modal
          ticket={modal.ticket}
          loading={actionLoading}
          onCancel={() => setModal(null)}
          onConfirm={(accion, comentario) => resolver(modal.id, accion, comentario)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Escaladas</h1>
          <p className="page-subtitle">Solicitudes pendientes de resolución</p>
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: solicitudes.length > 0 ? 'var(--red)' : 'var(--gray-400)' }}>
          {solicitudes.length} pendiente{solicitudes.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="global-error">{error}</div>}

      {loading ? <p className="loading-msg">Cargando...</p> : solicitudes.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">Sin escaladas</p>
          <p className="empty-state-sub">No hay solicitudes pendientes de revisión.</p>
        </div>
      ) : (
        <table className="solicitudes-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Tipo</th>
              <th>Solicitante</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map(s => (
              <tr key={s.id}>
                <td><span className="ticket-code">{s.ticket}</span></td>
                <td>{s.tipo_tramite}</td>
                <td>{s.usuario}</td>
                <td><span className="table-date">{new Date(s.updated_at).toLocaleDateString('es-VE')}</span></td>
                <td>
                  <button
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.6rem' }}
                    onClick={() => setModal({ id: s.id, ticket: s.ticket })}
                  >
                    Resolver →
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </CoordShell>
  )
}
