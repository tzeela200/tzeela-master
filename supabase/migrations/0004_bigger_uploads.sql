-- =====================================================================
-- צאלה — Migration 0004: files up to 50MB (was 20MB)
-- 50MB is the per-file maximum on the Supabase Free plan. Safe to re-run.
-- =====================================================================

update storage.buckets
set file_size_limit = 52428800
where id in ('uploads', 'outputs');
