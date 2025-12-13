# RLS Policy Fix

## Issue
When creating streams via `/api/streams/create`, you were getting:
```
"new row violates row-level security policy for table \"stream_sessions\""
```

## Root Cause
The backend was using the Supabase **service role key** for all database operations. However, Row Level Security (RLS) policies check `auth.uid()` which is only available when using a user's access token, not the service role key.

## Solution
Updated the backend routes to:
1. Extract the user's access token from the Authorization header
2. Create a Supabase client using the user's token (with anon key)
3. Use this client for database operations so RLS policies can identify the authenticated user

## Changes Made

### `mcp-server/src/routes/streams.js`
- Added `getUserSupabase()` helper function that creates a Supabase client with user's access token
- Updated all routes (`/create`, `/:streamId/start`, `/:streamId/stop`, `/host/list`) to use user's token
- This ensures RLS policies can check `auth.uid() = host_id` correctly

### Environment Variables
Added `SUPABASE_ANON_KEY` to backend `.env`:
- Used to create Supabase clients that respect RLS policies
- Service role key is still used for auth validation in middleware

## How It Works Now

1. Frontend sends request with `Authorization: Bearer <user_access_token>`
2. Backend middleware validates token using service role key
3. Backend routes create a new Supabase client with user's token
4. Database operations use user's token, so RLS policies work correctly
5. `auth.uid()` in RLS policies now correctly identifies the user

## Testing
After updating your `.env` file with `SUPABASE_ANON_KEY`, the stream creation should work without RLS errors.

