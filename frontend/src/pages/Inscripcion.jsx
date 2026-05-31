import { useState } from 'react'
import client from '../api/client'
import '../pages/auth/auth.css'
import AuthShell from './auth/AuthShell'

const DOCS_REQUERIDOS = ['Notas certificadas', 'Título de bachiller', 'Copia de cédula']

export default function Inscripcion() {
  const [cedula, setCedula] = useState('')
  const [archivos, setArchivos] = useState({})
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!cedula.trim()) { setError('Ingresa tu cédula'); return }
    if (DOCS_REQUERIDOS.some(d => !archivos[d])) {
      setError('Debes subir los 3 documentos requeridos')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('cedula', cedula)
      DOCS_REQUERIDOS.forEach(d => fd.append('archivos', archivos[d]))
      const { data } = await client.post('/solicitudes/inscripcion', fd)
      setTicket(data.ticket)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar solicitud')
    } finally {
      setLoading(false)
    }
  }

  if (ticket) {
    return (
      <AuthShell>
        <h1 className="auth-form-heading">Solicitud enviada</h1>
        <p className="auth-form-subheading">Tu solicitud de inscripción fue recibida.</p>
        <div className="auth-success-msg">
          <strong>Ticket:</strong> {ticket}<br />
          Recibirás una notificación cuando tu solicitud sea atendida por la taquilla.
        </div>
        <a href="/login" className="auth-btn" style={{ display: 'block', textAlign: 'center' }}>
          Ir al inicio de sesión →
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Inscripción</h1>
      <p className="auth-form-subheading">Envía tu solicitud sin necesidad de cuenta.</p>

      {error && <div className="auth-global-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Número de cédula</label>
          <input
            className="auth-input"
            type="text"
            placeholder="V-00000000"
            value={cedula}
            onChange={e => setCedula(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
            Documentos requeridos
          </label>
          {DOCS_REQUERIDOS.map(doc => (
            <div key={doc} style={{ marginBottom: '0.6rem' }}>
              {archivos[doc] ? (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.9rem', background: 'var(--gray-100)', border: '1px solid var(--gray-200)'
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem' }}>{archivos[doc].name}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: '#1a7a1a' }}>✓ {doc}</span>
                </div>
              ) : (
                <label style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: '0.65rem',
                  letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--gray-600)',
                  border: '1.5px dashed var(--gray-200)', padding: '0.65rem 1rem',
                }}>
                  ↑ {doc}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={e => e.target.files[0] && setArchivos(a => ({ ...a, [doc]: e.target.files[0] }))}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Enviar solicitud →'}
        </button>
      </form>

      <div className="auth-links">
        <a href="/login" className="auth-link">← Ya tengo cuenta</a>
      </div>
    </AuthShell>
  )
}
