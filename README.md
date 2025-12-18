# CSV Dock Tally

A modern web-based dashboard for uploading, viewing, and analyzing ocean carrier CSV reports. Track inventory changes between report versions, identify new items, removed items, and FRL status changes. Generate printable Dock Tally Reports grouped by MBL.

## Features

- ✅ **CSV Upload & Storage** - Upload ocean carrier CSV reports with 17 required columns
- ✅ **Master List** - Consolidated view that tracks all items (never removes)
- ✅ **Upload History** - Track all uploaded files with timestamps
- ✅ **Data Comparison** - Detect NEW items, REMOVED items, and newly FRL'd items
- ✅ **Filtering & Search** - Filter by FRL status, search by any field
- ✅ **Metrics Dashboard** - Quick stats with clickable metric cards
- ✅ **CSV Export** - Download filtered views as CSV
- 🆕 **Dock Tally Reports** - Generate printable reports grouped by MBL

## Tech Stack

- **Frontend**: React + Vite
- **Database**: Supabase (PostgreSQL)
- **Styling**: Modern CSS with glassmorphism and gradients
- **Icons**: Lucide React

## Setup

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to provision (~2 minutes)
3. Go to **Settings** → **API** and copy:
   - `Project URL`
   - `anon/public` key

### 2. Set Up Database

1. In Supabase, go to **SQL Editor**
2. Copy the contents of `supabase-schema.sql`
3. Run the SQL to create all tables and policies

### 3. Create Admin User

1. In Supabase, go to **Authentication** → **Users**
2. Click **Add User** → **Create New User**
3. Enter:
   - Email: `admin@yourcompany.com`
   - Password: `YourSecurePassword`
4. Click **Create User**

### 4. Configure Environment

1. Copy `.env.example` to `.env`
2. Fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Install & Run

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## CSV Requirements

Your CSV files must contain these 17 columns:

| Column | Description |
|--------|-------------|
| CONTAINER | Container number |
| SEAL # | Seal number |
| CARRIER | Carrier name |
| MBL | Master Bill of Lading |
| MI | M/I field |
| VESSEL | Vessel name |
| HB | House Bill (unique identifier) |
| OUTER QUANTITY | Outer quantity |
| PCS | Pieces count |
| WT_LBS | Weight in pounds |
| CNEE | Consignee |
| FRL | Freight Release date |
| FILE_NO | File number |
| DEST | Destination |
| VOLUME | Volume |
| VBOND# | V-Bond number |
| TDF | TDF date |

## Dock Tally Report

The Dock Tally Report feature generates printable reports grouped by MBL:

1. Click **Dock Report** button
2. Select which MBLs to include
3. Preview the report
4. Click **Print Report** to open print dialog

Each report shows:
- MB (Master Bill) number
- Container(s)
- List of HBs with Destinations
- MFST Quantities (Outer Quantity / PCS)
- Empty columns for manual entry (PCS, LOC, TIME, DMG, CRW)

## License

© 2024 Global CFS, Inc.
