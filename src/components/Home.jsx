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
  const [displayedEventsByLocation, setDisplayedEventsByLocation] = useState({})
  const [animationKey, setAnimationKey] = useState(0)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [weather, setWeather] = useState(null)
  const [forumName, setForumName] = useState(localStorage.getItem('forumName') || 'EventFlow.io')
  const eventRef = useRef([])
  const carouselIntervalRef = useRef(null)
  const eventsByLocationRef = useRef({})

  useEffect(() => {
    fetchEvents()
    fetchWeather()
    fetchForumName()
    
    // Polling mechanism - fetch every 5 seconds as fallback
    const pollInterval = setInterval(() => {
      fetchEvents()
    }, 5000)
    
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000)
    
    // Update weather every 10 minutes
    const weatherInterval = setInterval(() => {
      fetchWeather()
    }, 600000)
    
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

    // Real-time subscription for forum name changes
    const settingsChannel = supabase
      .channel('home_settings_realtime')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload) => {
          console.log('Home: Settings change received!', payload)
          fetchForumName()
        }
      )
      .subscribe()

    const interval = setInterval(() => {
      updateCountdowns()
    }, 1000)

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(settingsChannel)
      clearInterval(interval)
      clearInterval(pollInterval)
      clearInterval(clockInterval)
      clearInterval(weatherInterval)
      if (carouselIntervalRef.current) clearInterval(carouselIntervalRef.current)
    }
  }, [])

  useEffect(() => {
    eventRef.current = events
    
    // Group events by location
    const locationMap = new Map()
    events.forEach(event => {
      const location = event.location || 'No Location'
      if (!locationMap.has(location)) {
        locationMap.set(location, [])
      }
      locationMap.get(location).push(event)
    })
    
    // Store events by location in ref for carousel
    eventsByLocationRef.current = Object.fromEntries(locationMap)
    
    // Initialize displayed events - show first event per location (only if not already set)
    setDisplayedEventsByLocation(prev => {
      const newState = {}
      locationMap.forEach((eventsAtLocation, location) => {
        // Preserve existing index if it exists and is valid
        if (prev[location] !== undefined && prev[location] < eventsAtLocation.length) {
          newState[location] = prev[location]
        } else {
          newState[location] = 0
        }
      })
      return newState
    })
    
    updateCountdowns()
  }, [events])

  // Separate effect for carousel interval
  useEffect(() => {
    // Clear existing carousel interval
    if (carouselIntervalRef.current) {
      clearInterval(carouselIntervalRef.current)
      carouselIntervalRef.current = null
    }
    
    // Check if there are multiple events at any location
    const locationsData = eventsByLocationRef.current
    const hasMultiplePerLocation = Object.values(locationsData).some(arr => arr && arr.length > 1)
    
    console.log('Setting up carousel. Has multiple events per location:', hasMultiplePerLocation)
    console.log('Events by location:', locationsData)
    
    if (hasMultiplePerLocation && events.length > 0) {
      carouselIntervalRef.current = setInterval(() => {
        console.log('Carousel rotating...')
        setDisplayedEventsByLocation(prev => {
          const newState = { ...prev }
          Object.keys(newState).forEach(location => {
            const locEventsCount = eventsByLocationRef.current[location]?.length || 1
            if (locEventsCount > 1) {
              const newIndex = (newState[location] + 1) % locEventsCount
              console.log(`Location ${location}: ${newState[location]} -> ${newIndex}`)
              newState[location] = newIndex
            }
          })
          return newState
        })
        // Increment animation key to trigger re-render with animation
        setAnimationKey(prev => prev + 1)
      }, 10000) // Change every 10 seconds
      
      console.log('Carousel interval started')
    }
    
    return () => {
      if (carouselIntervalRef.current) {
        clearInterval(carouselIntervalRef.current)
      }
    }
  }, [events.length]) // Only re-run when the number of events changes, not on every update

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('cue_order', { ascending: true })
      
      if (error) throw error
      
      const now = new Date()
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000)
      
      // Filter: show in_progress events and upcoming events within 15 minutes
      const visibleEvents = data?.filter(e => {
        if (e.status === 'in_progress') return true
        if (e.status === 'scheduled' && e.start_time) {
          const startTime = new Date(e.start_time)
          return startTime >= now && startTime <= fifteenMinutesFromNow
        }
        return false
      }) || []
      
      // Group by location and get all visible events per location
      const locationMap = new Map()
      visibleEvents.forEach(event => {

  const fetchForumName = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'forumName')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        setForumName(data.value)
        localStorage.setItem('forumName', data.value)
      }
    } catch (error) {
      console.error('Error fetching forum name:', error)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('cue_order', { ascending: true })
      
      if (error) throw error
      
      const now = new Date()
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000)
      
      // Filter: show in_progress events and upcoming events within 15 minutes
      const visibleEvents = data?.filter(e => {
        if (e.status === 'in_progress') return true
        if (e.status === 'scheduled' && e.start_time) {
          const startTime = new Date(e.start_time)
          return startTime >= now && startTime <= fifteenMinutesFromNow
        }
        return false
      }) || []
      
      // Group by location and get all visible events per location
      const locationMap = new Map()
      visibleEvents.forEach(event => {
        const location = event.location || 'No Location'
        if (!locationMap.has(location)) {
          locationMap.set(location, [])
        }
        locationMap.get(location).push(event)
      })
      
      // Sort events within each location by cue_order and take them
      const displayEvents = []
      locationMap.forEach((locationEvents) => {
        locationEvents.sort((a, b) => (a.cue_order || 0) - (b.cue_order || 0))
        displayEvents.push(...locationEvents)
      })
      
      setEvents(displayEvents)
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  const fetchWeather = async () => {
    try {
      // Get user's location
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords
            // Using Open-Meteo API (free, no API key required)
            const response = await fetch(
              `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
            )
            const data = await response.json()
            setWeather(data.current_weather)
          },
          (error) => {
            console.log('Location access denied, using default location')
            // Fallback to a default location if user denies
            fetchWeatherByCity()
          }
        )
      } else {
        fetchWeatherByCity()
      }
    } catch (error) {
      console.error('Error fetching weather:', error)
    }
  }

  const fetchWeatherByCity = async () => {
    try {
      // Default to Berlin coordinates
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=52.52&longitude=13.41&current_weather=true&timezone=auto`
      )
      const data = await response.json()
      setWeather(data.current_weather)
    } catch (error) {
      console.error('Error fetching weather:', error)
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
          newCountdowns[event.id] = hours > 0 ? `+${hours}h ${minutes}m ${seconds}s` : `+${minutes}m ${seconds}s`
        } else {
          const diff = differenceInSeconds(end, now)
          const hours = Math.floor(diff / 3600)
          const minutes = Math.floor((diff % 3600) / 60)
          const seconds = diff % 60
          newCountdowns[event.id] = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`
        }
      } else if (event.status === 'scheduled' && event.start_time) {
        const start = new Date(event.start_time)
        const now = new Date()
        const diff = differenceInSeconds(start, now)
        
        if (diff > 0) {
          const hours = Math.floor(diff / 3600)
          const minutes = Math.floor((diff % 3600) / 60)
          const seconds = diff % 60
          newCountdowns[event.id] = hours > 0 ? `Starts in ${hours}h ${minutes}m ${seconds}s` : `Starts in ${minutes}m ${seconds}s`
        } else {
          newCountdowns[event.id] = 'Event not started yet'
        }
      }
    })

    setCountdowns(newCountdowns)
  }

  return (
    <div className="home-container">
      {weather && (
        <div className={`weather-animation ${
          weather.weathercode === 0 ? 'sunny' :
          weather.weathercode >= 1 && weather.weathercode <= 3 ? 'cloudy' :
          weather.weathercode >= 45 && weather.weathercode <= 48 ? 'foggy' :
          weather.weathercode >= 51 && weather.weathercode <= 67 ? 'rainy' :
          weather.weathercode >= 71 && weather.weathercode <= 77 ? 'snowy' :
          weather.weathercode >= 80 && weather.weathercode <= 99 ? 'stormy' : ''
        }`}>
          {(weather.weathercode >= 51 && weather.weathercode <= 99) && (
            <div className="rain-container">
              {[...Array(50)].map((_, i) => (
                <div key={i} className="rain" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${0.5 + Math.random() * 0.5}s`
                }}></div>
              ))}
            </div>
          )}
          {(weather.weathercode >= 71 && weather.weathercode <= 77) && (
            <div className="snow-container">
              {[...Array(50)].map((_, i) => (
                <div key={i} className="snow" style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${5 + Math.random() * 5}s`
                }}></div>
              ))}
            </div>
          )}
          {weather.weathercode === 0 && (
            <div className="sun-rays"></div>
          )}
        </div>
      )}
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
        {forumName}
      </h1>
      
      <div className="datetime-weather-widget">
        <div className="datetime-section">
          <div className="day-date">
            <div className="day">{format(currentDateTime, 'EEEE')}</div>
            <div className="date">{format(currentDateTime, 'MMMM d, yyyy')}</div>
          </div>
          <div className="clock">{format(currentDateTime, 'HH:mm')}</div>
        </div>
        {weather && (
          <div className="weather-section">
            <div className="temperature">{Math.round(weather.temperature)}°C</div>
            <div className="weather-info">
              <div className="weather-code">
                {weather.weathercode === 0 && '☀️ Clear'}
                {weather.weathercode >= 1 && weather.weathercode <= 3 && '⛅ Partly Cloudy'}
                {weather.weathercode >= 45 && weather.weathercode <= 48 && '🌫️ Foggy'}
                {weather.weathercode >= 51 && weather.weathercode <= 67 && '🌧️ Rainy'}
                {weather.weathercode >= 71 && weather.weathercode <= 77 && '❄️ Snowy'}
                {weather.weathercode >= 80 && weather.weathercode <= 99 && '⛈️ Stormy'}
              </div>
              <div className="wind-speed">{Math.round(weather.windspeed)} km/h</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="events-container">
        {events.length > 0 ? (
          // Group events by location and display one per location
          (() => {
            const locationMap = new Map()
            events.forEach(event => {
              const location = event.location || 'No Location'
              if (!locationMap.has(location)) {
                locationMap.set(location, [])
              }
              locationMap.get(location).push(event)
            })
            
            const displayEvents = []
            locationMap.forEach((locationEvents, location) => {
              const indexToDisplay = displayedEventsByLocation[location] || 0
              if (locationEvents[indexToDisplay]) {
                displayEvents.push(locationEvents[indexToDisplay])
              }
            })
            
            return displayEvents.map((event) => (
              <div key={`${event.location}-${animationKey}-${event.id}`} className="event-display fade-in">
                <div className={event.is_announcement ? 'announcement-event' : (event.status === 'in_progress' ? 'current-event' : 'next-event')}>
                    {!event.is_announcement && (
                    <div className={`event-status ${event.status === 'in_progress' ? 'in-progress' : event.status === 'completed' ? 'completed' : 'upcoming'}`}>
                      {event.status === 'in_progress' ? 'LIVE NOW' : 
                       event.status === 'completed' ? 'COMPLETED' :
                       (event.status === 'scheduled' && new Date(event.start_time) > new Date() ? 'UP NEXT' : 'NOT STARTED YET')}
                    </div>
                  )}
                  
                  {event.is_announcement ? (
                    <>
                      <div className="announcement-badge">ANNOUNCEMENT</div>
                      <p className="announcement-title">{event.title}</p>
                      <div className="announcement-content">{event.notes}</div>
                      <p className="announcement-time">
                        {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}
                      </p>
                    </>
                  ) : (
                    <>
                      <h2>{event.title}</h2>
                      {event.presenter && <p className="presenter">Presenter: {event.presenter}</p>}
                      {event.location && <p className="location">Location: {event.location}</p>}
                      {event.status === 'in_progress' && event.start_time && event.end_time && (
                        <p className="time">
                          {format(new Date(event.start_time), 'HH:mm')} - {format(new Date(event.end_time), 'HH:mm')}
                        </p>
                      )}
                      {event.status === 'scheduled' && event.start_time && (
                        <p className="countdown">{countdowns[event.id] || 'Calculating...'}</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          })()
        ) : (
          <div className="event-display">
            <p>No events scheduled</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home