import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

function ResolveModal({ ticket, onConfirm, onCancel, loading }) {
  const [action, setAction] = useState('approve')
  const [comment, setComment] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-title">Resolve — {ticket}</p>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          {['approve', 'reject'].map(a => (
            <button
              key={a}
              type="button"
              style={{
                flex: 1, padding: '0.6rem',
                fontFamily: 'DM Mono, monospace', fontSize: '0.65rem', letterSpacing: '0.12em',
                textTransform: 'uppercase', cursor: 'pointer', border: '1.5px solid',
                borderColor: action === a ? (a === 'approve' ? 'var(--black)' : 'var(--red)') : 'var(--gray-200)',
                background: action === a ? (a === 'approve' ? 'var(--black)' : 'var(--red)') : 'transparent',
                color: action === a ? 'var(--white)' : 'var(--gray-400)',
              }}
              onClick={() => setAction(a)}
            >
              {a === 'approve' ? 'Approve' : 'Reject'}
            </button>
          ))}
        </div>
        <textarea
          className="modal-textarea"
          placeholder="Comment / reason (required)..."
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
        <div className="modal-btn-row">
          <button
            className="modal-confirm"
            onClick={() => onConfirm(action, comment)}
            disabled={loading || !comment.trim()}
            style={{ background: action === 'approve' ? 'var(--black)' : 'var(--red)' }}
          >
            {loading ? 'Processing...' : 'Confirm'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function SolicitudesEscaladas() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  function loadRequests() {
    setLoading(true)
    client.get('/coordinator/escalated-requests')
      .then(r => setRequests(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadRequests() }, [])

  async function resolve(id, action, comment) {
    setActionLoading(true)
    try {
      await client.post(`/coordinator/requests/${id}/resolve`, { action, comment })
      setModal(null)
      loadRequests()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resolve')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <CoordShell>
      {modal && (
        <ResolveModal
          ticket={modal.ticket}
          loading={actionLoading}
          onCancel={() => setModal(null)}
          onConfirm={(action, comment) => resolve(modal.id, action, comment)}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Escalated</h1>
          <p className="page-subtitle">Requests pending resolution</p>
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: requests.length > 0 ? 'var(--red)' : 'var(--gray-400)' }}>
          {requests.length} pending
        </span>
      </div>

      {error && <div className="global-error">{error}</div>}

      {loading ? <p className="loading-msg">Loading...</p> : requests.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No escalated requests</p>
          <p className="empty-state-sub">No requests pending review.</p>
        </div>
      ) : (
        <table className="solicitudes-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Type</th>
              <th>Applicant</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id}>
                <td><span className="ticket-code">{req.ticket}</span></td>
                <td>{req.request_type}</td>
                <td>{req.user}</td>
                <td><span className="table-date">{new Date(req.updated_at).toLocaleDateString('es-VE')}</span></td>
                <td>
                  <button
                    className="btn-primary"
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.6rem' }}
                    onClick={() => setModal({ id: req.id, ticket: req.ticket })}
                  >
                    Resolve →
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
