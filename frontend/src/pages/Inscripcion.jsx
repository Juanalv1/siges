import { useState } from 'react'
import client from '../api/client'
import '../pages/auth/auth.css'
import AuthShell from './auth/AuthShell'

const REQUIRED_DOCS = ['Certified grades', 'High school diploma', 'ID copy']

export default function Inscripcion() {
  const [nationalId, setNationalId] = useState('')
  const [files, setFiles] = useState({})
  const [ticket, setTicket] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!nationalId.trim()) { setError('Enter your national ID'); return }
    if (REQUIRED_DOCS.some(d => !files[d])) {
      setError('You must upload all 3 required documents')
      return
    }
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('national_id', nationalId)
      REQUIRED_DOCS.forEach(d => fd.append('archivos', files[d]))
      const { data } = await client.post('/requests/enrollment', fd)
      setTicket(data.ticket)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  if (ticket) {
    return (
      <AuthShell>
        <h1 className="auth-form-heading">Request submitted</h1>
        <p className="auth-form-subheading">Your enrollment request was received.</p>
        <div className="auth-success-msg">
          <strong>Ticket:</strong> {ticket}<br />
          You will receive a notification once your request is processed by the office.
        </div>
        <a href="/login" className="auth-btn" style={{ display: 'block', textAlign: 'center' }}>
          Go to sign in →
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Enrollment</h1>
      <p className="auth-form-subheading">Submit your request without an account.</p>

      {error && <div className="auth-global-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">National ID</label>
          <input
            className="auth-input"
            type="text"
            placeholder="V-00000000"
            value={nationalId}
            onChange={e => setNationalId(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" style={{ marginBottom: '0.75rem', display: 'block' }}>
            Required documents
          </label>
          {REQUIRED_DOCS.map(doc => (
            <div key={doc} style={{ marginBottom: '0.6rem' }}>
              {files[doc] ? (
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '0.6rem 0.9rem', background: 'var(--gray-100)', border: '1px solid var(--gray-200)'
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.72rem' }}>{files[doc].name}</span>
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
                    onChange={e => e.target.files[0] && setFiles(f => ({ ...f, [doc]: e.target.files[0] }))}
                  />
                </label>
              )}
            </div>
          ))}
        </div>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit request →'}
        </button>
      </form>

      <div className="auth-links">
        <a href="/login" className="auth-link">← Already have an account</a>
      </div>
    </AuthShell>
  )
}
