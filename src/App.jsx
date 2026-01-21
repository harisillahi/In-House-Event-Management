import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './components/Home'
import Login from './components/Login'
import ProtectedRoute from './components/ProtectedRoute'
import Registration from './components/Registration'
import EventManagement from './components/EventManagement'
import Admin from './components/Admin'
import AdminLogin from './components/AdminLogin'
import AdminView from './components/AdminView'
import CheckerView from './components/CheckerView'
import './App.css'

function ProtectedAdminRoute({ children }) {
  const isAuthenticated = sessionStorage.getItem('adminAuth') === 'true'
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/registration/login" element={<Login />} />
        <Route path="/registration" element={
          <ProtectedRoute type="registration">
            <Registration />
          </ProtectedRoute>
        } />
        <Route path="/event/login" element={<Login />} />
        <Route path="/event" element={
          <ProtectedRoute type="event">
            <EventManagement />
          </ProtectedRoute>
        } />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute type="admin">
            <Admin />
          </ProtectedRoute>
        } />
        <Route path="/admin/old/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <ProtectedAdminRoute>
            <AdminView />
          </ProtectedAdminRoute>
        } />
        <Route path="/checker" element={<CheckerView />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
