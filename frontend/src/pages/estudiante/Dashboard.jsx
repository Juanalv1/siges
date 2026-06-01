import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Dashboard() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    client.get('/requests/my-requests')
      .then(r => setRequests(r.data))
      .catch(() => setError('Could not load requests'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">My requests</h1>
          <p className="page-subtitle">Records office · Student services</p>
        </div>
        <Link to="/requests/new" className="btn-primary">+ New request</Link>
      </div>

      {error && <div className="global-error">{error}</div>}
      {loading && <p className="loading-msg">Loading...</p>}

      {!loading && requests.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No requests</p>
          <p className="empty-state-sub">You have not submitted any requests yet.</p>
          <Link to="/requests/new" className="btn-primary">Create first request</Link>
        </div>
      )}

      {!loading && requests.length > 0 && (
        <table className="solicitudes-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Type</th>
              <th>Status</th>
              <th>Date</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {requests.map(req => (
              <tr key={req.id}>
                <td><span className="ticket-code">{req.ticket}</span></td>
                <td>{req.request_type.name}</td>
                <td><StatusBadge status={req.status} /></td>
                <td><span className="table-date">{formatDate(req.created_at)}</span></td>
                <td>
                  <Link to={`/requests/${req.ticket}`} className="table-link">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppShell>
  )
}
