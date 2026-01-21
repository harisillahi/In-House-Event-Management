import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { format, differenceInSeconds } from 'date-fns'
import './Home.css'

function Home() {
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [countdowns, setCountdowns] = useState({})
  const [menuOpen, setMenuOpen] = useState(false)
  const eventRef = useRef([])

  useEffect(() => {
    fetchEvents()
    
    // Polling mechanism - fetch every 5 seconds as fallback
    const pollInterval = setInterval(() => {
      fetchEvents()
    }, 5000)
    
    const channel = supabase
      .channel('home_events_realtime')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log('Home: Event change received!', payload)
          fetchEvents()
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      updateCountdowns()
    }, 1000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
      clearInterval(pollInterval)
    }
  }, [])

  useEffect(() => {
    eventRef.current = events
    updateCountdowns()
  }, [events])

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('cue_order', { ascending: true })
      
      if (error) throw error
      
      // Filter out completed events, only show scheduled and in_progress
      const activeEvents = data?.filter(e => e.status !== 'completed') || []
      
      // Group by location and show only earliest event per location
      const locationMap = new Map()
      activeEvents.forEach(event => {
        const location = event.location || 'No Location'
        const existing = locationMap.get(location)
        
        if (!existing) {
          locationMap.set(location, event)
        } else {
          // Prioritize in_progress, then earliest start_time
          if (event.status === 'in_progress' && existing.status !== 'in_progress') {
            locationMap.set(location, event)
          } else if (event.status === existing.status && event.start_time < existing.start_time) {
            locationMap.set(location, event)
          }
        }
      })
      
      setEvents(Array.from(locationMap.values()))
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const updateCountdowns = () => {
    const allEvents = eventRef.current
    const newCountdowns = {}

    allEvents.forEach(event => {
      if (event.status === 'completed') {
        newCountdowns[event.id] = 'Event has ended'
      } else if (event.status === 'in_progress' && event.end_time) {
        const end = new Date(event.end_time)
        const now = new Date()
        
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
      } else if (event.status === 'scheduled' && event.start_time) {
        const start = new Date(event.start_time)
        const now = new Date()
        const diff = differenceInSeconds(start, now)
        
        if (diff > 0) {
          const hours = Math.floor(diff / 3600)
          const minutes = Math.floor((diff % 3600) / 60)
          const seconds = diff % 60
          newCountdowns[event.id] = `Starts in ${hours}h ${minutes}m ${seconds}s`
        } else {
          newCountdowns[event.id] = 'Event not started yet'
        }
      }
    })

    setCountdowns(newCountdowns)
  }

  return (
    <div className="home-container">
      <div className="hamburger-menu">
        <button className="hamburger-btn" onClick={() => setMenuOpen(!menuOpen)}>
          ☰
        </button>
        {menuOpen && (
          <div className="menu-dropdown">
            <button 
              className="menu-item"
              onClick={() => {
                navigate('/registration')
                setMenuOpen(false)
              }}
            >
              Registration
            </button>
            <button 
              className="menu-item"
              onClick={() => {
                navigate('/event')
                setMenuOpen(false)
              }}
            >
              Event Management
            </button>
            <button 
              className="menu-item"
              onClick={() => {
                navigate('/admin')
                setMenuOpen(false)
              }}
            >
              Admin
            </button>
          </div>
        )}
      </div>
      
      <h1 className="event-title">
        {localStorage.getItem('forumName') || 'camLine forum 2026'}
      </h1>
      
      <div className="events-container">
        {events.map((event) => (
          <div key={event.id} className="event-display">
            <div className={event.status === 'in_progress' ? 'current-event' : 'next-event'}>
              <div className={`event-status ${event.status === 'in_progress' ? 'in-progress' : event.status === 'completed' ? 'completed' : 'upcoming'}`}>
                {event.status === 'in_progress' ? 'LIVE NOW' : 
                 event.status === 'completed' ? 'COMPLETED' :
                 (event.status === 'scheduled' && new Date(event.start_time) > new Date() ? 'UP NEXT' : 'NOT STARTED YET')}
              </div>
              <h2>{event.title}</h2>
              {event.presenter && <p className="presenter">Presenter: {event.presenter}</p>}
              {event.location && <p className="location">Location: {event.location}</p>}
              {event.status === 'scheduled' && event.start_time && (
                <p className="time">Starts: {format(new Date(event.start_time), 'MMM dd, HH:mm')}</p>
              )}
              <p className="countdown">{countdowns[event.id] || (event.status === 'in_progress' ? '0h 0m 0s' : event.status === 'completed' ? 'Event has ended' : 'Calculating...')}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Home