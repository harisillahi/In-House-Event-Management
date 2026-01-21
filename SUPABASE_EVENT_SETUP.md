# Event Management Database Setup

Run this SQL in your Supabase SQL Editor to create the events table:

```sql
-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration INTEGER, -- in minutes
  status TEXT DEFAULT 'scheduled', -- scheduled, in_progress, completed, cancelled
  cue_order INTEGER NOT NULL,
  color TEXT DEFAULT '#007bff',
  presenter TEXT,
  location TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for ordering
CREATE INDEX IF NOT EXISTS events_cue_order_idx ON public.events(cue_order);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Enable all access for events" ON public.events
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_events_updated_at 
  BEFORE UPDATE ON public.events 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

After creating the table, enable Realtime:
1. Go to Database → Replication in Supabase dashboard
2. Enable replication for the `events` table
