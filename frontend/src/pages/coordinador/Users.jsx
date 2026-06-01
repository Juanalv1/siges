import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

export default function Usuarios() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  function loadUsers() {
    setLoading(true)
    client.get('/coordinator/users')
      .then(r => setUsers(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [])

  async function handleToggleActive(u) {
    setToggling(u.id)
    try {
      await client.post(`/coordinator/users/${u.id}/toggle-active`)
      loadUsers()
    } finally {
      setToggling(null)
    }
  }

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operators</h1>
          <p className="page-subtitle">System user management</p>
        </div>
      </div>

      {loading ? <p className="loading-msg">Loading...</p> : (
        <div className="usuarios-list">
          {users.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">No operators</p>
              <p className="empty-state-sub">No operators or coordinators registered.</p>
            </div>
          )}
          {users.map(u => (
            <div key={u.id} className="usuario-row" style={{ opacity: u.active ? 1 : 0.55 }}>
              <div>
                <p className="usuario-nombre">{u.first_name} {u.last_name}</p>
                <p className="usuario-meta">{u.email} · {u.role}</p>
              </div>
              <span className={`badge badge-${u.active ? 'approved' : 'rejected'}`}>
                {u.active ? 'Active' : 'Inactive'}
              </span>
              <button
                className={`toggle-activo${u.active ? '' : ' inactivo'}`}
                disabled={toggling === u.id}
                onClick={() => handleToggleActive(u)}
              >
                {toggling === u.id ? '...' : u.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </CoordShell>
  )
}
