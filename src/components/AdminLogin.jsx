import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = (e) => {
    e.preventDefault()
    const adminPassword = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'
    
    if (password === adminPassword) {
      sessionStorage.setItem('adminAuth', 'true')
      navigate('/admin')
    } else {
      setError('Incorrect password')
      setPassword('')
    }
  }

  return (
    <div className="container">
      <div className="login-container">
        <div className="login-card">
          <h1>Admin Login</h1>
          <p className="login-subtitle">Enter admin password to access admin panel</p>
          
          <form onSubmit={handleLogin} className="login-form">
            <input
              type="password"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              className="input"
              autoFocus
            />
            {error && <p className="error-message">{error}</p>}
            <button type="submit" className="btn btn-primary">
              Login
            </button>
          </form>

          <div className="login-footer">
            <a href="/" className="btn btn-secondary">
              Go to Check-In Mode
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminLogin
