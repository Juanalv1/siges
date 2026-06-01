import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import '../estudiante/estudiante.css'
import './operador.css'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function timeElapsed(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const hrs = Math.floor(diff / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hrs >= 24) return { text: `${Math.floor(hrs / 24)}d`, urgent: true }
  if (hrs > 0) return { text: `${hrs}h ${mins}m`, urgent: hrs >= 8 }
  return { text: `${mins}m`, urgent: false }
}

export default function Bandeja() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ status: '', request_type_id: '' })
  const [requestTypes, setRequestTypes] = useState([])

  useEffect(() => {
    client.get('/request-types').then(r => setRequestTypes(r.data))
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.status) params.set('status', filters.status)
    if (filters.request_type_id) params.set('request_type_id', filters.request_type_id)
    setLoading(true)
    client.get(`/operator/inbox?${params}`)
      .then(r => setRequests(r.data))
      .finally(() => setLoading(false))
  }, [filters])

  async function handleOpen(req) {
    try {
      await client.post(`/operator/requests/${req.id}/open`)
      navigate(`/operator/requests/${req.id}`)
    } catch (err) {
      if (err.response?.status === 409) navigate(`/operator/requests/${req.id}`)
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Inbox</h1>
          <p className="page-subtitle">Pending and in-progress requests</p>
        </div>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem', color: 'var(--gray-400)' }}>
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="filtros-bar">
        <div className="filtro-group">
          <span className="filtro-label">Status</span>
          <select
            className="filtro-select"
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>
        <div className="filtro-group">
          <span className="filtro-label">Request type</span>
          <select
            className="filtro-select"
            value={filters.request_type_id}
            onChange={e => setFilters(f => ({ ...f, request_type_id: e.target.value }))}
          >
            <option value="">All</option>
            {requestTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <p className="loading-msg">Loading inbox...</p>}

      {!loading && requests.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">Inbox empty</p>
          <p className="empty-state-sub">No requests to handle at this time.</p>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <table className="bandeja-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Type</th>
              <th>Applicant</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => {
              const t = timeElapsed(req.created_at)
              return (
                <tr key={req.id} onClick={() => handleOpen(req)}>
                  <td><span className="ticket-code">{req.ticket}</span></td>
                  <td>{req.request_type}</td>
                  <td>{req.user}</td>
                  <td><StatusBadge status={req.status} /></td>
                  <td><span className={`tiempo-transcurrido${t.urgent ? ' tiempo-urgente' : ''}`}>{t.text}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </AppShell>
  )
}
