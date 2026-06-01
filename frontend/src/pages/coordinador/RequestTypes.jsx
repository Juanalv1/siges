import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

const EMPTY_FORM = { name: '', description: '', required_docs: [], deadline_days: '', active: true, requires_account: true }

export default function TiposTramite() {
  const [requestTypes, setRequestTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [newDoc, setNewDoc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function loadTypes() {
    setLoading(true)
    client.get('/coordinator/request-types')
      .then(r => setRequestTypes(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadTypes() }, [])

  function openNewForm() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setNewDoc('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(t) {
    setForm({
      name: t.name,
      description: t.description || '',
      required_docs: [...t.required_docs],
      deadline_days: t.deadline_days || '',
      active: t.active,
      requires_account: t.requires_account,
    })
    setEditId(t.id)
    setNewDoc('')
    setError('')
    setShowForm(true)
  }

  function addDoc() {
    if (!newDoc.trim()) return
    setForm(f => ({ ...f, required_docs: [...f.required_docs, newDoc.trim()] }))
    setNewDoc('')
  }

  function removeDoc(i) {
    setForm(f => ({ ...f, required_docs: f.required_docs.filter((_, idx) => idx !== i) }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, deadline_days: form.deadline_days ? Number(form.deadline_days) : null }
      if (editId) {
        await client.put(`/coordinator/request-types/${editId}`, payload)
      } else {
        await client.post('/coordinator/request-types', payload)
      }
      setShowForm(false)
      loadTypes()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(t) {
    await client.put(`/coordinator/request-types/${t.id}`, { active: !t.active })
    loadTypes()
  }

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Request types</h1>
          <p className="page-subtitle">Available procedure configuration</p>
        </div>
        <button className="btn-primary" onClick={openNewForm}>+ New type</button>
      </div>

      {showForm && (
        <form className="tipo-form" onSubmit={handleSave}>
          <p className="tipo-form-title">{editId ? 'Edit type' : 'New request type'}</p>
          {error && <div className="global-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="form-field">
            <label className="form-label">Name</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="form-field">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="form-label">Deadline (days)</label>
            <input className="form-input" type="number" min="1" value={form.deadline_days} onChange={e => setForm(f => ({ ...f, deadline_days: e.target.value }))} placeholder="No limit" />
          </div>

          <div className="form-field">
            <label className="form-label">Required documents</label>
            <div className="doc-tags">
              {form.required_docs.map((d, i) => (
                <span key={i} className="doc-tag">
                  {d}
                  <button type="button" className="doc-tag-remove" onClick={() => removeDoc(i)}>×</button>
                </span>
              ))}
            </div>
            <div className="doc-add-row">
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Document name..."
                value={newDoc}
                onChange={e => setNewDoc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDoc())}
              />
              <button type="button" className="btn-ghost" onClick={addDoc}>+ Add</button>
            </div>
          </div>

          <div className="form-field" style={{ display: 'flex', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} />
              Active
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.requires_account} onChange={e => setForm(f => ({ ...f, requires_account: e.target.checked }))} />
              Requires account
            </label>
          </div>

          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save →'}</button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? <p className="loading-msg">Loading...</p> : (
        <div className="tramite-list">
          {requestTypes.map(t => (
            <div key={t.id} className="tramite-row">
              <div>
                <p className="tramite-row-name" style={{ color: t.active ? 'var(--black)' : 'var(--gray-400)' }}>
                  {t.name}
                  {!t.active && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em', marginLeft: '0.5rem', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Inactive</span>}
                </p>
                <p className="tramite-row-docs">
                  {t.required_docs.length > 0 ? t.required_docs.join(' · ') : 'No required documents'}
                  {!t.requires_account && ' · No account required'}
                </p>
              </div>
              <button className="btn-edit" onClick={() => openEditForm(t)}>Edit</button>
              <button className={`toggle-activo${t.active ? '' : ' inactivo'}`} onClick={() => toggleActive(t)}>
                {t.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          ))}
        </div>
      )}
    </CoordShell>
  )
}
