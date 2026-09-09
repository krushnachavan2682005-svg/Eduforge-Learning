ALTER TABLE ai_documents
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS current_processing_job_id UUID;
