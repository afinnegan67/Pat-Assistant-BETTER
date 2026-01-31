-- ============================================================
-- Migration: Add approval workflow to voice_transcripts
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add new columns for approval workflow
ALTER TABLE voice_transcripts
ADD COLUMN IF NOT EXISTS pending_approval boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS processing_result jsonb;

-- Step 2: Enable the pg_net extension (for HTTP calls from triggers)
-- This may already be enabled in your Supabase project
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 3: Set the webhook secret as a database setting
-- Replace 'your-secret-here' with a secure random string
-- You'll also need to add this as SUPABASE_WEBHOOK_SECRET in Vercel
ALTER DATABASE postgres SET app.webhook_secret = 'your-secret-here';

-- Step 4: Create the trigger function
-- IMPORTANT: Replace 'YOUR_VERCEL_URL' with your actual Vercel deployment URL
CREATE OR REPLACE FUNCTION notify_transcript_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire for new transcripts (not updates)
  IF TG_OP = 'INSERT' THEN
    -- Call the processing endpoint via pg_net
    PERFORM net.http_post(
      url := 'https://YOUR_VERCEL_URL/api/process-transcript',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-supabase-webhook-secret', current_setting('app.webhook_secret', true)
      ),
      body := jsonb_build_object('transcript_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create the trigger (drop first if exists)
DROP TRIGGER IF EXISTS on_transcript_created ON voice_transcripts;
CREATE TRIGGER on_transcript_created
  AFTER INSERT ON voice_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION notify_transcript_created();

-- ============================================================
-- To verify the setup:
-- 1. Insert a test record and check if your /api/process-transcript endpoint is called
-- 2. Check the net._http_response table for any HTTP errors
-- ============================================================
