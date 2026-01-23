import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { format } from 'date-fns'
import './Admin.css'

function Admin() {
  const [attendees, setAttendees] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState('attendees') // 'attendees', 'events', 'attendees-list', or 'settings'
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [forumName, setForumName] = useState(localStorage.getItem('forumName') || 'camLine forum 2026')
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    fetchData()
    
    const attendeesChannel = supabase
      .channel('admin_attendees')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'attendees' },
        () => fetchData()
      )
      .subscribe()

    const eventsChannel = supabase
      .channel('admin_events')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(attendeesChannel)
      supabase.removeChannel(eventsChannel)
    }
  }, [])

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  const fetchData = async () => {
    try {
      const [attendeesRes, eventsRes] = await Promise.all([
        supabase.from('attendees').select('*').order('created_at', { ascending: false }),
        supabase.from('events').select('*').order('cue_order', { ascending: true })
      ])
      
      if (attendeesRes.error) throw attendeesRes.error
      if (eventsRes.error) throw eventsRes.error
      
      setAttendees(attendeesRes.data || [])
      setEvents(eventsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleForumNameChange = (newName) => {
    setForumName(newName)
    localStorage.setItem('forumName', newName)
  }

  // Attendees CSV Functions
  const importAttendeesCSV = async (event) => {
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
      } catch (error) {
        console.error('Error importing CSV:', error)
        alert('Error importing CSV. Please check the format and try again.')
      } finally {
        setImporting(false)
      }
    }
    
    reader.readAsText(file)
  }

  const exportAttendeesCSV = () => {
    const headers = ['Name', 'Email', 'Company', 'Checked In', 'Check-in Time', 'Created At']
    const csvContent = [
      headers.join(','),
      ...attendees.map(attendee => [
        `"${attendee.name}"`,
        `"${attendee.email}"`,
        `"${attendee.company || ''}"`,
        attendee.checked_in ? 'Yes' : 'No',
        attendee.check_in_time ? `"${format(new Date(attendee.check_in_time), 'yyyy-MM-dd HH:mm:ss')}"` : '',
        `"${format(new Date(attendee.created_at), 'yyyy-MM-dd HH:mm:ss')}"`
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendees_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const downloadAttendeesTemplate = () => {
    const csvContent = 'Name,Email,Company\nJohn Doe,john@example.com,Company Inc.\nJane Smith,jane@example.com,Another Company'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'attendees_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Events CSV Functions
  const importEventsCSV = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    setImporting(true)
    const reader = new FileReader()
    
    reader.onload = async (e) => {
      try {
        const csv = e.target.result
        const lines = csv.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        
        const titleIndex = headers.indexOf('title')
        const startTimeIndex = headers.indexOf('start_time')
        const endTimeIndex = headers.indexOf('end_time')
        const descriptionIndex = headers.indexOf('description')
        const presenterIndex = headers.indexOf('presenter')
        const locationIndex = headers.indexOf('location')
        
        if (titleIndex === -1 || startTimeIndex === -1 || endTimeIndex === -1) {
          alert('CSV must contain "title", "start_time", and "end_time" columns')
          return
        }

        const eventsToInsert = []
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          if (values.length > Math.max(titleIndex, startTimeIndex, endTimeIndex)) {
            eventsToInsert.push({
              title: values[titleIndex],
              start_time: values[startTimeIndex],
              end_time: values[endTimeIndex],
              description: descriptionIndex !== -1 ? values[descriptionIndex] : null,
              presenter: presenterIndex !== -1 ? values[presenterIndex] : null,
              location: locationIndex !== -1 ? values[locationIndex] : null,
              cue_order: events.length + i
            })
          }
        }

        const { error } = await supabase
          .from('events')
          .insert(eventsToInsert)

        if (error) throw error
        
        alert(`Successfully imported ${eventsToInsert.length} events`)
        event.target.value = ''
      } catch (error) {
        console.error('Error importing CSV:', error)
        alert('Error importing CSV. Please check the format and try again.')
      } finally {
        setImporting(false)
      }
    }
    
    reader.readAsText(file)
  }

  const exportEventsCSV = () => {
    const headers = ['Title', 'Description', 'Start Time', 'End Time', 'Presenter', 'Location', 'Status', 'Cue Order']
    const csvContent = [
      headers.join(','),
      ...events.map(event => [
        `"${event.title}"`,
        `"${event.description || ''}"`,
        `"${format(new Date(event.start_time), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${format(new Date(event.end_time), 'yyyy-MM-dd HH:mm:ss')}"`,
        `"${event.presenter || ''}"`,
        `"${event.location || ''}"`,
        event.status,
        event.cue_order
      ].join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `events_${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const downloadEventsTemplate = () => {
    const csvContent = 'Title,Description,Start Time,End Time,Presenter,Location\nWelcome Keynote,Opening remarks,2026-01-20 09:00:00,2026-01-20 10:00:00,John Doe,Main Hall\nTech Talk,Latest innovations,2026-01-20 10:30:00,2026-01-20 11:30:00,Jane Smith,Conference Room A'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'events_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading...</div>
      </div>
    )
  }

  const stats = {
    totalAttendees: attendees.length,
    checkedIn: attendees.filter(a => a.checked_in).length,
    totalEvents: events.length,
    scheduledEvents: events.filter(e => e.status === 'scheduled').length,
    inProgressEvents: events.filter(e => e.status === 'in_progress').length,
    completedEvents: events.filter(e => e.status === 'completed').length
  }

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>Admin Dashboard</h1>
            <p className="subtitle">Manage Attendees & Events Data</p>
          </div>
          <div className="header-stats">
            <div className="current-time-clock">
              <div className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
              <div className="clock-date">{currentTime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
            </div>
            <div className="stat-card-small total">
              <div className="stat-number-small">{stats.totalAttendees}</div>
              <div className="stat-label-small">Attendees</div>
            </div>
            <div className="stat-card-small checked-in">
              <div className="stat-number-small">{stats.checkedIn}</div>
              <div className="stat-label-small">Checked In</div>
            </div>
            <div className="stat-card-small total">
              <div className="stat-number-small">{stats.totalEvents}</div>
              <div className="stat-label-small">Events</div>
            </div>
          </div>
        </div>
      </header>

      <div className="card">
        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'attendees-list' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendees-list')}
          >
            Attendee List
          </button>
          <button 
            className={`tab ${activeTab === 'attendees' ? 'active' : ''}`}
            onClick={() => setActiveTab('attendees')}
          >
            Attendees CSV
          </button>
          <button 
            className={`tab ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events CSV
          </button>
          <button 
            className={`tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>

        {activeTab === 'attendees-list' && (
          <div className="tab-content">
            <div className="card-header">
              <h2>Attendee List</h2>
              <button onClick={exportAttendeesCSV} className="btn btn-export">
                Export to CSV
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

            {(() => {
              const filteredAttendees = attendees.filter(attendee => {
                const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                      (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                                      (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
                
                if (filter === 'checked-in') return matchesSearch && attendee.checked_in
                if (filter === 'not-checked-in') return matchesSearch && !attendee.checked_in
                return matchesSearch
              })

              return filteredAttendees.length === 0 ? (
                <div className="empty-state">
                  <p>No attendees found.</p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAttendees.map(attendee => (
                        <tr key={attendee.id}>
                          <td>{attendee.name}</td>
                          <td>{attendee.email || '-'}</td>
                          <td>{attendee.company || '-'}</td>
                          <td>
                            <span className={`status-badge ${attendee.checked_in ? 'checked-in' : 'not-checked-in'}`}>
                              {attendee.checked_in ? 'Checked In' : 'Not Checked In'}
                            </span>
                          </td>
                          <td>
                            {attendee.check_in_time 
                              ? format(new Date(attendee.check_in_time), 'MMM dd, yyyy HH:mm')
                              : '-'
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}
          </div>
        )}

        {activeTab === 'attendees' && (
          <div className="tab-content">
            <h2>Attendees CSV Management</h2>
            <div className="csv-actions">
              <div className="csv-group">
                <h3>Import Attendees</h3>
                <p>Upload a CSV file to bulk import attendees</p>
                <div className="button-group">
                  <label className="btn btn-primary">
                    {importing ? 'Importing...' : 'Import CSV'}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={importAttendeesCSV}
                      disabled={importing}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button onClick={downloadAttendeesTemplate} className="btn btn-secondary">
                    Download Template
                  </button>
                </div>
              </div>

              <div className="csv-group">
                <h3>Export Attendees</h3>
                <p>Download all attendees data as CSV</p>
                <button onClick={exportAttendeesCSV} className="btn btn-export">
                  Export to CSV ({stats.totalAttendees} records)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="tab-content">
            <h2>Events CSV Management</h2>
            <div className="csv-actions">
              <div className="csv-group">
                <h3>Import Events</h3>
                <p>Upload a CSV file to bulk import events</p>
                <div className="button-group">
                  <label className="btn btn-primary">
                    {importing ? 'Importing...' : 'Import CSV'}
                    <input
                      type="file"
                      accept=".csv"
                      onChange={importEventsCSV}
                      disabled={importing}
                      style={{ display: 'none' }}
                    />
                  </label>
                  <button onClick={downloadEventsTemplate} className="btn btn-secondary">
                    Download Template
                  </button>
                </div>
              </div>

              <div className="csv-group">
                <h3>Export Events</h3>
                <p>Download all events data as CSV</p>
                <button onClick={exportEventsCSV} className="btn btn-export">
                  Export to CSV ({stats.totalEvents} records)
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="tab-content">
            <div className="card-header">
              <h2>Settings</h2>
            </div>

            <div className="settings-section">
              <h3>Forum Settings</h3>
              <div className="form-group">
                <label htmlFor="forum-name">Forum/Event Name</label>
                <input
                  type="text"
                  id="forum-name"
                  value={forumName}
                  onChange={(e) => handleForumNameChange(e.target.value)}
                  placeholder="Enter forum name"
                  className="input"
                />
                <p className="info-text">This name will appear in the top-left corner of the homepage</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="footer">
        <p>All changes sync in real-time across all devices</p>
      </footer>
    </div>
  )
}

export default Admin
