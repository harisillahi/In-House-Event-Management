-- Enable Realtime for events and attendees tables
-- Run this in your Supabase SQL Editor to fix real-time sync issues

-- Step 1: Check current realtime publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime';

-- Step 2: Add events and attendees tables to realtime publication
-- Note: If you get an error that the table already exists in the publication, that's OK - it means realtime is already enabled
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE events;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'events table already in publication';
  END;
  
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE attendees;
  EXCEPTION
    WHEN duplicate_object THEN
      RAISE NOTICE 'attendees table already in publication';
  END;
END $$;

-- Step 3: Verify both tables are now in the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename IN ('events', 'attendees');

-- Step 4: Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendees TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON attendees TO anon;

-- You should see both 'events' and 'attendees' in the results
-- This ensures realtime is properly enabled for both tables
