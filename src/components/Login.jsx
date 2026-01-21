import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Login.css'

function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()

  // Determine the type from the route
  const isRegistration = location.pathname === '/registration/login'
  const isEventManagement = location.pathname === '/event/login'
  const isAdmin = location.pathname === '/admin/login'

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Simple password check - you can make this more secure
    let correctPassword = 'registration123'
    let authKey = 'registrationAuth'
    let redirectPath = '/registration'
    
    if (isEventManagement) {
      correctPassword = 'event123'
      authKey = 'eventAuth'
      redirectPath = '/event'
    } else if (isAdmin) {
      correctPassword = 'admin123'
      authKey = 'adminAuth'
      redirectPath = '/admin'
    }
    
    if (password === correctPassword) {
      sessionStorage.setItem(authKey, 'true')
      navigate(redirectPath)
    } else {
      setError('Incorrect password')
    }
  }

  const getTitle = () => {
    if (isRegistration) return 'Registration Access'
    if (isEventManagement) return 'Event Management Access'
    if (isAdmin) return 'Admin Access'
    return 'Login'
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>{getTitle()}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="login-button">
            Login
          </button>
        </form>
      </div>
    </div>
  )
}

export default Login