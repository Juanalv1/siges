import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import './estudiante.css'

export default function NuevaSolicitud() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [requestTypes, setRequestTypes] = useState([])
  const [selectedType, setSelectedType] = useState(null)
  const [description, setDescription] = useState('')
  const [uploadedDocs, setUploadedDocs] = useState({})
  const [documentIds, setDocumentIds] = useState([])
  const [uploading, setUploading] = useState({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    client.get('/request-types').then(r => {
      setRequestTypes(r.data.filter(t => t.requires_account))
    })
  }, [])

  async function uploadDoc(docName, file) {
    setUploading(u => ({ ...u, [docName]: true }))
    try {
      const fd = new FormData()
      fd.append('archivo', file)
      const { data } = await client.post('/documents/upload', fd)
      setUploadedDocs(d => ({ ...d, [docName]: file.name }))
      setDocumentIds(ids => [...ids.filter(id => id !== data.id), data.id])
    } catch {
      setError('Failed to upload file')
    } finally {
      setUploading(u => ({ ...u, [docName]: false }))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const required = selectedType?.required_docs || []
    if (required.some(d => !uploadedDocs[d])) {
      setError('You must upload all required documents')
      return
    }
    setLoading(true)
    try {
      const { data } = await client.post('/requests', {
        request_type_id: selectedType.id,
        description,
        document_ids: documentIds,
      })
      navigate(`/requests/${data.ticket}`, { state: { isNew: true, ticket: data.ticket } })
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit request')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <h1 className="page-title">New request</h1>
          <p className="page-subtitle">
            {step === 1 ? 'Step 1 — Request type' : `Step 2 — ${selectedType?.name}`}
          </p>
        </div>
        <Link to="/requests" className="btn-ghost">← Cancel</Link>
      </div>

      {error && <div className="global-error">{error}</div>}

      {step === 1 && (
        <>
          <div className="tramite-cards">
            {requestTypes.map(t => (
              <div
                key={t.id}
                className={`tramite-card${selectedType?.id === t.id ? ' selected' : ''}`}
                onClick={() => setSelectedType(t)}
              >
                <p className="tramite-card-name">{t.name}</p>
                <p className="tramite-card-desc">{t.description}</p>
              </div>
            ))}
          </div>
          <div className="btn-row">
            <button className="btn-primary" disabled={!selectedType} onClick={() => setStep(2)}>
              Continue →
            </button>
          </div>
        </>
      )}

      {step === 2 && selectedType && (
        <form onSubmit={handleSubmit} style={{ maxWidth: 560 }}>
          <div className="form-field">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              placeholder="Briefly describe your situation..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          {selectedType.required_docs.length > 0 && (
            <div className="form-field">
              <label className="form-label">Required documents</label>
              <div className="doc-list">
                {selectedType.required_docs.map(docName => (
                  <div key={docName}>
                    {uploadedDocs[docName] ? (
                      <div className="doc-item">
                        <span className="doc-item-name">{uploadedDocs[docName]}</span>
                        <span className="doc-item-ok">✓ {docName}</span>
                      </div>
                    ) : (
                      <label className="doc-upload-label">
                        {uploading[docName] ? 'Uploading...' : `↑ ${docName}`}
                        <input
                          type="file"
                          onChange={e => e.target.files[0] && uploadDoc(docName, e.target.files[0])}
                          disabled={uploading[docName]}
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
              {loading ? 'Submitting...' : 'Submit request →'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setStep(1)}>
              ← Back
            </button>
          </div>
        </form>
      )}
    </AppShell>
  )
}
