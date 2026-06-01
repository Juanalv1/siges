import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Login from './pages/auth/Login'
import Register from './pages/auth/Registro'
import Recover from './pages/auth/Recuperar'
import Enrollment from './pages/Inscripcion'

import Dashboard from './pages/estudiante/Dashboard'
import NewRequest from './pages/estudiante/NewRequest'
import RequestDetail from './pages/estudiante/RequestDetail'

import Inbox from './pages/operador/Inbox'
import RequestDetailOp from './pages/operador/RequestDetail'

import CoordinatorDashboard from './pages/coordinador/DashboardCoord'
import RequestTypes from './pages/coordinador/RequestTypes'
import EscalatedRequests from './pages/coordinador/EscalatedRequests'
import Users from './pages/coordinador/Users'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/recover" element={<Recover />} />
          <Route path="/enrollment" element={<Enrollment />} />

          {/* Student */}
          <Route path="/requests" element={
            <ProtectedRoute roles={['student']}><Dashboard /></ProtectedRoute>
          } />
          <Route path="/requests/new" element={
            <ProtectedRoute roles={['student']}><NewRequest /></ProtectedRoute>
          } />
          <Route path="/requests/:ticket" element={
            <ProtectedRoute roles={['student', 'operator', 'coordinator']}><RequestDetail /></ProtectedRoute>
          } />

          {/* Operator */}
          <Route path="/operator" element={
            <ProtectedRoute roles={['operator', 'coordinator']}><Inbox /></ProtectedRoute>
          } />
          <Route path="/operator/requests/:id" element={
            <ProtectedRoute roles={['operator', 'coordinator']}><RequestDetailOp /></ProtectedRoute>
          } />

          {/* Coordinator */}
          <Route path="/coordinator" element={
            <ProtectedRoute roles={['coordinator']}><CoordinatorDashboard /></ProtectedRoute>
          } />
          <Route path="/coordinator/request-types" element={
            <ProtectedRoute roles={['coordinator']}><RequestTypes /></ProtectedRoute>
          } />
          <Route path="/coordinator/escalated" element={
            <ProtectedRoute roles={['coordinator']}><EscalatedRequests /></ProtectedRoute>
          } />
          <Route path="/coordinator/users" element={
            <ProtectedRoute roles={['coordinator']}><Users /></ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
