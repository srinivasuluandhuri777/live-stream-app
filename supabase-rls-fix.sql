-- Fix RLS policies to allow public access to stream info
-- Run this in your Supabase SQL Editor

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view all live streams" ON stream_sessions;

-- Create new policy that allows public read access to all streams
-- (for viewers to see stream info, even if not live)
CREATE POLICY "Public can view stream info"
  ON stream_sessions FOR SELECT
  USING (true);

-- Note: The original policy only allowed viewing live streams or streams owned by the user
-- This new policy allows anyone to read stream info, which is needed for the viewer page
-- The frontend will still check is_live to determine if video should be shown

