-- Public Grok catalog default is aurora (castor / cosmo / zenith also offered).
-- Do NOT rewrite existing tenant_settings.voice_name rows — legacy IDs
-- (eve / ara / rex / sal / leo) remain valid for live calls.

ALTER TABLE tenant_settings ALTER COLUMN voice_name SET DEFAULT 'aurora';
