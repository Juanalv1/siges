import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import AuthShell from './AuthShell'

const ROLE_REDIRECT = {
  student: '/requests',
  operator: '/operator',
  coordinator: '/coordinator',
}

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await client.post('/auth/login', form)
      login(data.access_token)
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      navigate(ROLE_REDIRECT[payload.role] || '/requests')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Sign in</h1>
      <p className="auth-form-subheading">Access with your institutional email.</p>

      {error && <div className="auth-global-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input
            className="auth-input"
            type="email"
            placeholder="user@email.com"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Password</label>
          <input
            className="auth-input"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            required
          />
        </div>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Sign in →'}
        </button>
      </form>

      <div className="auth-links">
        <Link className="auth-link" to="/recover">
          Forgot your password? <span className="auth-link-accent">Recover it</span>
        </Link>
        <Link className="auth-link" to="/register">
          No account? <span className="auth-link-accent">Register</span>
        </Link>
        <Link className="auth-link" to="/enrollment">
          Enrollment request <span className="auth-link-accent">without account</span>
        </Link>
      </div>
    </AuthShell>
  )
}
