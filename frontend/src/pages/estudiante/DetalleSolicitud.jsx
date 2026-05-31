import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{estado.replace('_', ' ')}</span>
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function DetalleSolicitud() {
  const { ticket } = useParams()
  const location = useLocation()
  const [solicitud, setSolicitud] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get(`/solicitudes/${ticket}`)
      .then(r => setSolicitud(r.data))
      .catch(() => setError('Solicitud no encontrada'))
      .finally(() => setLoading(false))
  }, [ticket])

  if (loading) return <AppShell><p className="loading-msg">Cargando solicitud...</p></AppShell>
  if (error) return <AppShell><div className="global-error">{error}</div></AppShell>

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">{solicitud.tipo_tramite.nombre}</h1>
          <p className="page-subtitle">Seguimiento de solicitud</p>
        </div>
        <Link to="/solicitudes" className="btn-ghost">← Mis solicitudes</Link>
      </div>

      {location.state?.nuevo && (
        <div style={{ background: 'var(--gray-100)', borderLeft: '3px solid var(--black)', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem' }}>
          Solicitud enviada correctamente. Tu número de ticket es <strong>{location.state.ticket}</strong>.
        </div>
      )}

      <div className="solicitud-detail-grid">
        <div>
          <div className="detail-section">
            <p className="detail-section-title">Información</p>
            <div className="detail-meta">
              <div className="detail-meta-row">
                <span className="detail-meta-key">Estado</span>
                <EstadoBadge estado={solicitud.estado} />
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Fecha de envío</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem' }}>{formatFecha(solicitud.created_at)}</span>
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Última actualización</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem' }}>{formatFecha(solicitud.updated_at)}</span>
              </div>
              {solicitud.descripcion && (
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--gray-200)' }}>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    {solicitud.descripcion}
                  </p>
                </div>
              )}
            </div>
          </div>

          {solicitud.documentos.length > 0 && (
            <div className="detail-section">
              <p className="detail-section-title">Documentos</p>
              <div className="doc-list">
                {solicitud.documentos.map(d => (
                  <div key={d.id} className="doc-item">
                    <span className="doc-item-name">{d.nombre_archivo}</span>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${d.url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: 'var(--black)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      Descargar →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <p className="detail-section-title">Historial</p>
            {solicitud.historial.length === 0 ? (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--gray-400)' }}>Sin actualizaciones aún.</p>
            ) : (
              <div className="historial-list">
                {solicitud.historial.map((h, i) => (
                  <div key={i} className="historial-item">
                    <span className="historial-date">{formatFecha(h.fecha)}</span>
                    <div className="historial-body">
                      <p className="historial-estados">
                        {h.estado_anterior
                          ? <>{h.estado_anterior.replace('_', ' ')}<span className="historial-arrow">→</span>{h.estado_nuevo.replace('_', ' ')}</>
                          : h.estado_nuevo.replace('_', ' ')
                        }
                      </p>
                      {h.comentario && <p className="historial-comment">{h.comentario}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="ticket-hero">
            <p className="ticket-hero-label">Número de ticket</p>
            <p className="ticket-hero-code">{solicitud.ticket}</p>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--gray-400)', lineHeight: 1.6 }}>
            Guarda este número para hacer seguimiento de tu solicitud en la taquilla.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
