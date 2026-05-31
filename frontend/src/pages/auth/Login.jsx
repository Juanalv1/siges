import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import AuthShell from './AuthShell'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ correo: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const ROL_REDIRECT = {
    estudiante: '/solicitudes',
    operador: '/operador',
    coordinador: '/coordinador',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await client.post('/auth/login', form)
      login(data.access_token)
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      navigate(ROL_REDIRECT[payload.rol] || '/solicitudes')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Ingresar</h1>
      <p className="auth-form-subheading">Accede con tu correo institucional.</p>

      {error && <div className="auth-global-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label">Correo</label>
          <input
            className="auth-input"
            type="email"
            placeholder="usuario@correo.com"
            value={form.correo}
            onChange={e => setForm(f => ({ ...f, correo: e.target.value }))}
            required
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">Contraseña</label>
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
          {loading ? 'Verificando...' : 'Entrar →'}
        </button>
      </form>

      <div className="auth-links">
        <Link className="auth-link" to="/recuperar">
          ¿Olvidaste tu contraseña? <span className="auth-link-accent">Recupérala</span>
        </Link>
        <Link className="auth-link" to="/registro">
          ¿No tienes cuenta? <span className="auth-link-accent">Regístrate</span>
        </Link>
        <Link className="auth-link" to="/inscripcion">
          Solicitud de inscripción <span className="auth-link-accent">sin cuenta</span>
        </Link>
      </div>
    </AuthShell>
  )
}
