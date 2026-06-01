import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AuthShell from './AuthShell'

const EMPTY_STEP1 = {
  national_id: '', first_name: '', last_name: '',
  email: '', phone: '', password: '', confirm: '',
}
const EMPTY_ANSWERS = [
  { question_id: '', answer: '' },
  { question_id: '', answer: '' },
]

export default function Registro() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(EMPTY_STEP1)
  const [questions, setQuestions] = useState([])
  const [securityAnswers, setSecurityAnswers] = useState(EMPTY_ANSWERS)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/auth/security-questions').then(r => setQuestions(r.data))
  }, [])

  function validateStep1() {
    const e = {}
    if (!form.national_id.trim()) e.national_id = 'Required'
    if (!form.first_name.trim()) e.first_name = 'Required'
    if (!form.last_name.trim()) e.last_name = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (form.password.length < 8) e.password = 'Minimum 8 characters'
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match'
    return e
  }

  function validateStep2() {
    const e = {}
    securityAnswers.forEach((s, i) => {
      if (!s.question_id) e[`q${i}`] = 'Select a question'
      if (!s.answer.trim()) e[`a${i}`] = 'Required'
    })
    if (securityAnswers[0].question_id && securityAnswers[0].question_id === securityAnswers[1].question_id) {
      e.q1 = 'Choose different questions'
    }
    return e
  }

  function goToStep2(e) {
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
        national_id: form.national_id,
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
        security_questions: securityAnswers.map(s => ({
          question_id: Number(s.question_id),
          answer: s.answer,
        })),
      })
      navigate('/login', { state: { success: 'Account created. You can now sign in.' } })
    } catch (err) {
      setGlobalError(err.response?.data?.detail || 'Registration failed')
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
      <h1 className="auth-form-heading">Create account</h1>
      <p className="auth-form-subheading">
        {step === 1 ? 'Personal details.' : 'Security questions to recover your account.'}
      </p>

      <div className="auth-steps">
        <div className={`auth-step-dot ${step >= 1 ? (step > 1 ? 'done' : 'active') : ''}`} />
        <div className={`auth-step-dot ${step >= 2 ? 'active' : ''}`} />
      </div>

      {globalError && <div className="auth-global-error">{globalError}</div>}

      {step === 1 && (
        <form onSubmit={goToStep2}>
          {field('national_id', 'National ID', 'text', 'V-00000000')}
          <div className="auth-field-row">
            {field('first_name', 'First name', 'text', 'Juan')}
            {field('last_name', 'Last name', 'text', 'Pérez')}
          </div>
          {field('email', 'Email', 'email', 'user@email.com')}
          {field('phone', 'Phone (optional)', 'tel', '0414-0000000')}
          {field('password', 'Password', 'password', '••••••••')}
          {field('confirm', 'Confirm password', 'password', '••••••••')}
          <button className="auth-btn" type="submit">Continue →</button>
          <Link className="auth-link" to="/login" style={{ marginTop: '1rem', display: 'block' }}>
            ← Already have an account
          </Link>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleSubmit}>
          {[0, 1].map(i => (
            <div key={i}>
              <div className="auth-field">
                <label className="auth-label">Question {i + 1}</label>
                <select
                  className={`auth-input${errors[`q${i}`] ? ' error' : ''}`}
                  value={securityAnswers[i].question_id}
                  onChange={e => {
                    const copy = [...securityAnswers]
                    copy[i] = { ...copy[i], question_id: e.target.value }
                    setSecurityAnswers(copy)
                  }}
                >
                  <option value="">Select...</option>
                  {questions.map(q => (
                    <option key={q.id} value={q.id}>{q.question}</option>
                  ))}
                </select>
                {errors[`q${i}`] && <p className="auth-input-error">{errors[`q${i}`]}</p>}
              </div>
              <div className="auth-field">
                <label className="auth-label">Answer</label>
                <input
                  className={`auth-input${errors[`a${i}`] ? ' error' : ''}`}
                  type="text"
                  value={securityAnswers[i].answer}
                  onChange={e => {
                    const copy = [...securityAnswers]
                    copy[i] = { ...copy[i], answer: e.target.value }
                    setSecurityAnswers(copy)
                  }}
                />
                {errors[`a${i}`] && <p className="auth-input-error">{errors[`a${i}`]}</p>}
              </div>
              {i === 0 && <hr className="auth-divider" />}
            </div>
          ))}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account →'}
          </button>
          <button type="button" className="auth-btn-ghost" onClick={() => { setStep(1); setErrors({}) }}>
            ← Back
          </button>
        </form>
      )}
    </AuthShell>
  )
}
