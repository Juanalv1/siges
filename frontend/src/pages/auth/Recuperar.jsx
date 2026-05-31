import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AuthShell from './AuthShell'

export default function Recuperar() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [cedula, setCedula] = useState('')
  const [preguntas, setPreguntas] = useState([])
  const [respuestas, setRespuestas] = useState([])
  const [recoveryToken, setRecoveryToken] = useState('')
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCedula(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await client.post('/auth/recuperar/iniciar', { cedula })
      setPreguntas(data.preguntas)
      setRespuestas(data.preguntas.map(p => ({ pregunta_id: p.pregunta_id, respuesta: '' })))
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'Cédula no encontrada')
    } finally {
      setLoading(false)
    }
  }

  async function handleRespuestas(e) {
    e.preventDefault()
    setError('')
    if (respuestas.some(r => !r.respuesta.trim())) {
      setError('Responde ambas preguntas')
      return
    }
    setLoading(true)
    try {
      const { data } = await client.post('/auth/recuperar/verificar', { cedula, respuestas })
      setRecoveryToken(data.recovery_token)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'Respuestas incorrectas')
    } finally {
      setLoading(false)
    }
  }

  async function handleNuevaPassword(e) {
    e.preventDefault()
    setError('')
    if (nuevaPassword.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (nuevaPassword !== confirmar) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    try {
      await client.post(
        '/auth/recuperar/cambiar-password',
        { nueva_password: nuevaPassword },
        { headers: { Authorization: `Bearer ${recoveryToken}` } }
      )
      navigate('/login', { state: { success: 'Contraseña actualizada. Ingresa con tu nueva contraseña.' } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al actualizar contraseña')
    } finally {
      setLoading(false)
    }
  }

  const STEP_LABELS = ['Identidad', 'Verificación', 'Nueva clave']

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Recuperar acceso</h1>
      <p className="auth-form-subheading">{STEP_LABELS[step - 1]}</p>

      <div className="auth-steps">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`auth-step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`}
          />
        ))}
      </div>

      {error && <div className="auth-global-error">{error}</div>}

      {step === 1 && (
        <form onSubmit={handleCedula}>
          <div className="auth-field">
            <label className="auth-label">Número de cédula</label>
            <input
              className="auth-input"
              type="text"
              placeholder="V-00000000"
              value={cedula}
              onChange={e => setCedula(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Buscando...' : 'Continuar →'}
          </button>
          <Link className="auth-link" to="/login" style={{ marginTop: '1rem', display: 'block' }}>
            ← Volver al inicio de sesión
          </Link>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleRespuestas}>
          {preguntas.map((p, i) => (
            <div className="auth-field" key={p.pregunta_id}>
              <label className="auth-label">{p.pregunta}</label>
              <input
                className="auth-input"
                type="text"
                value={respuestas[i]?.respuesta || ''}
                onChange={e => {
                  const copy = [...respuestas]
                  copy[i] = { ...copy[i], respuesta: e.target.value }
                  setRespuestas(copy)
                }}
              />
            </div>
          ))}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Verificando...' : 'Verificar →'}
          </button>
          <button type="button" className="auth-btn-ghost" onClick={() => { setStep(1); setError('') }}>
            ← Volver
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleNuevaPassword}>
          <div className="auth-field">
            <label className="auth-label">Nueva contraseña</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={nuevaPassword}
              onChange={e => setNuevaPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Confirmar contraseña</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Guardando...' : 'Guardar contraseña →'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
