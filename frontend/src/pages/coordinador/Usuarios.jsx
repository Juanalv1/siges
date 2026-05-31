import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)

  function load() {
    setLoading(true)
    client.get('/coordinador/usuarios')
      .then(r => setUsuarios(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function handleToggle(u) {
    setToggling(u.id)
    try {
      await client.post(`/coordinador/usuarios/${u.id}/toggle-activo`)
      load()
    } finally {
      setToggling(null)
    }
  }

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Operadores</h1>
          <p className="page-subtitle">Gestión de usuarios del sistema</p>
        </div>
      </div>

      {loading ? <p className="loading-msg">Cargando...</p> : (
        <div className="usuarios-list">
          {usuarios.length === 0 && (
            <div className="empty-state">
              <p className="empty-state-title">Sin operadores</p>
              <p className="empty-state-sub">No hay operadores o coordinadores registrados.</p>
            </div>
          )}
          {usuarios.map(u => (
            <div key={u.id} className="usuario-row" style={{ opacity: u.activo ? 1 : 0.55 }}>
              <div>
                <p className="usuario-nombre">{u.nombre} {u.apellido}</p>
                <p className="usuario-meta">{u.correo} · {u.rol}</p>
              </div>
              <span className={`badge badge-${u.activo ? 'aprobada' : 'rechazada'}`}>
                {u.activo ? 'Activo' : 'Inactivo'}
              </span>
              <button
                className={`toggle-activo${u.activo ? '' : ' inactivo'}`}
                disabled={toggling === u.id}
                onClick={() => handleToggle(u)}
              >
                {toggling === u.id ? '...' : u.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </CoordShell>
  )
}
