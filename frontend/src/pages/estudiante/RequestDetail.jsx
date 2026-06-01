import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

export default function DetalleSolicitud() {
  const { ticket } = useParams()
  const location = useLocation()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get(`/requests/${ticket}`)
      .then(r => setRequest(r.data))
      .catch(() => setError('Request not found'))
      .finally(() => setLoading(false))
  }, [ticket])

  if (loading) return <AppShell><p className="loading-msg">Loading request...</p></AppShell>
  if (error) return <AppShell><div className="global-error">{error}</div></AppShell>

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">{request.request_type.name}</h1>
          <p className="page-subtitle">Request tracking</p>
        </div>
        <Link to="/requests" className="btn-ghost">← My requests</Link>
      </div>

      {location.state?.isNew && (
        <div style={{ background: 'var(--gray-100)', borderLeft: '3px solid var(--black)', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem' }}>
          Request submitted successfully. Your ticket number is <strong>{location.state.ticket}</strong>.
        </div>
      )}

      <div className="solicitud-detail-grid">
        <div>
          <div className="detail-section">
            <p className="detail-section-title">Details</p>
            <div className="detail-meta">
              <div className="detail-meta-row">
                <span className="detail-meta-key">Status</span>
                <StatusBadge status={request.status} />
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Submitted</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem' }}>{formatDate(request.created_at)}</span>
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Last update</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.78rem' }}>{formatDate(request.updated_at)}</span>
              </div>
              {request.description && (
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--gray-200)' }}>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    {request.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {request.documents.length > 0 && (
            <div className="detail-section">
              <p className="detail-section-title">Documents</p>
              <div className="doc-list">
                {request.documents.map(d => (
                  <div key={d.id} className="doc-item">
                    <span className="doc-item-name">{d.filename}</span>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${d.url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: 'var(--black)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      Download →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="detail-section">
            <p className="detail-section-title">History</p>
            {request.history.length === 0 ? (
              <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.85rem', color: 'var(--gray-400)' }}>No updates yet.</p>
            ) : (
              <div className="historial-list">
                {request.history.map((h, i) => (
                  <div key={i} className="historial-item">
                    <span className="historial-date">{formatDate(h.date)}</span>
                    <div>
                      <p className="historial-estados">
                        {h.previous_status
                          ? <>{h.previous_status.replace('_', ' ')}<span className="historial-arrow">→</span>{h.new_status.replace('_', ' ')}</>
                          : h.new_status.replace('_', ' ')
                        }
                      </p>
                      {h.comment && <p className="historial-comment">{h.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="ticket-hero">
            <p className="ticket-hero-label">Ticket number</p>
            <p className="ticket-hero-code">{request.ticket}</p>
          </div>
          <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.78rem', color: 'var(--gray-400)', lineHeight: 1.6 }}>
            Keep this number to track your request at the records office.
          </p>
        </div>
      </div>
    </AppShell>
  )
}
