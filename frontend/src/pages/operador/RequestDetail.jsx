import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import '../estudiante/estudiante.css'
import './operador.css'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function ActionModal({ title, onConfirm, onCancel, requireComment, loading }) {
  const [comment, setComment] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-title">{title}</p>
        <textarea
          className="modal-textarea"
          placeholder={requireComment ? 'Rejection reason (required)...' : 'Comment (optional)...'}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
        <div className="modal-btn-row">
          <button
            className="modal-confirm"
            onClick={() => onConfirm(comment)}
            disabled={loading || (requireComment && !comment.trim())}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function InternalBadge() {
  return <span className="interno-badge">Internal</span>
}

export default function DetalleSolicitudOp() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const released = useRef(false)

  useEffect(() => {
    client.get(`/operator/requests/${id}`)
      .then(r => setRequest(r.data))
      .catch(() => setError('Request not found'))
      .finally(() => setLoading(false))

    return () => {
      if (!released.current) {
        client.post(`/operator/requests/${id}/release`).catch(() => {})
      }
    }
  }, [id])

  async function executeAction(action, comment, isInternal = false) {
    setActionLoading(true)
    try {
      await client.post(`/operator/requests/${id}/action`, {
        action,
        comment: comment || undefined,
        is_internal: isInternal,
      })
      released.current = true
      setModal(null)
      navigate('/operator')
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to process action')
      setModal(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function addInternalComment(comment) {
    setActionLoading(true)
    try {
      await client.post(`/operator/requests/${id}/action`, {
        action: 'comment',
        comment,
        is_internal: true,
      })
      const { data } = await client.get(`/operator/requests/${id}`)
      setRequest(data)
      setModal(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <AppShell><p className="loading-msg">Loading request...</p></AppShell>
  if (error && !request) return <AppShell><div className="global-error">{error}</div></AppShell>

  const isFinalized = ['approved', 'rejected', 'resolved'].includes(request.status)

  return (
    <AppShell>
      {modal && (
        <ActionModal
          title={modal.title}
          requireComment={modal.requireComment}
          loading={actionLoading}
          onCancel={() => setModal(null)}
          onConfirm={comment => {
            if (modal.action === 'comment') addInternalComment(comment)
            else executeAction(modal.action, comment)
          }}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{request.request_type.name}</h1>
          <p className="page-subtitle" style={{ fontFamily: 'DM Mono, monospace' }}>{request.ticket}</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/operator')}>← Inbox</button>
      </div>

      {error && <div className="global-error">{error}</div>}

      <div className="operador-detail-layout">
        <div>
          <div className="detail-section">
            <p className="detail-section-title">Request</p>
            <div className="detail-meta">
              <div className="detail-meta-row">
                <span className="detail-meta-key">Status</span>
                <StatusBadge status={request.status} />
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Applicant</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem' }}>
                  {request.user
                    ? `${request.user.first_name} ${request.user.last_name} — ${request.user.national_id}`
                    : request.applicant_national_id}
                </span>
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Received</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem' }}>{formatDate(request.created_at)}</span>
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
            <p className="detail-section-title">Full history</p>
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
                      {h.is_internal && <InternalBadge />}
                    </p>
                    {h.comment && <p className="historial-comment">{h.comment}</p>}
                    {h.operator && (
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>
                        {h.operator}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="acciones-panel">
          <p className="acciones-title">Actions</p>
          <button
            className="accion-btn accion-aprobar"
            disabled={isFinalized}
            onClick={() => setModal({ action: 'approve', title: 'Approve request', requireComment: false })}
          >
            ✓ Approve
          </button>
          <button
            className="accion-btn accion-rechazar"
            disabled={isFinalized}
            onClick={() => setModal({ action: 'reject', title: 'Reject request', requireComment: true })}
          >
            ✕ Reject
          </button>
          <button
            className="accion-btn accion-escalar"
            disabled={isFinalized}
            onClick={() => setModal({ action: 'escalate', title: 'Escalate to coordinator', requireComment: false })}
          >
            ↑ Escalate to coordinator
          </button>
          <div style={{ borderTop: '1px solid var(--gray-200)', margin: '0.75rem 0' }} />
          <button
            className="accion-btn accion-interno"
            onClick={() => setModal({ action: 'comment', title: 'Internal comment', requireComment: false })}
          >
            + Internal comment
          </button>
        </div>
      </div>
    </AppShell>
  )
}
