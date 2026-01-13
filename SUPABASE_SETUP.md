# 🔧 Supabase Setup Instructions

Follow these steps to configure your Event Check-In app with Supabase.

---

## Step 1: Get Your Supabase Credentials

### If you already have a Supabase project:

1. Go to [https://app.supabase.com/](https://app.supabase.com/)
2. Sign in and select your project
3. Click on the **Settings** icon (⚙️) in the left sidebar
4. Click on **API** in the settings menu
5. You'll see two important values:
   - **Project URL** (example: `https://abcdefghijklm.supabase.co`)
   - **anon public** key (under "Project API keys" section)

### If you need to create a new Supabase project:

1. Go to [https://app.supabase.com/](https://app.supabase.com/)
2. Click **"New Project"**
3. Choose your organization (or create one)
4. Fill in:
   - **Name**: EventCheckIn (or any name you prefer)
   - **Database Password**: Create a strong password (save it somewhere safe!)
   - **Region**: Choose the closest region to your users
5. Click **"Create new project"**
6. Wait 2-3 minutes for the project to be created
7. Once ready, go to **Settings** → **API** to find your credentials

---

## Step 2: Update Your .env File

1. Open the `.env` file in the project root
2. Replace the placeholder values with your actual credentials:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **Important**: Never commit the `.env` file to git! It's already in `.gitignore`.

---

## Step 3: Create the Database Table

1. In your Supabase dashboard, click on **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Copy and paste this SQL code:

```sql
-- Create the attendees table
CREATE TABLE attendees (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  company TEXT,
  checked_in BOOLEAN DEFAULT false,
  check_in_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index to prevent duplicate emails (when email is provided)
CREATE UNIQUE INDEX unique_email_when_provided ON attendees (LOWER(email)) WHERE email IS NOT NULL AND email != '';

-- Enable Row Level Security (RLS)
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations
-- Note: For production, you should implement proper authentication and stricter policies
CREATE POLICY "Enable all operations for all users" ON attendees
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

4. Click **"Run"** or press `Ctrl/Cmd + Enter`
5. You should see "Success. No rows returned"

**Note:** The unique index on email ensures that no duplicate emails can be added, even when multiple administrators are adding attendees simultaneously.

---

## Step 4: Enable Real-Time Subscriptions

1. In your Supabase dashboard, click on **Database** in the left sidebar
2. Click on **Replication** in the submenu
3. Find the `attendees` table in the list
4. Toggle the switch to **enable** real-time for the `attendees` table
5. The toggle should turn green/blue when enabled

**Alternative method via SQL:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE attendees;
```

---

## Step 5: Verify Setup

1. In Supabase, go to **Table Editor**
2. You should see the `attendees` table listed
3. Click on it to view the empty table structure
4. Verify these columns exist:
   - `id` (uuid)
   - `name` (text)
   - `email` (text)   - `company` (text)   - `checked_in` (boolean)
   - `check_in_time` (timestamptz)
   - `created_at` (timestamptz)

---

## Step 6: Test the App

1. In your terminal, run:
   ```bash
   npm run dev
   ```

2. The app should open at `http://localhost:3000`

3. Try adding an attendee - if successful, check your Supabase Table Editor to see the data

4. Open the app in another browser tab or device with the same URL to test real-time sync!

---

## 🎉 You're Done!

Your Event Check-In app is now connected to Supabase and ready to use!

### Testing Real-Time Sync:
1. Open the app in two different browser windows side-by-side
2. Add an attendee in one window
3. Watch it appear instantly in the other window
4. Check someone in from one window
5. See the status update in real-time in the other window

---

## 🔒 Security Notes for Production

The current setup uses a permissive RLS policy that allows anyone to read/write data. For production use:

1. **Enable Authentication**:
   ```sql
   -- Remove the permissive policy
   DROP POLICY "Enable all operations for all users" ON attendees;
   
   -- Add authenticated-only policy
   CREATE POLICY "Enable operations for authenticated users only" ON attendees
     FOR ALL
     USING (auth.role() = 'authenticated')
     WITH CHECK (auth.role() = 'authenticated');
   ```

2. **Implement user authentication** in your app using Supabase Auth

3. **Add admin roles** to restrict who can add/delete attendees

---

## 🆘 Troubleshooting

**Error: "Missing Supabase credentials"**
- Make sure your `.env` file exists and has the correct values
- Restart the dev server after updating `.env`

**Real-time not working:**
- Verify real-time is enabled for the `attendees` table in Supabase
- Check browser console for any error messages

**Can't connect to Supabase:**
- Verify your Supabase project is active (not paused)
- Check that the URL and anon key are correct
- Ensure there are no extra spaces in the `.env` file

**Table not found error:**
- Make sure you ran the SQL to create the table
- Verify the table name is exactly `attendees` (lowercase)

Need help? Check the [Supabase Documentation](https://supabase.com/docs) or visit their [Discord community](https://discord.supabase.com/).
