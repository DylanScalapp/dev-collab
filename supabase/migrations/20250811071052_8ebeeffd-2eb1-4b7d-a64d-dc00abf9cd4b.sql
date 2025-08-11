-- Create storage policies for project-files bucket
CREATE POLICY "Users can upload files in project-files bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'project-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view files in project-files bucket" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'project-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update their own files in project-files bucket" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'project-files' 
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their own files in project-files bucket" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'project-files' 
  AND auth.uid() IS NOT NULL
);