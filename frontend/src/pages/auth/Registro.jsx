import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AuthShell from './AuthShell'

const EMPTY_STEP1 = { cedula: '', nombre: '', apellido: '', correo: '', telefono: '', password: '', confirmar: '' }
const EMPTY_STEP2 = [{ pregunta_id: '', respuesta: '' }, { pregunta_id: '', respuesta: '' }]

export default function Registro() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_STEP1)
  const [preguntas, setPreguntas] = useState([])
  const [seguridad, setSeguridad] = useState(EMPTY_STEP2)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/auth/preguntas-seguridad').then(r => setPreguntas(r.data))
  }, [])

  function validateStep1() {
    const e = {}
    if (!form.cedula.trim()) e.cedula = 'Requerido'
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.correo.trim()) e.correo = 'Requerido'
    if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (form.password !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden'
    return e
  }

  function validateStep2() {
    const e = {}
    seguridad.forEach((s, i) => {
      if (!s.pregunta_id) e[`p${i}`] = 'Selecciona una pregunta'
      if (!s.respuesta.trim()) e[`r${i}`] = 'Requerido'
    })
    if (seguridad[0].pregunta_id && seguridad[0].pregunta_id === seguridad[1].pregunta_id) {
      e.p1 = 'Elige preguntas distintas'
    }
    return e
  }

  function nextStep(e) {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setStep(2)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validateStep2()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)
    setGlobalError('')
    try {
      await client.post('/auth/register', {
        cedula: form.cedula,
        nombre: form.nombre,
        apellido: form.apellido,
        correo: form.correo,
        telefono: form.telefono || undefined,
        password: form.password,
        preguntas: seguridad.map(s => ({ pregunta_id: Number(s.pregunta_id), respuesta: s.respuesta })),
      })
      navigate('/login', { state: { success: 'Cuenta creada. Ya puedes iniciar sesión.' } })
    } catch (err) {
      setGlobalError(err.response?.data?.detail || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="auth-field">
      <label className="auth-label">{label}</label>
      <input
        className={`auth-input${errors[key] ? ' error' : ''}`}
        type={type}
        placeholder={placeholder}
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      />
      {errors[key] && <p className="auth-input-error">{errors[key]}</p>}
    </div>
  )

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Crear cuenta</h1>
      <p className="auth-form-subheading">
        {step === 1 ? 'Datos personales.' : 'Preguntas de seguridad para recuperar tu cuenta.'}
      </p>

      <div className="auth-steps">
        <div className={`auth-step-dot ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`} />
        <div className={`auth-step-dot ${step >= 2 ? 'active' : ''}`} />
      </div>

      {globalError && <div className="auth-global-error">{globalError}</div>}

      {step === 1 && (
        <form onSubmit={nextStep}>
          {field('cedula', 'Cédula', 'text', 'V-00000000')}
          <div className="auth-field-row">
            {field('nombre', 'Nombre', 'text', 'Juan')}
            {field('apellido', 'Apellido', 'text', 'Pérez')}
          </div>
          {field('correo', 'Correo', 'email', 'correo@ejemplo.com')}
          {field('telefono', 'Teléfono (opcional)', 'tel', '0414-0000000')}
          {field('password', 'Contraseña', 'password', '••••••••')}
          {field('confirmar', 'Confirmar contraseña', 'password', '••••••••')}
          <button className="auth-btn" type="submit">Continuar →</button>
          <Link className="auth-link" to="/login" style={{ marginTop: '1rem', display: 'block' }}>
            ← Ya tengo cuenta
          </Link>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit}>
          {[0, 1].map(i => (
            <div key={i}>
              <div className="auth-field">
                <label className="auth-label">Pregunta {i + 1}</label>
                <select
                  className={`auth-input${errors[`p${i}`] ? ' error' : ''}`}
                  value={seguridad[i].pregunta_id}
                  onChange={e => {
                    const copy = [...seguridad]
                    copy[i] = { ...copy[i], pregunta_id: e.target.value }
                    setSeguridad(copy)
                  }}
                >
                  <option value="">Seleccionar...</option>
                  {preguntas.map(p => (
                    <option key={p.id} value={p.id}>{p.pregunta}</option>
                  ))}
                </select>
                {errors[`p${i}`] && <p className="auth-input-error">{errors[`p${i}`]}</p>}
              </div>
              <div className="auth-field">
                <label className="auth-label">Respuesta</label>
                <input
                  className={`auth-input${errors[`r${i}`] ? ' error' : ''}`}
                  type="text"
                  value={seguridad[i].respuesta}
                  onChange={e => {
                    const copy = [...seguridad]
                    copy[i] = { ...copy[i], respuesta: e.target.value }
                    setSeguridad(copy)
                  }}
                />
                {errors[`r${i}`] && <p className="auth-input-error">{errors[`r${i}`]}</p>}
              </div>
              {i === 0 && <hr className="auth-divider" />}
            </div>
          ))}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creando cuenta...' : 'Crear cuenta →'}
          </button>
          <button type="button" className="auth-btn-ghost" onClick={() => { setStep(1); setErrors({}) }}>
            ← Volver
          </button>
        </form>
      )}
    </AuthShell>
  )
}
