-- ============================================
-- Migration: Fix Foreign Key Constraints for Cascade Delete
-- Run this in your Supabase SQL Editor
-- ============================================

-- Drop existing foreign key constraints on master_list
ALTER TABLE master_list
DROP CONSTRAINT IF EXISTS master_list_first_seen_upload_id_fkey;

ALTER TABLE master_list
DROP CONSTRAINT IF EXISTS master_list_last_updated_upload_id_fkey;

-- Re-add foreign key constraints with SET NULL on delete
-- This way, when an upload is deleted, the references are set to NULL instead of blocking
ALTER TABLE master_list
ADD CONSTRAINT master_list_first_seen_upload_id_fkey
FOREIGN KEY (first_seen_upload_id)
REFERENCES uploads(id)
ON DELETE SET NULL;

ALTER TABLE master_list
ADD CONSTRAINT master_list_last_updated_upload_id_fkey
FOREIGN KEY (last_updated_upload_id)
REFERENCES uploads(id)
ON DELETE SET NULL;

-- ============================================
-- DONE! You can now delete uploads without errors.
-- Master list items will have their upload references set to NULL.
-- ============================================
