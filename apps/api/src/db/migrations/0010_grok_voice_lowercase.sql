-- xAI Voice Agent API renamed voices to lowercase ('eve', 'ara', 'rex',
-- 'sal', 'leo'). Migrate any existing tenant_settings rows that still
-- store the old capitalized names. Also flip the column default so new
-- tenants get the recommended 'eve' voice.

UPDATE tenant_settings
   SET voice_name = LOWER(voice_name)
 WHERE voice_name IN ('Ara', 'Rex', 'Sal', 'Eve', 'Leo');

ALTER TABLE tenant_settings ALTER COLUMN voice_name SET DEFAULT 'eve';
