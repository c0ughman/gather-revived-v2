/*
  # Setup Supabase Storage for File Uploads
  
  This migration sets up storage buckets and policies for:
  - Agent avatars
  - Document uploads
  - Message attachments
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('avatars', 'avatars', true),
  ('documents', 'documents', false),
  ('attachments', 'attachments', false);

-- =============================================
-- STORAGE POLICIES
-- =============================================

-- Avatar storage policies (public read, authenticated write)
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatar images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own avatar images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own avatar images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Document storage policies (private)
CREATE POLICY "Users can view own documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Attachment storage policies (private)
CREATE POLICY "Users can view own attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'attachments' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can upload attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'attachments' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own attachments" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'attachments' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'attachments' 
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );