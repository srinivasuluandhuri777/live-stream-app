-- Create the chat-images storage bucket with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-images',
  'chat-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public read access to all images
CREATE POLICY IF NOT EXISTS "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- Policy: Allow authenticated users to upload images
CREATE POLICY IF NOT EXISTS "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' 
  AND auth.role() = 'authenticated'
);

-- Policy: Allow users to delete their own uploads
CREATE POLICY IF NOT EXISTS "Users can delete own uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

