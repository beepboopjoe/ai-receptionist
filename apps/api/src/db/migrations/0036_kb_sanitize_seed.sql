-- First-run UX: drop the known failing seed document and scrub leaked
-- vendor errors from kb_documents. Never delete user uploads with other names.

DELETE FROM kb_chunks
WHERE document_id IN (
  SELECT id FROM kb_documents WHERE filename = 'test-kb-upload.txt'
);

DELETE FROM kb_documents WHERE filename = 'test-kb-upload.txt';

UPDATE kb_documents
SET error_message = 'Document processing unavailable — contact support. You can try Reprocess.'
WHERE error_message IS NOT NULL
  AND (
    error_message ILIKE '%openai%'
    OR error_message ILIKE '%api key%'
    OR error_message ILIKE '%sk-%'
    OR error_message ILIKE '%embeddings call failed%'
    OR error_message ILIKE '%integration error%'
  );
