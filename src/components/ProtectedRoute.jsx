import React from 'react'
import { Navigate } from 'react-router-dom'

function ProtectedRoute({ children, type }) {
  const isAuthenticated = sessionStorage.getItem(`${type}Auth`) === 'true'
  return isAuthenticated ? children : <Navigate to={`/${type}/login`} replace />
}

export default ProtectedRoute