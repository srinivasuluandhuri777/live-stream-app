# Aroha Live Streaming App

Full-stack live streaming application with WebRTC, Mediasoup, Socket.IO, and Supabase.

## Project Structure

```
aroha-fresh-app/
├── mcp-server/          # Backend (Node.js + Mediasoup + Socket.IO)
│   ├── src/
│   │   ├── index.js
│   │   ├── mediasoup/
│   │   ├── routes/
│   │   └── middleware/
│   └── package.json
├── frontend/            # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── store/
│   └── package.json
└── supabase-schema.sql  # Database schema
```

## Setup

### 1. Backend Setup

```bash
cd mcp-server
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm start
```

### 2. Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your Supabase credentials
npm run dev
```

### 3. Database Setup

1. Use your existing Supabase project or create a new one at https://supabase.com
2. Run `supabase-schema.sql` in the SQL editor (Dashboard → SQL Editor → New Query)
3. Run `supabase-storage-setup.sql` to create the `chat-images` storage bucket
4. Ensure Email authentication is enabled:
   - Go to **Authentication** → **Providers** → **Email**
   - Toggle **Enable Email provider** ON
   - Save changes
   - Go to **Storage** in the Supabase dashboard
   - Click **New bucket**
   - Name: `chat-images`
   - **Public bucket**: Toggle ON (this makes it publicly accessible)
   - Click **Create bucket**
   - After creation, go to **Policies** tab for the bucket
   - Click **New Policy** → **For full customization**
   - Policy name: `Public Access`
   - Allowed operation: `SELECT` (for reading)
   - Policy definition: `true` (allows everyone to read)
   - Click **Review** → **Save policy**
   - Add another policy for `INSERT`:
     - Policy name: `Authenticated Upload`
     - Allowed operation: `INSERT`
     - Policy definition: `auth.role() = 'authenticated'` (only authenticated users can upload)
     - Click **Review** → **Save policy**

### 4. Environment Variables

**Backend (.env):**
- `PORT=4000`
- `FRONTEND_URL=http://localhost:3000`
- `SUPABASE_URL=your_supabase_url`
- `SUPABASE_SERVICE_KEY=your_supabase_service_key` (for auth validation)
- `SUPABASE_ANON_KEY=your_supabase_anon_key` (for RLS operations with user tokens)
- `MEDIASOUP_NUM_WORKERS=1`
- `MEDIASOUP_LISTEN_IP=127.0.0.1`

**Frontend (.env):**
- `VITE_SUPABASE_URL=your_supabase_url`
- `VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`
- `VITE_SOCKET_URL=http://localhost:4000`
- `VITE_API_URL=http://localhost:4000`

## Features

### Host
- Login with email and password (Supabase Auth)
- Create and schedule streams
- Start/stop streaming
- Pause/resume video and mute/unmute audio
- Real-time chat
- Viewer count
- Copy viewer link

### Viewer
- Watch live streams via WebRTC
- Real-time chat
- Like/react to streams
- Viewer count

## Tech Stack

- **Backend:** Node.js, Express, Mediasoup, Socket.IO, Supabase
- **Frontend:** React, Vite, Tailwind CSS, Zustand
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Streaming:** WebRTC (Mediasoup), FFmpeg for RTMP restreaming

