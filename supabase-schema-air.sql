-- ============================================
-- Air Cargo Tables - Supabase Database Schema
-- Run this in your Supabase SQL Editor to add Air Cargo support
-- ============================================

-- ============================================
-- AIR_UPLOADS TABLE
-- Stores metadata about each Air CSV upload
-- ============================================
CREATE TABLE IF NOT EXISTS air_uploads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    filename TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster date ordering
CREATE INDEX IF NOT EXISTS idx_air_uploads_date ON air_uploads(upload_date DESC);

-- ============================================
-- AIR_REPORT_DATA TABLE
-- Stores individual rows from each Air CSV upload
-- ============================================
CREATE TABLE IF NOT EXISTS air_report_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    upload_id UUID NOT NULL REFERENCES air_uploads(id) ON DELETE CASCADE,
    mawb TEXT,
    hawb TEXT,
    consignee TEXT,
    carrier TEXT,
    flight_number TEXT,
    freight_location TEXT,
    origin TEXT,
    destination TEXT,
    file_number TEXT,
    qty TEXT,
    shipment_type TEXT,
    slac TEXT,
    weight TEXT,
    eta TEXT,
    eta_time TEXT,
    log TEXT,
    flt_date TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_air_report_data_upload ON air_report_data(upload_id);
CREATE INDEX IF NOT EXISTS idx_air_report_data_hawb ON air_report_data(hawb);
CREATE INDEX IF NOT EXISTS idx_air_report_data_mawb ON air_report_data(mawb);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR AIR TABLES
-- ============================================

-- Enable RLS on air tables
ALTER TABLE air_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_report_data ENABLE ROW LEVEL SECURITY;

-- Air Uploads policies
CREATE POLICY "Allow authenticated users to read air_uploads"
    ON air_uploads FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert air_uploads"
    ON air_uploads FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete air_uploads"
    ON air_uploads FOR DELETE
    TO authenticated
    USING (true);

-- Air Report data policies
CREATE POLICY "Allow authenticated users to read air_report_data"
    ON air_report_data FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated users to insert air_report_data"
    ON air_report_data FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete air_report_data"
    ON air_report_data FOR DELETE
    TO authenticated
    USING (true);

-- ============================================
-- DONE! Air cargo tables are ready.
-- ============================================
