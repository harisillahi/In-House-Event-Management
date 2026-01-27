import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '../supabaseClient'

function AdminView() {
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [newAttendeeName, setNewAttendeeName] = useState('')
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('')
  const [newAttendeeCompany, setNewAttendeeCompany] = useState('')
  const [importing, setImporting] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const html5QrCodeRef = useRef(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showImport, setShowImport] = useState(false)

  useEffect(() => {
    fetchAttendees()
    
    const channel = supabase
      .channel('admin_attendees_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendees' },
        (payload) => {
          console.log('Admin: Attendee change received!', payload)
          // Debounce to batch multiple rapid changes
          setTimeout(() => fetchAttendees(), 100)
        }
      )
      .subscribe((status) => {
        console.log('Admin: Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Admin: Successfully subscribed to realtime attendees')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Admin: Subscription failed:', status)
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
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
        // fetchAttendees() will be called via real-time subscription
      }
    } catch (error) {
      console.error('Error adding attendee:', error)
      alert('Error adding attendee. Please try again.')
    }
  }

  const toggleCheckIn = async (id, currentStatus) => {
    try {
      const { error } = await supabase
        .from('attendees')
        .update({ checked_in: !currentStatus })
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

  const importFromCSV = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const csv = e.target.result
        const lines = csv.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        
        const nameIndex = headers.indexOf('name')
        const emailIndex = headers.indexOf('email')
        const companyIndex = headers.indexOf('company')
        
        if (nameIndex === -1 || emailIndex === -1) {
          alert('CSV must contain "name" and "email" columns')
          return
        }

        const attendeesToInsert = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          if (values.length > Math.max(nameIndex, emailIndex)) {
            attendeesToInsert.push({
              name: values[nameIndex],
              email: values[emailIndex],
              company: companyIndex !== -1 ? values[companyIndex] : null
            })
          }
        }

        const { error } = await supabase
          .from('attendees')
          .insert(attendeesToInsert)

        if (error) throw error
        
        alert(`Successfully imported ${attendeesToInsert.length} attendees`)
        event.target.value = ''
        // fetchAttendees() will be called via real-time subscription
      } catch (error) {
        console.error('Error importing CSV:', error)
        alert('Error importing CSV. Please check the format and try again.')
      } finally {
        setImporting(false)
      }
    }
    
    reader.readAsText(file)
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Checked In', 'Created At']
    const csvContent = [
      headers.join(','),
      ...attendees.map(attendee => [
        `"${attendee.name}"`,
        `"${attendee.email}"`,
        `"${attendee.company || ''}"`,
        attendee.checked_in ? 'Yes' : 'No',
        `"${format(new Date(attendee.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'attendees.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const downloadTemplate = () => {
    const csvContent = 'Name,Email,Company\nJohn Doe,john@example.com,Company Inc.\nJane Smith,jane@example.com,Another Company'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'attendees_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const startQRScanner = async () => {
    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-reader')
      }
      
      setScannerError('')
      setShowScanner(true)
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
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

  const checkedInCount = attendees.filter(a => a.checked_in).length
  const totalCount = attendees.length
  const stats = { checkedIn: checkedInCount, total: totalCount }

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>camLine forum 2026</h1>
            <p className="subtitle">Hilton Dresden - Admin Panel</p>
          </div>
          <div className="header-stats">
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
        <h2>Add Attendees</h2>
        
        <button 
          onClick={() => setShowImport(!showImport)} 
          className="btn btn-toggle"
        >
          {showImport ? '▼ Hide CSV Import' : '▶ Show CSV Import'}
        </button>

        {showImport && (
          <>
            <div className="import-section">
              <div className="import-buttons">
                <label htmlFor="csv-upload" className="btn btn-import">
                  {importing ? '⏳ Importing...' : 'Import CSV from Excel'}
                </label>
                <input
                  id="csv-upload"
                  type="file"
                  accept=".csv"
                  onChange={importFromCSV}
                  disabled={importing}
                  style={{ display: 'none' }}
                />
                <button onClick={downloadTemplate} className="btn btn-secondary">
                  Download CSV Template
                </button>
              </div>
              <p className="import-note">
                Export your Excel data as CSV (Name, Email columns), then import it here
              </p>
            </div>

            <div className="divider">
              <span>OR</span>
            </div>
          </>
        )}

        <form onSubmit={addAttendee} className="add-form">
          <input
            type="text"
            placeholder="Name *"
            value={newAttendeeName}
            onChange={(e) => setNewAttendeeName(e.target.value)}
            required
            className="input"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={newAttendeeEmail}
            onChange={(e) => setNewAttendeeEmail(e.target.value)}
            className="input"
          />
          <input
            type="text"
            placeholder="Company (optional)"
            value={newAttendeeCompany}
            onChange={(e) => setNewAttendeeCompany(e.target.value)}
            className="input"
          />
          <button type="submit" className="btn btn-primary">
            Add Single Attendee
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Quick Check-In</h2>
        {!showScanner ? (
          <button onClick={startQRScanner} className="btn btn-primary btn-scan">
            Scan QR Code
          </button>
        ) : (
          <>
            <div id="qr-reader" style={{ width: '100%' }}></div>
            <button onClick={stopQRScanner} className="btn btn-danger">
              Stop Scanning
            </button>
          </>
        )}
        {scannerError && <p className="error-message">{scannerError}</p>}
        <p className="scanner-note">
          Scan attendee QR code
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Attendee List</h2>
          <button onClick={exportToCSV} className="btn btn-export">
            Export CSV
          </button>
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
                          onClick={() => toggleCheckIn(attendee.id, attendee.checked_in, attendee.check_in_time)}
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
        <p>Admin Mode - Full access to all features</p>
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
    </div>
  )
}

export default AdminView
