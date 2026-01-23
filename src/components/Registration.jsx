import { useState, useEffect, useRef } from 'react'
import { supabase } from '../supabaseClient'
import { format } from 'date-fns'
import { Html5Qrcode } from 'html5-qrcode'
import '../App.css'

function Registration() {
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [newAttendeeName, setNewAttendeeName] = useState('')
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('')
  const [newAttendeeCompany, setNewAttendeeCompany] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const html5QrCodeRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchAttendees()
    
    const channel = supabase
      .channel('attendees_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendees' },
        (payload) => {
          console.log('Change received!', payload)
          fetchAttendees()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setAttendees(data || [])
    } catch (error) {
      console.error('Error fetching attendees:', error)
    } finally {
      setLoading(false)
    }
  }

  const addAttendee = async (e) => {
    e.preventDefault()
    if (!newAttendeeName.trim() || !newAttendeeEmail.trim()) return

    try {
      const { data, error } = await supabase
        .from('attendees')
        .insert([
          { 
            name: newAttendeeName.trim(), 
            email: newAttendeeEmail.trim(),
            company: newAttendeeCompany.trim() || null
          }
        ])
        .select()

      if (error) {
        if (error.code === '23505') { // unique constraint violation
          setModalMessage(`An attendee with email "${newAttendeeEmail}" already exists.`)
          setShowModal(true)
        } else {
          throw error
        }
      } else {
        setNewAttendeeName('')
        setNewAttendeeEmail('')
        setNewAttendeeCompany('')
        setShowAddModal(false)
        // fetchAttendees() will be called via real-time subscription
      }
    } catch (error) {
      console.error('Error adding attendee:', error)
      alert('Error adding attendee. Please try again.')
    }
  }

  const toggleCheckIn = async (id, currentStatus) => {
    try {
      const updates = {
        checked_in: !currentStatus,
        check_in_time: !currentStatus ? new Date().toISOString() : null
      }
      
      const { error } = await supabase
        .from('attendees')
        .update(updates)
        .eq('id', id)

      if (error) throw error
      // fetchAttendees() will be called via real-time subscription
    } catch (error) {
      console.error('Error updating check-in status:', error)
    }
  }

  const deleteAttendee = async (id) => {
    if (!confirm('Are you sure you want to delete this attendee?')) return
    
    try {
      const { error } = await supabase
        .from('attendees')
        .delete()
        .eq('id', id)

      if (error) throw error
      // fetchAttendees() will be called via real-time subscription
    } catch (error) {
      console.error('Error deleting attendee:', error)
    }
  }

  const startQRScanner = async () => {
    try {
      setScannerError('')
      setShowScanner(true)
      
      // Wait for modal to render
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader')
      }
      
      const config = {
        fps: 10,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
          const qrboxSize = Math.floor(minEdge * 0.7)
          return { width: qrboxSize, height: qrboxSize }
        },
        aspectRatio: 1.0
      }
      
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        config,
        async (decodedText) => {
          try {
            const email = decodedText.trim()
            const { data, error } = await supabase
              .from('attendees')
              .update({ checked_in: true })
              .eq('email', email)
              .select()
            
            if (error) throw error
            
            if (data && data.length > 0) {
              alert(`Checked in: ${data[0].name}`)
            } else {
              alert('Attendee not found')
            }
          } catch (error) {
            console.error('Error checking in attendee:', error)
            alert('Error checking in attendee')
          }
        },
        (errorMessage) => {
          // Ignore scan errors, they're normal
        }
      )
    } catch (error) {
      console.error('Error starting scanner:', error)
      setScannerError('Failed to start camera. Please check permissions.')
    }
  }

  const stopQRScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop()
        html5QrCodeRef.current = null
      }
      setShowScanner(false)
      setScannerError('')
    } catch (error) {
      console.error('Error stopping scanner:', error)
    }
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showImport, setShowImport] = useState(false)

  const checkedInCount = attendees.filter(a => a.checked_in).length
  const totalCount = attendees.length
  const notCheckedInCount = totalCount - checkedInCount
  const stats = { total: totalCount, checkedIn: checkedInCount, notCheckedIn: notCheckedInCount }

  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (filter === 'checked-in') return matchesSearch && attendee.checked_in
    if (filter === 'not-checked-in') return matchesSearch && !attendee.checked_in
    return matchesSearch
  })

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>camLine forum 2026</h1>
            <p className="subtitle">Registration</p>
          </div>
          <div className="header-stats">
            <div className="current-time-clock">
              <div className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
              <div className="clock-date">{currentTime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
            </div>
            <div className="stat-card-small total">
              <div className="stat-number-small">{stats.total}</div>
              <div className="stat-label-small">Total</div>
            </div>
            <div className="stat-card-small checked-in">
              <div className="stat-number-small">{stats.checkedIn}</div>
              <div className="stat-label-small">Checked In</div>
            </div>
            <div className="stat-card-small not-checked-in">
              <div className="stat-number-small">{stats.notCheckedIn}</div>
              <div className="stat-label-small">Not Checked In</div>
            </div>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="card-header">
          <h2>Attendee List</h2>
          <div className="header-actions">
            <button onClick={() => setShowAddModal(true)} className="btn btn-scan">
              ➕
            </button>
            <button onClick={startQRScanner} className="btn btn-scan">
              ⛶
            </button>
          </div>
        </div>

        <div className="controls">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input search-input"
          />
          <div className="filter-buttons">
            <button
              onClick={() => setFilter('all')}
              className={`btn btn-filter ${filter === 'all' ? 'active' : ''}`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('checked-in')}
              className={`btn btn-filter ${filter === 'checked-in' ? 'active' : ''}`}
            >
              Checked In
            </button>
            <button
              onClick={() => setFilter('not-checked-in')}
              className={`btn btn-filter ${filter === 'not-checked-in' ? 'active' : ''}`}
            >
              Not Checked In
            </button>
          </div>
        </div>

        {filteredAttendees.length === 0 ? (
          <div className="empty-state">
            <p>No attendees found. Add your first attendee above!</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="attendee-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Check-In Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((attendee) => (
                  <tr key={attendee.id} className={attendee.checked_in ? 'checked-in' : ''}>
                    <td>{attendee.name}</td>
                    <td>{attendee.email || '-'}</td>
                    <td>{attendee.company || '-'}</td>
                    <td>
                      <span className={`status-badge ${attendee.checked_in ? 'status-checked' : 'status-pending'}`}>
                        {attendee.checked_in ? 'Checked In' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      {attendee.checked_in && attendee.check_in_time
                        ? format(new Date(attendee.check_in_time), 'HH:mm:ss')
                        : '-'}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          onClick={() => toggleCheckIn(attendee.id, attendee.checked_in)}
                          className={`btn-table ${attendee.checked_in ? 'btn-undo' : 'btn-checkin'}`}
                        >
                          {attendee.checked_in ? 'Undo' : 'Check In'}
                        </button>
                        <button
                          onClick={() => deleteAttendee(attendee.id)}
                          className="btn-table btn-delete"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <footer className="footer">
        <p>All changes sync in real-time across all devices</p>
      </footer>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Duplicate Attendee</h3>
            </div>
            <div className="modal-body">
              <p>{modalMessage}</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowModal(false)} className="btn btn-primary">
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Attendee Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Attendee</h2>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>&times;</button>
            </div>
            <form onSubmit={addAttendee} className="modal-form">
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  type="text"
                  id="name"
                  placeholder="Enter attendee name"
                  value={newAttendeeName}
                  onChange={(e) => setNewAttendeeName(e.target.value)}
                  required
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter email address"
                  value={newAttendeeEmail}
                  onChange={(e) => setNewAttendeeEmail(e.target.value)}
                  required
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="company">Company</label>
                <input
                  type="text"
                  id="company"
                  placeholder="Enter company name (optional)"
                  value={newAttendeeCompany}
                  onChange={(e) => setNewAttendeeCompany(e.target.value)}
                  className="input"
                />
              </div>
              <div className="modal-actions">
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Attendee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="modal-overlay" onClick={stopQRScanner}>
          <div className="modal-content modal-scanner" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scan QR Code</h2>
              <button className="modal-close" onClick={stopQRScanner}>&times;</button>
            </div>
            <div className="modal-body">
              <div id="qr-reader" style={{ width: '100%' }}></div>
              {scannerError && <p className="error-message" style={{ marginTop: '1rem' }}>{scannerError}</p>}
            </div>
            <div className="modal-actions" style={{ justifyContent: 'center', paddingBottom: '2rem' }}>
              <button onClick={stopQRScanner} className="btn" style={{ background: '#f44336', color: 'white' }}>
                Close Scanner
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Registration