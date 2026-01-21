# Event Management System

A real-time web-based application for managing event registrations and event rundowns with multi-device synchronization using Supabase.

## Features

### Registration Management
- Real-time attendee registration with multi-device sync
- QR code check-in system
- CSV import/export functionality
- Search and filter attendees
- Check-in tracking with timestamps
- Statistics dashboard

### Event Management
- Event rundown and scheduling
- Real-time event status tracking (scheduled, in progress, completed)
- Event cueing system with reordering
- Start/stop/complete event controls
- Event details: title, description, presenter, location, times
- Color coding for events
- Search and filter events by status
- Multi-device synchronization

## Access

The application has two password-protected sections:

1. **Registration** (password: `registration123`)
   - Manage attendees and check-ins
   
2. **Event Management** (password: `event123`)
   - Manage event schedules and rundowns

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

2. Update the `.env` file with your credentials:

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Create the Database Tables

#### Attendees Table

Run this SQL in your Supabase SQL Editor (or use SUPABASE_SETUP.md):

```sql
-- Create attendees table
CREATE TABLE attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  checked_in BOOLEAN DEFAULT false,
  check_in_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Enable all operations for all users" ON attendees
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

#### Events Table

Run this SQL in your Supabase SQL Editor (or use SUPABASE_EVENT_SETUP.md):

```sql
-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration INTEGER,
  status TEXT DEFAULT 'scheduled',
  cue_order INTEGER NOT NULL,
  color TEXT DEFAULT '#007bff',
  presenter TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS events_cue_order_idx ON public.events(cue_order);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for events" ON public.events
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

### 4. Enable Realtime in Supabase

1. Go to Database → Replication in your Supabase dashboard
2. Enable replication for both `attendees` and `events` tables

### 5. Run the App

```bash
npm run dev
```

The app will open automatically at `http://localhost:5173`

## Usage

### Registration Section

1. **Add Attendees**: Enter name, email, and company
2. **Check In**: Click "Check In" when attendees arrive
3. **Search**: Use the search bar to quickly find attendees
4. **Filter**: View all, checked-in, or not-checked-in attendees
5. **CSV Import/Export**: Import attendee lists or export data
6. **QR Code Scanning**: Scan QR codes for quick check-in

### Event Management Section

1. **Add Events**: Click "Show Add Event Form" and fill in event details
2. **Schedule Events**: Set start time, end time, presenter, and location
3. **Reorder Events**: Use up/down arrows to change event order in the rundown
4. **Start Events**: Click "Start" when an event begins
5. **Complete Events**: Click "Complete" when an event finishes
6. **Edit Events**: Click "Edit" to modify event details
7. **Filter Events**: View all, scheduled, in-progress, or completed events

## Technology Stack

- **Frontend**: React 18 with Vite
- **Database**: Supabase (PostgreSQL)
- **Real-time Sync**: Supabase Realtime
- **Styling**: CSS with responsive design
- **QR Scanning**: html5-qrcode
- **Date Formatting**: date-fns

## Project Structure

```
EventCheckIn/
├── src/
│   ├── components/
│   │   ├── Home.jsx              # Landing page with menu
│   │   ├── Login.jsx              # Password authentication
│   │   ├── ProtectedRoute.jsx    # Route protection
│   │   ├── Registration.jsx      # Attendee management
│   │   ├── EventManagement.jsx   # Event rundown system
│   │   └── *.css                 # Component styles
│   ├── App.jsx                   # Main router
│   ├── supabaseClient.js         # Supabase configuration
│   └── main.jsx                  # Entry point
├── SUPABASE_SETUP.md             # Attendees table setup
├── SUPABASE_EVENT_SETUP.md       # Events table setup
└── README.md                     # Documentation
```

## Real-time Synchronization

All changes in both Registration and Event Management sections sync instantly across all devices using Supabase Realtime. Multiple users can work simultaneously without conflicts.

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy

## License

MIT


## Security Notes

- Admin password is stored in environment variable (not in code)
- Session-based admin authentication (clears on browser close)
- `.env` file is git-ignored to protect credentials
- For production: Use strong admin password and consider Supabase Auth for better security

## Troubleshooting

**"Missing Supabase credentials" error**: Make sure your `.env` file exists and contains valid credentials.

**Real-time not working**: Ensure you've enabled real-time for the `attendees` table in Supabase.

**Can't access admin panel**: Make sure `VITE_ADMIN_PASSWORD` is set in your environment variables.

**QR scanner not working**: Ensure HTTPS is enabled (required for camera access) and camera permissions are granted.

**Connection errors**: Check that your Supabase project is active and the URL/keys are correct.

## Future Enhancements

- User authentication for administrators
- Multiple event support
- QR code scanning for check-in
- Email notifications
- Analytics and reporting

## License

MIT
