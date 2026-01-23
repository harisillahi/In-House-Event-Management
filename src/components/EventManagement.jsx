import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { format, differenceInSeconds } from 'date-fns'
import './EventManagement.css'

// Focus Timer Component
function FocusTimer({ event, countdown }) {
  const [timeColor, setTimeColor] = useState('green')
  const [shouldBlink, setShouldBlink] = useState(false)

  useEffect(() => {
    if (!event || !event.end_time) return

    const end = new Date(event.end_time)
    const now = new Date()
    const secondsRemaining = differenceInSeconds(end, now)

    // Determine color based on time remaining
    if (secondsRemaining <= 60) {
      setTimeColor('red')
      setShouldBlink(true)
    } else if (secondsRemaining <= 300) { // 5 minutes
      setTimeColor('red')
      setShouldBlink(false)
    } else if (secondsRemaining <= 600) { // 10 minutes
      setTimeColor('yellow')
      setShouldBlink(false)
    } else {
      setTimeColor('green')
      setShouldBlink(false)
    }
  }, [countdown, event])

  // Format countdown to hide hours if 0
  const formatCountdown = (countdownStr) => {
    if (!countdownStr) return '00m 00s'
    
    // Check if countdown starts with "0h" or "+0h"
    if (countdownStr.startsWith('0h ')) {
      return countdownStr.substring(3) // Remove "0h "
    } else if (countdownStr.startsWith('+0h ')) {
      return '+' + countdownStr.substring(4) // Keep + and remove "0h "
    }
    
    return countdownStr
  }

  return (
    <div className={`focus-timer ${timeColor} ${shouldBlink ? 'blink' : ''}`}>
      {formatCountdown(countdown)}
    </div>
  )
}

function EventManagement() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [countdowns, setCountdowns] = useState({})
  const [focusedEvent, setFocusedEvent] = useState(null)
  const [activeLocation, setActiveLocation] = useState('all')
  
  // Form states
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    duration: 30,
    presenter: '',
    location: '',
    color: '#007bff',
    notes: ''
  })

  useEffect(() => {
    fetchEvents()
    
    const channel = supabase
      .channel('events_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Event change received!', payload)
          fetchEvents()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Update countdowns every second
  useEffect(() => {
    const countdownInterval = setInterval(() => {
      updateCountdowns()
    }, 1000)

    return () => clearInterval(countdownInterval)
  }, [events])

  // Update countdowns whenever events change
  useEffect(() => {
    updateCountdowns()
  }, [events])

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timeInterval)
  }, [])

  // Auto-start and auto-complete events based on current time
  useEffect(() => {
    const autoStartInterval = setInterval(async () => {
      const now = new Date()
      let hasChanges = false
      
      for (const event of events) {
        if (event.status === 'scheduled' && event.start_time) {
          const startTime = new Date(event.start_time)
          if (now >= startTime) {
            // Auto-start the event
            await supabase
              .from('events')
              .update({ status: 'in_progress', end_time: new Date(now.getTime() + event.duration * 60000).toISOString() })
              .eq('id', event.id)
            hasChanges = true
          }
        }
        
        if (event.status === 'in_progress' && event.end_time) {
          const endTime = new Date(event.end_time)
          if (now >= endTime) {
            // Auto-complete the event
            await supabase
              .from('events')
              .update({ status: 'completed' })
              .eq('id', event.id)
            hasChanges = true
            
            // Auto-start next event in same location
            const nextEvent = events.find(e => 
              e.location === event.location && 
              e.status === 'scheduled' &&
              e.cue_order > event.cue_order
            )
            if (nextEvent) {
              await supabase
                .from('events')
                .update({ status: 'in_progress', end_time: new Date(now.getTime() + nextEvent.duration * 60000).toISOString() })
                .eq('id', nextEvent.id)
              hasChanges = true
            }
          }
        }
      }
      
      // Refresh events if changes were made
      if (hasChanges) {
        await new Promise(resolve => setTimeout(resolve, 100))
        fetchEvents()
      }
    }, 1000)

    return () => clearInterval(autoStartInterval)
  }, [events])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('cue_order', { ascending: true })
      
      if (error) throw error
      setEvents(data || [])
      // Update countdowns after fetching events
      setTimeout(updateCountdowns, 100)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateCountdowns = () => {
    const now = new Date()
    const newCountdowns = {}

    events.forEach(event => {
      if (event.status === 'in_progress' && event.end_time) {
        const end = new Date(event.end_time)
        
        if (now > end) {
          const diff = differenceInSeconds(now, end)
          const hours = Math.floor(diff / 3600)
          const minutes = Math.floor((diff % 3600) / 60)
          const seconds = diff % 60
          newCountdowns[event.id] = `+${hours}h ${minutes}m ${seconds}s`
        } else {
          const diff = differenceInSeconds(end, now)
          const hours = Math.floor(diff / 3600)
          const minutes = Math.floor((diff % 3600) / 60)
          const seconds = diff % 60
          newCountdowns[event.id] = `${hours}h ${minutes}m ${seconds}s`
        }
      }
    })

    setCountdowns(newCountdowns)
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      start_time: '',
      end_time: '',
      duration: 30,
      presenter: '',
      location: '',
      color: '#007bff',
      notes: ''
    })
    setEditingEvent(null)
    setShowAddForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    try {
      // Calculate end_time from start_time and duration if start_time is provided
      let eventData = {
        ...formData,
        cue_order: editingEvent ? editingEvent.cue_order : events.length + 1,
        status: editingEvent ? editingEvent.status : 'scheduled'
      }

      if (formData.start_time && formData.duration) {
        // datetime-local input already gives us local time, just parse it directly
        const startTime = new Date(formData.start_time)
        const durationMinutes = parseInt(formData.duration) || 30
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000)
        
        eventData.start_time = startTime.toISOString()
        eventData.end_time = endTime.toISOString()
      }

      if (editingEvent) {
        const { error } = await supabase
          .from('events')
          .update(eventData)
          .eq('id', editingEvent.id)
        
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('events')
          .insert([eventData])
        
        if (error) throw error
      }
      
      // Wait a moment for database to sync, then fetch fresh data
      await new Promise(resolve => setTimeout(resolve, 100))
      fetchEvents()
      resetForm()
    } catch (error) {
      console.error('Error saving event:', error)
      alert('Error saving event. Please try again.')
    }
  }

  const handleEdit = (event) => {
    setEditingEvent(event)
    
    // Convert UTC time from database to local time for datetime-local input
    const formatLocalDateTime = (isoString) => {
      if (!isoString) return ''
      const date = new Date(isoString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day}T${hours}:${minutes}`
    }
    
    setFormData({
      title: event.title,
      description: event.description || '',
      start_time: formatLocalDateTime(event.start_time),
      end_time: formatLocalDateTime(event.end_time),
      duration: event.duration || 30,
      presenter: event.presenter || '',
      location: event.location || '',
      color: event.color || '#007bff',
      notes: event.notes || ''
    })
    setShowAddForm(true)
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this event?')) return
    
    try {
      // Remove from local state immediately for instant UI feedback
      setEvents(events.filter(e => e.id !== id))
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting event:', error)
      // Refresh to show correct state if delete failed
      fetchEvents()
    }
  }

  const handleStatusChange = async (id, newStatus) => {
    // Find the current event to store its previous status
    const currentEvent = events.find(event => event.id === id)
    if (!currentEvent) return

    const previousStatus = currentEvent.status

    // Prepare the update data
    let updateData = { status: newStatus }
    
    // When starting an event, set the end_time to now + duration to follow the original duration
    if (newStatus === 'in_progress') {
      const durationMinutes = currentEvent.duration || 30 // default 30 minutes
      const endTime = new Date(Date.now() + durationMinutes * 60000)
      updateData.end_time = endTime.toISOString()
    }

    // Optimistically update the local state immediately
    setEvents(prevEvents => 
      prevEvents.map(event => 
        event.id === id ? { ...event, ...updateData } : event
      )
    )

    // Update countdowns immediately
    setTimeout(updateCountdowns, 100)

    try {
      const { error } = await supabase
        .from('events')
        .update(updateData)
        .eq('id', id)

      if (error) throw error

      // Auto-start next event at same location when completing
      if (newStatus === 'completed' && currentEvent.location) {
        // Find the next scheduled event at the same location
        const nextEvent = events.find(e => 
          e.location === currentEvent.location && 
          e.status === 'scheduled' &&
          e.id !== id
        )

        if (nextEvent) {
          // Automatically start the next event
          const durationMinutes = nextEvent.duration || 30
          const endTime = new Date(Date.now() + durationMinutes * 60000)
          
          await supabase
            .from('events')
            .update({ 
              status: 'in_progress',
              end_time: endTime.toISOString()
            })
            .eq('id', nextEvent.id)
          
          // Refresh events to show the auto-started event
          await new Promise(resolve => setTimeout(resolve, 100))
          fetchEvents()
        }
      }
    } catch (error) {
      console.error('Error updating status:', error)
      // Revert the optimistic update on error
      setEvents(prevEvents => 
        prevEvents.map(event => 
          event.id === id ? { ...event, status: previousStatus } : event
        )
      )
      // Update countdowns after revert
      setTimeout(updateCountdowns, 100)
    }
  }

  const moveEvent = async (eventId, direction) => {
    const event = events.find(e => e.id === eventId)
    if (!event) return

    const currentIndex = events.findIndex(e => e.id === eventId)
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (newIndex < 0 || newIndex >= events.length) return

    const updatedEvents = [...events]
    const [movedEvent] = updatedEvents.splice(currentIndex, 1)
    updatedEvents.splice(newIndex, 0, movedEvent)

    // Optimistic update - update local state immediately
    setEvents(updatedEvents)

    // Update cue_order for all affected events
    const updates = updatedEvents.map((e, index) => ({
      id: e.id,
      cue_order: index + 1
    }))

    try {
      for (const update of updates) {
        await supabase
          .from('events')
          .update({ cue_order: update.cue_order })
          .eq('id', update.id)
      }
      // Fetch fresh data after update completes
      await new Promise(resolve => setTimeout(resolve, 100))
      fetchEvents()
    } catch (error) {
      console.error('Error reordering events:', error)
      // Refresh to show correct state if update failed
      fetchEvents()
    }
  }

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (event.description && event.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (event.presenter && event.presenter.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesLocation = activeLocation === 'all' || event.location === activeLocation
    
    if (filter === 'scheduled') return matchesSearch && matchesLocation && event.status === 'scheduled'
    if (filter === 'in_progress') return matchesSearch && matchesLocation && event.status === 'in_progress'
    if (filter === 'completed') return matchesSearch && matchesLocation && event.status === 'completed'
    return matchesSearch && matchesLocation
  })

  // Get unique locations from events
  const locations = ['all', ...new Set(events.map(e => e.location).filter(Boolean))]

  const stats = {
    total: events.length
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
            <h1>Event Management</h1>
            <p className="subtitle">Rundown, Scheduling & Cueing</p>
          </div>
          <div className="header-stats">
            <div className="current-time-clock">
              <div className="clock-time">{currentTime.toLocaleTimeString('en-US', { hour12: false })}</div>
              <div className="clock-date">{currentTime.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</div>
            </div>
            <div className="stat-card-small total">
              <div className="stat-number-small">{stats.total}</div>
              <div className="stat-label-small">Total Events</div>
            </div>
            <button 
              onClick={() => {
                resetForm()
                setShowAddForm(true)
              }} 
              className="btn-add-event"
            >
            Add Event
            </button>
          </div>
        </div>
      </header>

      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingEvent ? 'Edit Event' : 'Add Event'}</h2>
              <button 
                className="modal-close" 
                onClick={() => {
                  setShowAddForm(false)
                  resetForm()
                }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="event-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="title">Event Title *</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    placeholder="Enter event title"
                    required
                    className="input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="presenter">Presenter</label>
                  <input
                    type="text"
                    id="presenter"
                    name="presenter"
                    value={formData.presenter}
                    onChange={handleInputChange}
                    placeholder="Enter presenter name"
                    className="input"
                  />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="start_time">Start Time *</label>
                <input
                  type="datetime-local"
                  id="start_time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="end_time">End Time *</label>
                <input
                  type="datetime-local"
                  id="end_time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleInputChange}
                  required
                  className="input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location">Location</label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleInputChange}
                  placeholder="Enter location"
                  className="input"
                />
              </div>
              <div className="form-group">
                <label htmlFor="color">Color</label>
                <input
                  type="color"
                  id="color"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  className="input"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter event description"
                rows="3"
                className="input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                placeholder="Internal notes"
                rows="2"
                className="input"
              />
            </div>

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update Event' : 'Add Event'}
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddForm(false)
                    resetForm()
                  }} 
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Event Rundown</h2>
        </div>

        {/* Location Tabs */}
        {locations.length > 1 && (
          <div className="location-tabs">
            {locations.map(location => (
              <button
                key={location}
                onClick={() => setActiveLocation(location)}
                className={`location-tab ${activeLocation === location ? 'active' : ''}`}
              >
                {location === 'all' ? 'All Locations' : location}
              </button>
            ))}
          </div>
        )}

        <div className="controls">
          <input
            type="text"
            placeholder="Search events..."
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
              onClick={() => setFilter('scheduled')}
              className={`btn btn-filter ${filter === 'scheduled' ? 'active' : ''}`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setFilter('in_progress')}
              className={`btn btn-filter ${filter === 'in_progress' ? 'active' : ''}`}
            >
              In Progress
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`btn btn-filter ${filter === 'completed' ? 'active' : ''}`}
            >
              Completed
            </button>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="empty-state">
            <p>No events found. Add your first event above!</p>
          </div>
        ) : (
          <div className="events-list">
            {filteredEvents.map((event, index) => (
              <div 
                key={event.id} 
                className={`event-item ${event.status}`}
                style={{ borderLeftColor: event.color }}
              >
                <div className="event-order">
                  <span className="order-number">#{event.cue_order}</span>
                  <div className="order-controls">
                    <button
                      onClick={() => moveEvent(event.id, 'up')}
                      disabled={index === 0}
                      className="btn-order"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveEvent(event.id, 'down')}
                      disabled={index === filteredEvents.length - 1}
                      className="btn-order"
                      title="Move down"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="event-content">
                  <div className="event-header">
                    <h3>{event.title}</h3>
                    <span className={`status-badge status-${event.status}`}>
                      {event.status === 'scheduled' && 'Scheduled'}
                      {event.status === 'in_progress' && 'In Progress'}
                      {event.status === 'completed' && 'Completed'}
                      {event.status === 'cancelled' && 'Cancelled'}
                    </span>
                  </div>

                  {event.description && (
                    <p className="event-description">{event.description}</p>
                  )}

                  <div className="event-details">
                    <div className="event-time">
                      <strong>Start:</strong> {format(new Date(event.start_time), 'MMM dd, yyyy HH:mm')}
                      <span className="separator">→</span>
                      <strong>End:</strong> {format(new Date(event.end_time), 'MMM dd, yyyy HH:mm')}
                    </div>
                    {event.status === 'in_progress' && (
                      <div className="event-countdown">
                        <strong>Time Remaining:</strong> {countdowns[event.id] || '00h 00m 00s'}
                      </div>
                    )}
                    {event.presenter && (
                      <div className="event-meta">
                        <strong>Presenter:</strong> {event.presenter}
                      </div>
                    )}
                    {event.location && (
                      <div className="event-meta">
                        <strong>Location:</strong> {event.location}
                      </div>
                    )}
                  </div>
                </div>

                <div className="event-actions">
                  <button
                    onClick={() => handleStatusChange(
                      event.id, 
                      event.status === 'in_progress' ? 'completed' : 'in_progress'
                    )}
                    className={`btn-table ${event.status === 'in_progress' ? 'btn-stop' : 'btn-start'}`}
                    disabled={event.status === 'completed'}
                  >
                    {event.status === 'in_progress' ? 'Stop' : 'Start'}
                  </button>
                  <button
                    onClick={() => setFocusedEvent(event)}
                    className="btn-table btn-focus"
                    disabled={event.status !== 'in_progress'}
                  >
                    Focus
                  </button>
                  <button
                    onClick={() => handleEdit(event)}
                    className="btn-table btn-edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="btn-table btn-delete"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <footer className="footer">
        <p>All changes sync in real-time across all devices</p>
      </footer>

      {/* Focus Modal */}
      {focusedEvent && (
        <div className="modal-overlay focus-overlay" onClick={() => setFocusedEvent(null)}>
          <div className="modal-content focus-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close focus-close" onClick={() => setFocusedEvent(null)}>×</button>
            <div className="focus-content">
              <h1 className="focus-title">{focusedEvent.title}</h1>
              {focusedEvent.presenter && (
                <p className="focus-presenter">{focusedEvent.presenter}</p>
              )}
              {focusedEvent.location && (
                <p className="focus-location">{focusedEvent.location}</p>
              )}
              <div className="focus-timer-container">
                <FocusTimer event={focusedEvent} countdown={countdowns[focusedEvent.id]} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EventManagement