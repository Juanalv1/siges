import './auth.css'

export default function AuthShell({ children }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-brand-top">
          <div className="auth-brand-rule" />
          <div className="auth-brand-wordmark">SiGES</div>
          <div className="auth-brand-sub">
            Sistema de Gestión<br />
            de Solicitudes<br />
            Estudiantiles
          </div>
        </div>
        <div className="auth-brand-footer">
          Departamento de Control de Estudios
        </div>
      </aside>
      <main className="auth-form-panel">
        <div className="auth-form-box">
          {children}
        </div>
      </main>
    </div>
  )
}
