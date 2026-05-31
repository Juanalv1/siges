import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../../api/client'
import AppShell from '../../components/AppShell'
import '../estudiante/estudiante.css'
import './operador.css'

function EstadoBadge({ estado }) {
  return <span className={`badge badge-${estado}`}>{estado.replace('_', ' ')}</span>
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-VE', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  })
}

function Modal({ title, onConfirm, onCancel, requireComment, loading }) {
  const [comentario, setComentario] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box">
        <p className="modal-title">{title}</p>
        <textarea
          className="modal-textarea"
          placeholder={requireComment ? 'Motivo de rechazo (requerido)...' : 'Comentario (opcional)...'}
          value={comentario}
          onChange={e => setComentario(e.target.value)}
        />
        <div className="modal-btn-row">
          <button
            className="modal-confirm"
            onClick={() => onConfirm(comentario)}
            disabled={loading || (requireComment && !comentario.trim())}
          >
            {loading ? 'Procesando...' : 'Confirmar'}
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

function InternoBadge() {
  return <span className="interno-badge">Interno</span>
}

export default function DetalleSolicitudOp() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [solicitud, setSolicitud] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null) // { accion, title, requireComment }
  const [actionLoading, setActionLoading] = useState(false)
  const liberado = useRef(false)

  useEffect(() => {
    client.get(`/operador/solicitudes/${id}`)
      .then(r => setSolicitud(r.data))
      .catch(() => setError('Solicitud no encontrada'))
      .finally(() => setLoading(false))

    return () => {
      if (!liberado.current) {
        client.post(`/operador/solicitudes/${id}/liberar`).catch(() => {})
      }
    }
  }, [id])

  async function ejecutarAccion(accion, comentario, esInterno = false) {
    setActionLoading(true)
    try {
      await client.post(`/operador/solicitudes/${id}/accion`, {
        accion,
        comentario: comentario || undefined,
        es_interno: esInterno,
      })
      liberado.current = true
      setModal(null)
      navigate('/operador')
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al procesar acción')
      setModal(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function agregarComentarioInterno(comentario) {
    setActionLoading(true)
    try {
      await client.post(`/operador/solicitudes/${id}/accion`, {
        accion: 'comentario',
        comentario,
        es_interno: true,
      })
      const { data } = await client.get(`/operador/solicitudes/${id}`)
      setSolicitud(data)
      setModal(null)
    } catch (err) {
      setError(err.response?.data?.detail || 'Error')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <AppShell><p className="loading-msg">Cargando solicitud...</p></AppShell>
  if (error && !solicitud) return <AppShell><div className="global-error">{error}</div></AppShell>

  const finalizada = ['aprobada', 'rechazada', 'resuelta'].includes(solicitud.estado)

  return (
    <AppShell>
      {modal && (
        <Modal
          title={modal.title}
          requireComment={modal.requireComment}
          loading={actionLoading}
          onCancel={() => setModal(null)}
          onConfirm={comentario => {
            if (modal.accion === 'comentario') agregarComentarioInterno(comentario)
            else ejecutarAccion(modal.accion, comentario)
          }}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">{solicitud.tipo_tramite.nombre}</h1>
          <p className="page-subtitle" style={{ fontFamily: 'DM Mono, monospace' }}>{solicitud.ticket}</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/operador')}>← Bandeja</button>
      </div>

      {error && <div className="global-error">{error}</div>}

      <div className="operador-detail-layout">
        <div>
          {/* Info */}
          <div className="detail-section">
            <p className="detail-section-title">Solicitud</p>
            <div className="detail-meta">
              <div className="detail-meta-row">
                <span className="detail-meta-key">Estado</span>
                <EstadoBadge estado={solicitud.estado} />
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Solicitante</span>
                <span style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem' }}>
                  {solicitud.usuario
                    ? `${solicitud.usuario.nombre} ${solicitud.usuario.apellido} — ${solicitud.usuario.cedula}`
                    : solicitud.cedula_solicitante}
                </span>
              </div>
              <div className="detail-meta-row">
                <span className="detail-meta-key">Recibida</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.75rem' }}>{formatFecha(solicitud.created_at)}</span>
              </div>
              {solicitud.descripcion && (
                <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--gray-200)' }}>
                  <p style={{ fontFamily: 'DM Sans, sans-serif', fontSize: '0.88rem', color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    {solicitud.descripcion}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Documentos */}
          {solicitud.documentos.length > 0 && (
            <div className="detail-section">
              <p className="detail-section-title">Documentos</p>
              <div className="doc-list">
                {solicitud.documentos.map(d => (
                  <div key={d.id} className="doc-item">
                    <span className="doc-item-name">{d.nombre_archivo}</span>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${d.url}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.62rem', color: 'var(--black)', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                    >
                      Descargar →
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial completo */}
          <div className="detail-section">
            <p className="detail-section-title">Historial completo</p>
            <div className="historial-list">
              {solicitud.historial.map((h, i) => (
                <div key={i} className="historial-item">
                  <span className="historial-date">{formatFecha(h.fecha)}</span>
                  <div className="historial-body">
                    <p className="historial-estados">
                      {h.estado_anterior
                        ? <>{h.estado_anterior.replace('_', ' ')}<span className="historial-arrow">→</span>{h.estado_nuevo.replace('_', ' ')}</>
                        : h.estado_nuevo.replace('_', ' ')
                      }
                      {h.es_interno && <InternoBadge />}
                    </p>
                    {h.comentario && <p className="historial-comment">{h.comentario}</p>}
                    {h.operador && (
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', color: 'var(--gray-400)', marginTop: '0.2rem' }}>
                        {h.operador}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Panel de acciones */}
        <div className="acciones-panel">
          <p className="acciones-title">Acciones</p>
          <button
            className="accion-btn accion-aprobar"
            disabled={finalizada}
            onClick={() => setModal({ accion: 'aprobar', title: 'Aprobar solicitud', requireComment: false })}
          >
            ✓ Aprobar
          </button>
          <button
            className="accion-btn accion-rechazar"
            disabled={finalizada}
            onClick={() => setModal({ accion: 'rechazar', title: 'Rechazar solicitud', requireComment: true })}
          >
            ✕ Rechazar
          </button>
          <button
            className="accion-btn accion-escalar"
            disabled={finalizada}
            onClick={() => setModal({ accion: 'escalar', title: 'Escalar a coordinador', requireComment: false })}
          >
            ↑ Escalar al coordinador
          </button>
          <div style={{ borderTop: '1px solid var(--gray-200)', margin: '0.75rem 0' }} />
          <button
            className="accion-btn accion-interno"
            onClick={() => setModal({ accion: 'comentario', title: 'Comentario interno', requireComment: false })}
          >
            + Comentario interno
          </button>
        </div>
      </div>
    </AppShell>
  )
}
