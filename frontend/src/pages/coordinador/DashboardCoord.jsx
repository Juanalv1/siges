import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

export default function DashboardCoord() {
  const [stats, setStats] = useState({ pending: 0, in_progress: 0, escalated: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      client.get('/operator/inbox?status=pending'),
      client.get('/operator/inbox?status=in_progress'),
      client.get('/coordinator/escalated-requests'),
    ]).then(([pend, inProg, esc]) => {
      setStats({ pending: pend.data.length, in_progress: inProg.data.length, escalated: esc.data.length })
    }).finally(() => setLoading(false))
  }, [])

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">Current system status</p>
        </div>
      </div>

      {loading ? <p className="loading-msg">Loading...</p> : (
        <div className="stats-grid">
          <div className="stat-card">
            <p className="stat-value">{stats.pending}</p>
            <p className="stat-label">Pending</p>
          </div>
          <div className="stat-card">
            <p className="stat-value">{stats.in_progress}</p>
            <p className="stat-label">In progress</p>
          </div>
          <div className="stat-card">
            <p className={`stat-value${stats.escalated > 0 ? ' red' : ''}`}>{stats.escalated}</p>
            <p className="stat-label">Escalated</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxWidth: 380 }}>
        <Link to="/coordinator/request-types" className="btn-primary">Manage request types →</Link>
        <Link to="/coordinator/escalated" className="btn-ghost">View escalated requests →</Link>
        <Link to="/coordinator/users" className="btn-ghost">Manage operators →</Link>
      </div>
    </CoordShell>
  )
}
