
-- Create policy to allow public read access (so anyone can download PDFs via WhatsApp links)
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'bills');

-- Create policy to allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bills' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update files
CREATE POLICY "Authenticated users can update" ON storage.objects
FOR UPDATE USING (bucket_id = 'bills' AND auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete files  
CREATE POLICY "Authenticated users can delete" ON storage.objects
FOR DELETE USING (bucket_id = 'bills' AND auth.role() = 'authenticated');
