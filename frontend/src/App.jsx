import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/auth/Login'
import Registro from './pages/auth/Registro'
import Recuperar from './pages/auth/Recuperar'
import Inscripcion from './pages/Inscripcion'

import Dashboard from './pages/estudiante/Dashboard'
import NuevaSolicitud from './pages/estudiante/NuevaSolicitud'
import DetalleSolicitud from './pages/estudiante/DetalleSolicitud'

import Bandeja from './pages/operador/Bandeja'
import DetalleSolicitudOp from './pages/operador/DetalleSolicitudOp'

import DashboardCoord from './pages/coordinador/DashboardCoord'
import TiposTramite from './pages/coordinador/TiposTramite'
import SolicitudesEscaladas from './pages/coordinador/SolicitudesEscaladas'
import Usuarios from './pages/coordinador/Usuarios'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Público */}
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Registro />} />
          <Route path="/recuperar" element={<Recuperar />} />
          <Route path="/inscripcion" element={<Inscripcion />} />

          {/* Estudiante */}
          <Route path="/solicitudes" element={
            <ProtectedRoute roles={['estudiante']}><Dashboard /></ProtectedRoute>
          } />
          <Route path="/solicitudes/nueva" element={
            <ProtectedRoute roles={['estudiante']}><NuevaSolicitud /></ProtectedRoute>
          } />
          <Route path="/solicitudes/:ticket" element={
            <ProtectedRoute roles={['estudiante', 'operador', 'coordinador']}><DetalleSolicitud /></ProtectedRoute>
          } />

          {/* Operador */}
          <Route path="/operador" element={
            <ProtectedRoute roles={['operador', 'coordinador']}><Bandeja /></ProtectedRoute>
          } />
          <Route path="/operador/solicitudes/:id" element={
            <ProtectedRoute roles={['operador', 'coordinador']}><DetalleSolicitudOp /></ProtectedRoute>
          } />

          {/* Coordinador */}
          <Route path="/coordinador" element={
            <ProtectedRoute roles={['coordinador']}><DashboardCoord /></ProtectedRoute>
          } />
          <Route path="/coordinador/tramites" element={
            <ProtectedRoute roles={['coordinador']}><TiposTramite /></ProtectedRoute>
          } />
          <Route path="/coordinador/escaladas" element={
            <ProtectedRoute roles={['coordinador']}><SolicitudesEscaladas /></ProtectedRoute>
          } />
          <Route path="/coordinador/usuarios" element={
            <ProtectedRoute roles={['coordinador']}><Usuarios /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
