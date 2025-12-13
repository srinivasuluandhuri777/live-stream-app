# Authentication Setup

## Overview

The app uses **Supabase Authentication** with email/password login. It works with your existing Supabase project.

## Features

- ✅ Email/password authentication
- ✅ Sign up and sign in
- ✅ Protected routes (dashboard, host pages)
- ✅ Public viewer pages (no login required to watch)
- ✅ Auth tokens used for all API calls
- ✅ Socket.IO authentication for WebRTC signaling

## Setup

### 1. Supabase Configuration

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers** → **Email**
3. Ensure **Enable Email provider** is ON
4. (Optional) Configure email templates

### 2. Environment Variables

**Frontend (.env):**
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Backend (.env):**
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### 3. Database Setup

Run the SQL scripts in your Supabase SQL Editor:
- `supabase-schema.sql` - Creates tables and RLS policies
- `supabase-storage-setup.sql` - Creates chat-images bucket

## How It Works

### Frontend
- Login page at `/login` with email/password form
- Auth state managed by Zustand store
- Protected routes redirect to `/login` if not authenticated
- Auth tokens included in all API requests
- Socket.IO connections authenticated with Supabase tokens

### Backend
- Auth middleware validates Supabase JWT tokens
- All stream operations require authentication
- User ID extracted from token for database operations
- Socket.IO middleware validates tokens for WebRTC connections

### Viewer Access
- Viewers can watch streams without authentication (`/watch/:streamId`)
- Chat and likes require authentication (optional for viewers)
- Host operations always require authentication

## User Flow

1. **New User:**
   - Visit `/login`
   - Click "Don't have an account? Sign up"
   - Enter email and password (min 6 characters)
   - Account created and automatically signed in
   - Redirected to `/dashboard`

2. **Existing User:**
   - Visit `/login`
   - Enter email and password
   - Signed in and redirected to `/dashboard`

3. **Session Management:**
   - Sessions persist across page refreshes
   - Auto-logout on token expiration
   - Logout button in dashboard header

## Security Notes

- Passwords hashed by Supabase
- JWT tokens validated on every request
- RLS policies enforce data access control
- Service role key only used on backend (never exposed to frontend)

