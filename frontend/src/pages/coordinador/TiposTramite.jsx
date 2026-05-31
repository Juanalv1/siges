import { useEffect, useState } from 'react'
import client from '../../api/client'
import CoordShell from './CoordShell'
import '../estudiante/estudiante.css'

const EMPTY_FORM = { nombre: '', descripcion: '', docs_requeridos: [], dias_limite: '', activo: true, requiere_cuenta: true }

export default function TiposTramite() {
  const [tipos, setTipos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [nuevoDoc, setNuevoDoc] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function load() {
    setLoading(true)
    client.get('/coordinador/tipos-tramite')
      .then(r => setTipos(r.data))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function abrirFormNuevo() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setNuevoDoc('')
    setError('')
    setShowForm(true)
  }

  function abrirFormEditar(t) {
    setForm({
      nombre: t.nombre,
      descripcion: t.descripcion || '',
      docs_requeridos: [...t.docs_requeridos],
      dias_limite: t.dias_limite || '',
      activo: t.activo,
      requiere_cuenta: t.requiere_cuenta,
    })
    setEditId(t.id)
    setNuevoDoc('')
    setError('')
    setShowForm(true)
  }

  function agregarDoc() {
    if (!nuevoDoc.trim()) return
    setForm(f => ({ ...f, docs_requeridos: [...f.docs_requeridos, nuevoDoc.trim()] }))
    setNuevoDoc('')
  }

  function quitarDoc(i) {
    setForm(f => ({ ...f, docs_requeridos: f.docs_requeridos.filter((_, idx) => idx !== i) }))
  }

  async function handleGuardar(e) {
    e.preventDefault()
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        dias_limite: form.dias_limite ? Number(form.dias_limite) : null,
      }
      if (editId) {
        await client.put(`/coordinador/tipos-tramite/${editId}`, payload)
      } else {
        await client.post('/coordinador/tipos-tramite', payload)
      }
      setShowForm(false)
      load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActivo(t) {
    await client.put(`/coordinador/tipos-tramite/${t.id}`, { activo: !t.activo })
    load()
  }

  return (
    <CoordShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Tipos de trámite</h1>
          <p className="page-subtitle">Configuración de trámites disponibles</p>
        </div>
        <button className="btn-primary" onClick={abrirFormNuevo}>+ Nuevo tipo</button>
      </div>

      {showForm && (
        <form className="tipo-form" onSubmit={handleGuardar}>
          <p className="tipo-form-title">{editId ? 'Editar trámite' : 'Nuevo tipo de trámite'}</p>
          {error && <div className="global-error" style={{ marginBottom: '1rem' }}>{error}</div>}

          <div className="form-field">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required />
          </div>
          <div className="form-field">
            <label className="form-label">Descripción</label>
            <input className="form-input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
          </div>
          <div className="form-field">
            <label className="form-label">Días límite</label>
            <input className="form-input" type="number" min="1" value={form.dias_limite} onChange={e => setForm(f => ({ ...f, dias_limite: e.target.value }))} placeholder="Sin límite" />
          </div>

          <div className="form-field">
            <label className="form-label">Documentos requeridos</label>
            <div className="doc-tags">
              {form.docs_requeridos.map((d, i) => (
                <span key={i} className="doc-tag">
                  {d}
                  <button type="button" className="doc-tag-remove" onClick={() => quitarDoc(i)}>×</button>
                </span>
              ))}
            </div>
            <div className="doc-add-row">
              <input
                className="form-input"
                style={{ flex: 1 }}
                placeholder="Nombre del documento..."
                value={nuevoDoc}
                onChange={e => setNuevoDoc(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregarDoc())}
              />
              <button type="button" className="btn-ghost" onClick={agregarDoc}>+ Agregar</button>
            </div>
          </div>

          <div className="form-field" style={{ display: 'flex', gap: '1.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
              Activo
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'DM Mono, monospace', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.1em', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.requiere_cuenta} onChange={e => setForm(f => ({ ...f, requiere_cuenta: e.target.checked }))} />
              Requiere cuenta
            </label>
          </div>

          <div className="btn-row">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar →'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </form>
      )}

      {loading ? <p className="loading-msg">Cargando...</p> : (
        <div className="tramite-list">
          {tipos.map(t => (
            <div key={t.id} className="tramite-row">
              <div>
                <p className="tramite-row-name" style={{ color: t.activo ? 'var(--black)' : 'var(--gray-400)' }}>
                  {t.nombre}
                  {!t.activo && <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.58rem', letterSpacing: '0.1em', marginLeft: '0.5rem', color: 'var(--gray-400)', textTransform: 'uppercase' }}>Inactivo</span>}
                </p>
                <p className="tramite-row-docs">
                  {t.docs_requeridos.length > 0 ? t.docs_requeridos.join(' · ') : 'Sin documentos requeridos'}
                  {!t.requiere_cuenta && ' · Sin cuenta'}
                </p>
              </div>
              <button className="btn-edit" onClick={() => abrirFormEditar(t)}>Editar</button>
              <button className={`toggle-activo${t.activo ? '' : ' inactivo'}`} onClick={() => toggleActivo(t)}>
                {t.activo ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </CoordShell>
  )
}
