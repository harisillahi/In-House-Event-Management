# Event Check-In App 📋

A real-time web-based event attendance tracking application with multi-device synchronization using Supabase.

## Features

- ✅ **Real-time Sync**: Multiple administrators can use the app simultaneously with instant data synchronization
- 👥 **Attendee Management**: Add, view, and manage event attendees
- ⏰ **Check-in Tracking**: Record check-in status with timestamps
- 🔍 **Search & Filter**: Search attendees by name/email and filter by check-in status
- 📊 **Statistics Dashboard**: View total, checked-in, and not-checked-in counts
- 📥 **CSV Export**: Export attendee data with status and check-in times
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Create a new project or use an existing one
3. Copy your project URL and anon key
4. Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

5. Update the `.env` file with your Supabase credentials:

```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### 3. Create the Database Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Create attendees table
CREATE TABLE attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  checked_in BOOLEAN DEFAULT false,
  check_in_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Enable all operations for all users" ON attendees
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable real-time
ALTER PUBLICATION supabase_realtime ADD TABLE attendees;
```

### 4. Run the App

```bash
npm run dev
```

The app will open automatically at `http://localhost:3000`

## Usage

### For Administrators

1. **Add Attendees**: Enter name and optional email, then click "Add Attendee"
2. **Check In**: Click the "✓ Check In" button when an attendee arrives
3. **Search**: Use the search bar to quickly find attendees
4. **Filter**: View all, checked-in, or not-checked-in attendees
5. **Export**: Click "📥 Export CSV" to download the attendee list with check-in data
6. **Multi-Device**: Open the app on multiple devices - all changes sync instantly!

### CSV Export Format

The exported CSV includes:
- Name
- Email
- Status (Checked In / Not Checked In)
- Check-in Time (timestamp in YYYY-MM-DD HH:MM:SS format)

## Tech Stack

- **Frontend**: React 18 with Vite
- **Database & Real-time**: Supabase
- **Styling**: Custom CSS with responsive design
- **Date Handling**: date-fns

## Security Notes

The current setup uses a permissive RLS policy for demonstration. For production:

1. Implement proper authentication
2. Update RLS policies to restrict access based on user roles
3. Add admin user management
4. Consider adding event management (multiple events)

## Troubleshooting

**"Missing Supabase credentials" error**: Make sure your `.env` file exists and contains valid credentials.

**Real-time not working**: Ensure you've enabled real-time for the `attendees` table in Supabase.

**Connection errors**: Check that your Supabase project is active and the URL/keys are correct.

## Future Enhancements

- User authentication for administrators
- Multiple event support
- QR code scanning for check-in
- Email notifications
- Analytics and reporting

## License

MIT
