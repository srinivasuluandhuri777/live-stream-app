# Supabase Storage Bucket Setup Guide

## Creating the `chat-images` Storage Bucket

Follow these steps to create a public storage bucket for chat images:

### Step 1: Navigate to Storage
1. Log in to your Supabase project dashboard
2. Click on **Storage** in the left sidebar

### Step 2: Create New Bucket
1. Click the **New bucket** button
2. Fill in the details:
   - **Name**: `chat-images`
   - **Public bucket**: Toggle this **ON** (important!)
   - Leave other settings as default
3. Click **Create bucket**

### Step 3: Set Up Storage Policies

After creating the bucket, you need to set up policies for public access:

#### Policy 1: Public Read Access
1. Click on the `chat-images` bucket
2. Go to the **Policies** tab
3. Click **New Policy**
4. Select **For full customization**
5. Configure:
   - **Policy name**: `Public Read Access`
   - **Allowed operation**: `SELECT`
   - **Policy definition**: 
     ```sql
     true
     ```
   - This allows anyone to read/view images
6. Click **Review** → **Save policy**

#### Policy 2: Authenticated Upload
1. Still in the **Policies** tab, click **New Policy** again
2. Select **For full customization**
3. Configure:
   - **Policy name**: `Authenticated Upload`
   - **Allowed operation**: `INSERT`
   - **Policy definition**:
     ```sql
     auth.role() = 'authenticated'
     ```
   - This allows only authenticated users to upload images
4. Click **Review** → **Save policy**

### Step 4: Verify Setup

Your bucket should now have:
- ✅ Public read access (anyone can view images)
- ✅ Authenticated upload access (only logged-in users can upload)

### Alternative: Using SQL

You can also create the bucket and policies using SQL in the SQL Editor:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true);

-- Allow public read access
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-images' 
  AND auth.role() = 'authenticated'
);
```

## Testing

To test if the bucket is set up correctly:

1. Try uploading an image through the chat interface
2. Check if the image URL is accessible without authentication
3. Verify that unauthenticated users cannot upload (should get an error)

