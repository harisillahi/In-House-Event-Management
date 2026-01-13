import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { format } from 'date-fns'
import { Html5Qrcode } from 'html5-qrcode'
import './App.css'

function App() {
  const [attendees, setAttendees] = useState([])
  const [loading, setLoading] = useState(true)
  const [newAttendeeName, setNewAttendeeName] = useState('')
  const [newAttendeeEmail, setNewAttendeeEmail] = useState('')
  const [newAttendeeCompany, setNewAttendeeCompany] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [importing, setImporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [scannerError, setScannerError] = useState('')
  const [showStats, setShowStats] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

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

  const fetchAttendees = async () => {
    try {
      const { data, error } = await supabase
        .from('attendees')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setAttendees(data || [])
    } catch (error) {
      console.error('Error fetching attendees:', error.message)
      alert('Error loading attendees. Please check your Supabase connection.')
    } finally {
      setLoading(false)
    }
  }

  const addAttendee = async (e) => {
    e.preventDefault()
    if (!newAttendeeName.trim()) return

    try {
      const nameToCheck = newAttendeeName.trim().toLowerCase()
      const emailToCheck = newAttendeeEmail.trim().toLowerCase()
      
      // Check for duplicates
      const duplicate = attendees.find(a => {
        const existingName = a.name.toLowerCase()
        const existingEmail = a.email ? a.email.toLowerCase() : ''
        
        // If email is provided, check email match
        if (emailToCheck && existingEmail && emailToCheck === existingEmail) {
          return true
        }
        // If no email, check name match
        if (!emailToCheck && nameToCheck === existingName) {
          return true
        }
        return false
      })

      if (duplicate) {
        setModalMessage(`Attendee already exists:\n\n${duplicate.name}${duplicate.email ? '\n' + duplicate.email : ''}${duplicate.company ? '\n' + duplicate.company : ''}`)
        setShowModal(true)
        return
      }

      const { error } = await supabase
        .from('attendees')
        .insert([
          { 
            name: newAttendeeName.trim(), 
            email: newAttendeeEmail.trim() || null,
            company: newAttendeeCompany.trim() || null,
            checked_in: false,
            check_in_time: null
          }
        ])

      if (error) throw error
      
      setNewAttendeeName('')
      setNewAttendeeEmail('')
      setNewAttendeeCompany('')
      fetchAttendees()
    } catch (error) {
      console.error('Error adding attendee:', error.message)
      alert('Error adding attendee: ' + error.message)
    }
  }

  const toggleCheckIn = async (id, currentStatus, currentTime) => {
    try {
      const newStatus = !currentStatus
      const { error } = await supabase
        .from('attendees')
        .update({ 
          checked_in: newStatus,
          check_in_time: newStatus ? new Date().toISOString() : null
        })
        .eq('id', id)

      if (error) throw error
      fetchAttendees()
    } catch (error) {
      console.error('Error updating check-in:', error.message)
      alert('Error updating check-in status')
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
      fetchAttendees()
    } catch (error) {
      console.error('Error deleting attendee:', error.message)
      alert('Error deleting attendee')
    }
  }

  const importFromCSV = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const text = e.target.result
        const lines = text.split('\n').filter(line => line.trim())
        
        const dataLines = lines.slice(1)
        const attendeesToImport = []

        for (const line of dataLines) {
          const matches = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)
          if (!matches || matches.length < 1) continue

          const name = matches[0].replace(/^"|"$/g, '').trim()
          const email = matches[1] ? matches[1].replace(/^"|"$/g, '').trim() : ''
          const company = matches[2] ? matches[2].replace(/^"|"$/g, '').trim() : ''
          
          if (name) {
            attendeesToImport.push({
              name,
              email: email || null,
              company: company || null,
              checked_in: false,
              check_in_time: null
            })
          }
        }

        if (attendeesToImport.length === 0) {
          alert('No valid attendees found in CSV. Make sure it has Name, Email, and Company columns.')
          setImporting(false)
          return
        }

        // Filter out duplicates by checking against existing attendees
        const uniqueAttendees = []
        const skipped = []
        
        for (const newAttendee of attendeesToImport) {
          const nameToCheck = newAttendee.name.toLowerCase()
          const emailToCheck = newAttendee.email ? newAttendee.email.toLowerCase() : ''
          
          const duplicate = attendees.find(a => {
            const existingName = a.name.toLowerCase()
            const existingEmail = a.email ? a.email.toLowerCase() : ''
            
            if (emailToCheck && existingEmail && emailToCheck === existingEmail) {
              return true
            }
            if (!emailToCheck && nameToCheck === existingName) {
              return true
            }
            return false
          })

          if (duplicate) {
            skipped.push(newAttendee.name)
          } else {
            uniqueAttendees.push(newAttendee)
          }
        }

        if (uniqueAttendees.length === 0) {
          alert('All attendees in the CSV already exist in the database.')
          setImporting(false)
          event.target.value = ''
          return
        }

        const { error } = await supabase
          .from('attendees')
          .insert(uniqueAttendees)

        if (error) throw error

        let message = `Successfully imported ${uniqueAttendees.length} attendees!`
        if (skipped.length > 0) {
          message += `\n\nSkipped ${skipped.length} duplicate(s): ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? '...' : ''}`
        }
        alert(message)
        fetchAttendees()
      } catch (error) {
        console.error('Error importing CSV:', error)
        alert('Error importing CSV: ' + error.message)
      } finally {
        setImporting(false)
        event.target.value = ''
      }
    }

    reader.readAsText(file)
  }

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Status', 'Check-in Time']
    const csvData = attendees.map(attendee => [
      attendee.name,
      attendee.email || '',
      attendee.company || '',
      attendee.checked_in ? 'Checked In' : 'Not Checked In',
      attendee.check_in_time ? format(new Date(attendee.check_in_time), 'yyyy-MM-dd HH:mm:ss') : ''
    ])

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `event-checkin-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const downloadTemplate = () => {
    const csvContent = 'Name,Email,Company\nJohn Doe,john@example.com,ABC Corp\nJane Smith,jane@example.com,XYZ Inc'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'attendees-template.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const startQRScanner = async () => {
    try {
      setScannerError('')
      setShowScanner(true)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader")
      }

      await html5QrCodeRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanError
      )
    } catch (err) {
      console.error('Error starting scanner:', err)
      setScannerError('Could not access camera. Please check permissions.')
      setShowScanner(false)
    }
  }

  const stopQRScanner = async () => {
    try {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop()
      }
    } catch (err) {
      console.error('Error stopping scanner:', err)
    }
    setShowScanner(false)
    setScannerError('')
  }

  const onScanSuccess = async (decodedText) => {
    try {
      await stopQRScanner()
      
      const matchedAttendee = attendees.find(a => 
        a.email?.toLowerCase() === decodedText.toLowerCase() ||
        a.name.toLowerCase() === decodedText.toLowerCase() ||
        a.id === decodedText
      )

      if (matchedAttendee) {
        if (matchedAttendee.checked_in) {
          alert(`${matchedAttendee.name} is already checked in!`)
        } else {
          await toggleCheckIn(matchedAttendee.id, true, new Date().toISOString())
          alert(`✓ ${matchedAttendee.name} checked in successfully!`)
        }
      } else {
        alert(`Attendee not found. Scanned: ${decodedText}`)
      }
    } catch (err) {
      console.error('Error processing scan:', err)
      alert('Error processing QR code')
    }
  }

  const onScanError = (errorMessage) => {
    // Ignore scanning errors as they happen frequently while scanning
  }

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error)
      }
    }
  }, [])

  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (filter === 'checked-in') return matchesSearch && attendee.checked_in
    if (filter === 'not-checked-in') return matchesSearch && !attendee.checked_in
    return matchesSearch
  })

  const stats = {
    total: attendees.length,
    checkedIn: attendees.filter(a => a.checked_in).length,
    notCheckedIn: attendees.filter(a => !a.checked_in).length
  }

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
            <p className="subtitle">Hilton Dresden</p>
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
        <h2>➕ Add Attendees</h2>
        
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
                ℹ️ Import CSV here
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
    </div>
  )
}

export default App
