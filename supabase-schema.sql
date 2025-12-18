-- ============================================
-- CSV Dock Tally - Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- UPLOADS TABLE
-- Stores metadata about each CSV upload
-- ============================================
CREATE TABLE IF NOT EXISTS uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster date ordering
CREATE INDEX IF NOT EXISTS idx_uploads_date ON uploads(upload_date DESC);

-- ============================================
-- REPORT_DATA TABLE
-- Stores individual rows from each CSV upload
-- ============================================
CREATE TABLE IF NOT EXISTS report_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    upload_id UUID NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    container TEXT,
    seal_number TEXT,
    carrier TEXT,
    mbl TEXT,
    mi TEXT,
    vessel TEXT,
    hb TEXT,
    outer_quantity TEXT,
    pcs TEXT,
    wt_lbs TEXT,
    cnee TEXT,
    frl TEXT,
    file_no TEXT,
    dest TEXT,
    volume TEXT,
    vbond TEXT,
    tdf TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_report_data_upload ON report_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_report_data_hb ON report_data(hb);
CREATE INDEX IF NOT EXISTS idx_report_data_mbl ON report_data(mbl);

-- ============================================
-- MASTER_LIST TABLE
-- Consolidated data that tracks all items
-- HB is unique - items are only added/updated
-- ============================================
CREATE TABLE IF NOT EXISTS master_list (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    container TEXT,
    seal_number TEXT,
    carrier TEXT,
    mbl TEXT,
    mi TEXT,
    vessel TEXT,
    hb TEXT UNIQUE,
    outer_quantity TEXT,
    pcs TEXT,
    wt_lbs TEXT,
    cnee TEXT,
    frl TEXT,
    file_no TEXT,
    dest TEXT,
    volume TEXT,
    vbond TEXT,
    tdf TEXT,
    first_seen_upload_id UUID REFERENCES uploads(id),
    last_updated_upload_id UUID REFERENCES uploads(id),
    last_update_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for master_list
CREATE INDEX IF NOT EXISTS idx_master_list_hb ON master_list(hb);
CREATE INDEX IF NOT EXISTS idx_master_list_mbl ON master_list(mbl);
CREATE INDEX IF NOT EXISTS idx_master_list_first_seen ON master_list(first_seen_upload_id);
CREATE INDEX IF NOT EXISTS idx_master_list_last_updated ON master_list(last_updated_upload_id);

-- ============================================
-- REMOVED_ITEMS_HISTORY TABLE
-- Tracks items that were removed from uploads
-- ============================================
CREATE TABLE IF NOT EXISTS removed_items_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    hb TEXT,
    container TEXT,
    seal_number TEXT,
    carrier TEXT,
    mbl TEXT,
    mi TEXT,
    vessel TEXT,
    outer_quantity TEXT,
    pcs TEXT,
    wt_lbs TEXT,
    cnee TEXT,
    frl TEXT,
    file_no TEXT,
    dest TEXT,
    volume TEXT,
    vbond TEXT,
    tdf TEXT,
    last_seen_upload_id UUID REFERENCES uploads(id),
    removed_at_upload_id UUID REFERENCES uploads(id),
    last_seen_date TIMESTAMPTZ,
    removed_at_date TIMESTAMPTZ DEFAULT NOW()
);

-- Index for removed items
CREATE INDEX IF NOT EXISTS idx_removed_items_hb ON removed_items_history(hb);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Enable for production security
-- ============================================

-- Enable RLS on all tables
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE removed_items_history ENABLE ROW LEVEL SECURITY;

-- Create policies to allow authenticated users full access
-- (Adjust these policies based on your security requirements)

-- Uploads policies
CREATE POLICY "Allow authenticated users to read uploads" 
    ON uploads FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to insert uploads" 
    ON uploads FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete uploads" 
    ON uploads FOR DELETE 
    TO authenticated 
    USING (true);

-- Report data policies
CREATE POLICY "Allow authenticated users to read report_data" 
    ON report_data FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to insert report_data" 
    ON report_data FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete report_data" 
    ON report_data FOR DELETE 
    TO authenticated 
    USING (true);

-- Master list policies
CREATE POLICY "Allow authenticated users to read master_list" 
    ON master_list FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to insert master_list" 
    ON master_list FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update master_list" 
    ON master_list FOR UPDATE 
    TO authenticated 
    USING (true);

-- Removed items history policies
CREATE POLICY "Allow authenticated users to read removed_items_history" 
    ON removed_items_history FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow authenticated users to insert removed_items_history" 
    ON removed_items_history FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- ============================================
-- DONE! Your database is ready.
-- ============================================
