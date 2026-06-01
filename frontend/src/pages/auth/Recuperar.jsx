import { useState } from 'react'
<parameter name="content">import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AuthShell from './AuthShell'

export default function Recuperar() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [nationalId, setNationalId] = useState('')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [recoveryToken, setRecoveryToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleNationalId(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await client.post('/auth/recover/start', { national_id: nationalId })
      setQuestions(data.questions)
      setAnswers(data.questions.map(q => ({ question_id: q.question_id, answer: '' })))
      setStep(2)
    } catch (err) {
      setError(err.response?.data?.detail || 'National ID not found')
    } finally {
      setLoading(false)
    }
  }

  async function handleAnswers(e) {
    e.preventDefault()
    setError('')
    if (answers.some(a => !a.answer.trim())) {
      setError('Answer both questions')
      return
    }
    setLoading(true)
    try {
      const { data } = await client.post('/auth/recover/verify', {
        national_id: nationalId,
        answers,
      })
      setRecoveryToken(data.recovery_token)
      setStep(3)
    } catch (err) {
      setError(err.response?.data?.detail || 'Incorrect answers')
    } finally {
      setLoading(false)
    }
  }

  async function handleNewPassword(e) {
    e.preventDefault()
    setError('')
    if (newPassword.length < 8) { setError('Minimum 8 characters'); return }
    if (newPassword !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      await client.post(
        '/auth/recover/change-password',
        { new_password: newPassword },
        { headers: { Authorization: `Bearer ${recoveryToken}` } }
      )
      navigate('/login', { state: { success: 'Password updated. Sign in with your new password.' } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  const STEP_LABELS = ['Identity', 'Verification', 'New password']

  return (
    <AuthShell>
      <h1 className="auth-form-heading">Recover access</h1>
      <p className="auth-form-subheading">{STEP_LABELS[step - 1]}</p>

      <div className="auth-steps">
        {[1, 2, 3].map(s => (
          <div key={s} className={`auth-step-dot ${s < step ? 'done' : s === step ? 'active' : ''}`} />
        ))}
      </div>

      {error && <div className="auth-global-error">{error}</div>}

      {step === 1 && (
        <form onSubmit={handleNationalId}>
          <div className="auth-field">
            <label className="auth-label">National ID</label>
            <input
              className="auth-input"
              type="text"
              placeholder="V-00000000"
              value={nationalId}
              onChange={e => setNationalId(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Continue →'}
          </button>
          <Link className="auth-link" to="/login" style={{ marginTop: '1rem', display: 'block' }}>
            ← Back to sign in
          </Link>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleAnswers}>
          {questions.map((q, i) => (
            <div className="auth-field" key={q.question_id}>
              <label className="auth-label">{q.question}</label>
              <input
                className="auth-input"
                type="text"
                value={answers[i]?.answer || ''}
                onChange={e => {
                  const copy = [...answers]
                  copy[i] = { ...copy[i], answer: e.target.value }
                  setAnswers(copy)
                }}
              />
            </div>
          ))}
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify →'}
          </button>
          <button type="button" className="auth-btn-ghost" onClick={() => { setStep(1); setError('') }}>
            ← Back
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleNewPassword}>
          <div className="auth-field">
            <label className="auth-label">New password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Confirm password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save password →'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
