import { useState } from 'react'
import { format } from 'date-fns'

function CheckerView({ attendees, toggleCheckIn, deleteAttendee, stats, startQRScanner, stopQRScanner, showScanner, scannerError }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')

  const filteredAttendees = attendees.filter(attendee => {
    const matchesSearch = attendee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (attendee.email && attendee.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (attendee.company && attendee.company.toLowerCase().includes(searchTerm.toLowerCase()))
    
    if (filter === 'checked-in') return matchesSearch && attendee.checked_in
    if (filter === 'not-checked-in') return matchesSearch && !attendee.checked_in
    return matchesSearch
  })

  return (
    <div className="container">
      <header className="header">
        <div className="header-content">
          <div className="header-text">
            <h1>camLine forum 2026</h1>
            <p className="subtitle">Hilton Dresden - Check-In</p>
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
        </p>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Attendee List</h2>
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
        <p>Check-In Mode - All changes sync in real-time</p>
      </footer>
    </div>
  )
}

export default CheckerView
