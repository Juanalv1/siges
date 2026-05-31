import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

export default function NuevaSolicitud() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [tipos, setTipos] = useState([])
  const [selectedTipo, setSelectedTipo] = useState(null)
  const [descripcion, setDescripcion] = useState('')
  const [docFiles, setDocFiles] = useState({})
  const [docIds, setDocIds] = useState([])
  const [uploading, setUploading] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/tipos-tramite').then(r => {
      setTipos(r.data.filter(t => t.requiere_cuenta))
    })
  }, [])

  async function handleSubirDoc(docNombre, file) {
    setUploading(u => ({ ...u, [docNombre]: true }))
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const { data } = await client.post('/documentos/subir', fd)
      setDocFiles(d => ({ ...d, [docNombre]: file.name }))
      setDocIds(ids => [...ids.filter(id => id !== data.id), data.id])
    } catch {
      setError('Error al subir archivo')
    } finally {
      setUploading(u => ({ ...u, [docNombre]: false }))
    }
  }

  async function handleEnviar(e) {
    e.preventDefault()
    setError('')
    const docsRequeridos = selectedTipo?.docs_requeridos || []
    if (docsRequeridos.some(d => !docFiles[d])) {
      setError('Debes subir todos los documentos requeridos')
      return
    }
    setLoading(true)
    try {
      const { data } = await client.post('/solicitudes', {
        tipo_tramite_id: selectedTipo.id,
        descripcion,
        documento_ids: docIds,
      })
      navigate(`/solicitudes/${data.ticket}`, { state: { nuevo: true, ticket: data.ticket } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al enviar solicitud')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nueva solicitud</h1>
          <p className="page-subtitle">
            {step === 1 ? 'Paso 1 — Tipo de trámite' : `Paso 2 — ${selectedTipo?.nombre}`}
          </p>
        </div>
        <Link to="/solicitudes" className="btn-ghost">← Cancelar</Link>
      </div>

      {error && <div className="global-error">{error}</div>}

      {step === 1 && (
        <>
          <div className="tramite-cards">
            {tipos.map(t => (
              <div
                key={t.id}
                className={`tramite-card${selectedTipo?.id === t.id ? ' selected' : ''}`}
                onClick={() => setSelectedTipo(t)}
              >
                <p className="tramite-card-name">{t.nombre}</p>
                <p className="tramite-card-desc">{t.descripcion}</p>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button
              className="btn-primary"
              disabled={!selectedTipo}
              onClick={() => setStep(2)}
            >
              Continuar →
            </button>
          </div>
        </>
      )}

      {step === 2 && selectedTipo && (
        <form onSubmit={handleEnviar} style={{ maxWidth: 560 }}>
          <div className="form-field">
            <label className="form-label">Descripción del problema</label>
            <textarea
              className="form-textarea"
              placeholder="Describe brevemente tu situación..."
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          {selectedTipo.docs_requeridos.length > 0 && (
            <div className="form-field">
              <label className="form-label">Documentos requeridos</label>
              <div className="doc-list">
                {selectedTipo.docs_requeridos.map(docNombre => (
                  <div key={docNombre}>
                    {docFiles[docNombre] ? (
                      <div className="doc-item">
                        <span className="doc-item-name">{docFiles[docNombre]}</span>
                        <span className="doc-item-ok">✓ {docNombre}</span>
                      </div>
                    ) : (
                      <label className="doc-upload-label">
                        {uploading[docNombre] ? 'Subiendo...' : `↑ ${docNombre}`}
                        <input
                          type="file"
                          onChange={e => e.target.files[0] && handleSubirDoc(docNombre, e.target.files[0])}
                          disabled={uploading[docNombre]}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="btn-row">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar solicitud →'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              ← Volver
            </button>
          </div>
        </form>
      )}
    </AppShell>
  )
}
