# Event Check-In App 📋

A real-time web-based event attendance tracking application with multi-device synchronization and role-based access using Supabase.

## Features

- ✅ **Real-time Sync**: Multiple users can use the app simultaneously with instant data synchronization
- 🔐 **Role-Based Access**: Separate checker and admin modes with password protection
- 👥 **Attendee Management**: Add, view, and manage event attendees (Admin only)
- ⏰ **Check-in Tracking**: Record check-in status with timestamps
- 📷 **QR Code Scanning**: Quick check-in using QR codes
- 🔍 **Search & Filter**: Search attendees by name/email/company and filter by check-in status
- 📊 **Statistics Dashboard**: View total, checked-in, and not-checked-in counts
- 📥 **CSV Import/Export**: Bulk import attendees and export data with status (Admin only)
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices

## Access Modes

### Check-In Mode (/)
- **URL**: `your-domain.com/`
- **Access**: Public - no password required
- **Features**: Check-in/undo, search, view attendee list
- **Use Case**: For check-in helpers at event entrance

### Admin Mode (/admin)
- **URL**: `your-domain.com/admin`
- **Access**: Password protected
- **Features**: Full access - add/delete attendees, CSV import/export, check-in
- **Use Case**: For data master managing the attendee list

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
VITE_ADMIN_PASSWORD=your_secure_admin_password
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

### Usage Workflow

**Before the Event (Data Master):**
1. Access `/admin` with password
2. Upload CSV with attendee list or add manually
3. Export and verify data

**During the Event:**
1. Check-in helpers use `/` (no password needed)
2. Data master monitors `/admin` for issues
3. All changes sync in real-time

**After the Event:**
1. Data master exports final CSV from `/admin`
2. Review check-in data and timestamps

### CSV Export Format

The exported CSV includes:
- Name
- Email
- Company
- Status (Checked In / Not Checked In)
- Check-in Time (timestamp in YYYY-MM-DD HH:MM:SS format)

## Deployment to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSWORD` (use a strong password for production)
4. Deploy!

**URLs after deployment:**
- Check-in mode: `your-app.vercel.app/`
- Admin login: `your-app.vercel.app/admin/login`
- Admin panel: `your-app.vercel.app/admin`

## Tech Stack

- **Frontend**: React 18 with Vite
- **Routing**: React Router v6
- **Database & Real-time**: Supabase
- **Styling**: Custom CSS with responsive design
- **Date Handling**: date-fns
- **QR Scanning**: html5-qrcode

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
