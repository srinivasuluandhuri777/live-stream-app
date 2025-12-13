-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stream sessions table
CREATE TABLE stream_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  is_live BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stream chat table
CREATE TABLE stream_chat (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stream viewers table
CREATE TABLE stream_viewers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Stream likes table
CREATE TABLE stream_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id UUID NOT NULL REFERENCES stream_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_stream_sessions_host_id ON stream_sessions(host_id);
CREATE INDEX idx_stream_sessions_is_live ON stream_sessions(is_live);
CREATE INDEX idx_stream_chat_stream_id ON stream_chat(stream_id);
CREATE INDEX idx_stream_chat_created_at ON stream_chat(created_at);
CREATE INDEX idx_stream_viewers_stream_id ON stream_viewers(stream_id);
CREATE INDEX idx_stream_likes_stream_id ON stream_likes(stream_id);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stream_likes ENABLE ROW LEVEL SECURITY;

-- Stream sessions policies
CREATE POLICY "Users can view all live streams"
  ON stream_sessions FOR SELECT
  USING (is_live = true OR auth.uid() = host_id);

CREATE POLICY "Users can create their own streams"
  ON stream_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "Users can update their own streams"
  ON stream_sessions FOR UPDATE
  USING (auth.uid() = host_id);

CREATE POLICY "Users can delete their own streams"
  ON stream_sessions FOR DELETE
  USING (auth.uid() = host_id);

-- Stream chat policies
CREATE POLICY "Anyone can view chat for live streams"
  ON stream_chat FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stream_sessions
      WHERE stream_sessions.id = stream_chat.stream_id
      AND stream_sessions.is_live = true
    )
  );

CREATE POLICY "Authenticated users can send chat messages"
  ON stream_chat FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Stream viewers policies
CREATE POLICY "Anyone can view viewer list for live streams"
  ON stream_viewers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stream_sessions
      WHERE stream_sessions.id = stream_viewers.stream_id
      AND stream_sessions.is_live = true
    )
  );

CREATE POLICY "Authenticated users can join as viewers"
  ON stream_viewers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove themselves as viewers"
  ON stream_viewers FOR DELETE
  USING (auth.uid() = user_id);

-- Stream likes policies
CREATE POLICY "Anyone can view likes for live streams"
  ON stream_likes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stream_sessions
      WHERE stream_sessions.id = stream_likes.stream_id
      AND stream_sessions.is_live = true
    )
  );

CREATE POLICY "Authenticated users can like streams"
  ON stream_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike streams"
  ON stream_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for stream_sessions
CREATE TRIGGER update_stream_sessions_updated_at
  BEFORE UPDATE ON stream_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

