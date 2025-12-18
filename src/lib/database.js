/**
 * Database operations for CSV Dock Tally application
 */

import { supabase } from './supabase';

/**
 * UPLOADS TABLE OPERATIONS
 */

export async function saveUpload(filename, rowCount) {
    const { data, error } = await supabase
        .from('uploads')
        .insert({
            filename,
            row_count: rowCount,
            upload_date: new Date().toISOString(),
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving upload:', error);
        return null;
    }
    return data;
}

export async function getAllUploads() {
    const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('upload_date', { ascending: false });

    if (error) {
        console.error('Error getting uploads:', error);
        return [];
    }
    return data;
}

export async function deleteUpload(uploadId) {
    try {
        // Step 1: Delete from master_list items that were ONLY seen in this upload
        // (where first_seen_upload_id = uploadId)
        await supabase
            .from('master_list')
            .delete()
            .eq('first_seen_upload_id', uploadId);

        // Step 2: Delete report data (CASCADE will handle this automatically)
        const { error: reportError } = await supabase
            .from('report_data')
            .delete()
            .eq('upload_id', uploadId);

        if (reportError) {
            console.error('Error deleting report data:', reportError);
            return false;
        }

        // Step 3: Delete the upload record
        // Foreign keys with SET NULL will update master_list references
        const { error: uploadError } = await supabase
            .from('uploads')
            .delete()
            .eq('id', uploadId);

        if (uploadError) {
            console.error('Error deleting upload:', uploadError);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Error in deleteUpload:', err);
        return false;
    }
}

/**
 * REPORT DATA OPERATIONS
 */

export async function saveReportData(uploadId, rows) {
    const dataToInsert = rows.map(row => ({
        upload_id: uploadId,
        container: row['CONTAINER'] || null,
        seal_number: row['SEAL #'] || null,
        carrier: row['CARRIER'] || null,
        mbl: row['MBL'] || null,
        mi: row['MI'] || null,
        vessel: row['VESSEL'] || null,
        hb: normalizeHB(row['HB']),
        outer_quantity: row['OUTER QUANTITY'] || null,
        pcs: row['PCS'] || null,
        wt_lbs: row['WT_LBS'] || null,
        cnee: row['CNEE'] || null,
        frl: row['FRL'] || null,
        file_no: row['FILE_NO'] || null,
        dest: row['DEST'] || null,
        volume: row['VOLUME'] || null,
        vbond: row['VBOND#'] || null,
        tdf: row['TDF'] || null,
    }));

    const { data, error } = await supabase
        .from('report_data')
        .insert(dataToInsert)
        .select();

    if (error) {
        console.error('Error saving report data:', error);
        return null;
    }
    return data.length;
}

export async function getReportData(uploadId, filter = 'all') {
    let query = supabase
        .from('report_data')
        .select('*')
        .eq('upload_id', uploadId)
        .order('id', { ascending: true });

    if (filter === 'with_frl') {
        query = query.not('frl', 'is', null).neq('frl', '');
    } else if (filter === 'without_frl') {
        query = query.or('frl.is.null,frl.eq.');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting report data:', error);
        return [];
    }
    return data;
}

/**
 * MASTER LIST OPERATIONS
 */

export async function updateMasterList(uploadId, rows) {
    let itemsAdded = 0;
    let itemsUpdated = 0;

    // Extract all HBs from the upload
    const hbsToCheck = rows.map(row => normalizeHB(row['HB'])).filter(hb => hb);

    if (hbsToCheck.length === 0) {
        return { itemsAdded: 0, itemsUpdated: 0 };
    }

    // Fetch all existing master list items in ONE query
    const { data: existingItems } = await supabase
        .from('master_list')
        .select('id, hb, frl, tdf, vbond')
        .in('hb', hbsToCheck);

    // Create a map for quick lookup
    const existingMap = new Map();
    if (existingItems) {
        existingItems.forEach(item => {
            existingMap.set(item.hb, item);
        });
    }

    // Separate items into new vs updates
    const itemsToInsert = [];
    const itemsToUpdate = [];

    for (const row of rows) {
        const hb = normalizeHB(row['HB']);
        if (!hb) continue;

        const itemData = {
            container: row['CONTAINER'] || null,
            seal_number: row['SEAL #'] || null,
            carrier: row['CARRIER'] || null,
            mbl: row['MBL'] || null,
            mi: row['MI'] || null,
            vessel: row['VESSEL'] || null,
            hb: hb,
            outer_quantity: row['OUTER QUANTITY'] || null,
            pcs: row['PCS'] || null,
            wt_lbs: row['WT_LBS'] || null,
            cnee: row['CNEE'] || null,
            frl: row['FRL'] || null,
            file_no: row['FILE_NO'] || null,
            dest: row['DEST'] || null,
            volume: row['VOLUME'] || null,
            vbond: row['VBOND#'] || null,
            tdf: row['TDF'] || null,
            last_updated_upload_id: uploadId,
            updated_at: new Date().toISOString(),
        };

        const existing = existingMap.get(hb);

        if (existing) {
            // Determine update reason
            let updateReason = [];
            if (hasValueChanged(existing.frl, row['FRL'])) updateReason.push('FRL');
            if (hasValueChanged(existing.tdf, row['TDF'])) updateReason.push('TDF');
            if (hasValueChanged(existing.vbond, row['VBOND#'])) updateReason.push('VBOND');

            if (updateReason.length > 0) {
                itemData.id = existing.id;
                itemData.last_update_reason = updateReason.join(', ');
                itemsToUpdate.push(itemData);
            }
        } else {
            // New item
            itemData.first_seen_upload_id = uploadId;
            itemData.created_at = new Date().toISOString();
            itemsToInsert.push(itemData);
        }
    }

    // Batch insert new items (Supabase supports up to 1000 per batch)
    if (itemsToInsert.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < itemsToInsert.length; i += batchSize) {
            const batch = itemsToInsert.slice(i, i + batchSize);
            await supabase.from('master_list').insert(batch);
        }
        itemsAdded = itemsToInsert.length;
    }

    // Batch update existing items using upsert
    if (itemsToUpdate.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < itemsToUpdate.length; i += batchSize) {
            const batch = itemsToUpdate.slice(i, i + batchSize);
            await supabase.from('master_list').upsert(batch);
        }
        itemsUpdated = itemsToUpdate.length;
    }

    return { itemsAdded, itemsUpdated };
}

export async function getMasterListData(filter = 'all') {
    let query = supabase
        .from('master_list')
        .select('*')
        .order('id', { ascending: true });

    if (filter === 'with_frl') {
        query = query.not('frl', 'is', null).neq('frl', '');
    } else if (filter === 'without_frl') {
        query = query.or('frl.is.null,frl.eq.');
    }

    const { data, error } = await query;

    if (error) {
        console.error('Error getting master list:', error);
        return [];
    }
    return data;
}

export async function getMasterListMetrics() {
    const { data: allData } = await supabase.from('master_list').select('frl');

    if (!allData) return { totalRows: 0, withFrl: 0, withoutFrl: 0 };

    const totalRows = allData.length;
    const withFrl = allData.filter(r => r.frl && r.frl.trim() !== '').length;
    const withoutFrl = totalRows - withFrl;

    return { totalRows, withFrl, withoutFrl };
}

export async function getLatestUploadId() {
    const { data } = await supabase
        .from('uploads')
        .select('id')
        .order('upload_date', { ascending: false })
        .limit(1)
        .single();

    return data?.id || null;
}

export async function getMasterListNewItems() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const { data, error } = await supabase
        .from('master_list')
        .select('*')
        .eq('first_seen_upload_id', latestUploadId);

    if (error) {
        console.error('Error getting new items:', error);
        return { count: 0, data: [] };
    }

    return { count: data.length, data };
}

export async function getMasterListUpdatedItems() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const { data, error } = await supabase
        .from('master_list')
        .select('*')
        .eq('last_updated_upload_id', latestUploadId)
        .not('last_update_reason', 'is', null);

    if (error) {
        console.error('Error getting updated items:', error);
        return { count: 0, data: [] };
    }

    return { count: data.length, data };
}

export async function getMasterListNewFrl() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const { data, error } = await supabase
        .from('master_list')
        .select('*')
        .eq('last_updated_upload_id', latestUploadId)
        .ilike('last_update_reason', '%FRL%');

    if (error) {
        console.error('Error getting new FRL items:', error);
        return { count: 0, data: [] };
    }

    return { count: data.length, data };
}

/**
 * Normalize FRL value for comparison (handles both dates and Excel serial numbers)
 */
function normalizeFrlForComparison(frlValue) {
    if (!frlValue || frlValue.trim() === '') return '';

    const trimmed = frlValue.trim();

    // If it's already a date (contains /), return as-is
    if (trimmed.includes('/')) return trimmed;

    // If it's an Excel serial number, convert it
    const num = parseFloat(trimmed);
    if (!isNaN(num) && num > 40000 && num < 60000) {
        // Likely an Excel date serial (40000 ≈ 2009, 60000 ≈ 2064)
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + num * 24 * 60 * 60 * 1000);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const year = date.getFullYear();
        return `${month}/${day}/${year}`;
    }

    return trimmed;
}

/**
 * Detect newly FRL'd items for a specific upload (compared to previous upload)
 */
export async function detectNewlyFrld(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return 0;

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) return 0;

    const prevUploadId = uploads[0].id;

    // Get HBs from current upload that have FRL
    const { data: currentWithFrl } = await supabase
        .from('report_data')
        .select('hb, frl')
        .eq('upload_id', currentUploadId)
        .not('frl', 'is', null)
        .neq('frl', '');

    if (!currentWithFrl || currentWithFrl.length === 0) return 0;

    // Get HBs from previous upload
    const { data: prevData } = await supabase
        .from('report_data')
        .select('hb, frl')
        .eq('upload_id', prevUploadId);

    // Create a map of HB -> normalized FRL for previous upload
    const prevFrlMap = new Map();
    if (prevData) {
        prevData.forEach(item => {
            const normalizedFrl = normalizeFrlForComparison(item.frl || '');
            prevFrlMap.set(item.hb, normalizedFrl);
        });
    }

    // Count items that either:
    // 1. Didn't exist in previous upload but have FRL now, OR
    // 2. Existed in previous without FRL, but have FRL now
    const newlyFrld = currentWithFrl.filter(item => {
        const prevFrl = prevFrlMap.get(item.hb);
        const currentFrl = normalizeFrlForComparison(item.frl);

        // Item either didn't exist before OR existed without FRL OR FRL changed from empty
        if (!prevFrl || prevFrl === '') {
            // Previous had no FRL, current has FRL
            return currentFrl !== '';
        }

        // Both have FRL - not newly FRL'd
        return false;
    });

    return newlyFrld.length;
}

/**
 * Get the actual data for newly FRL'd items
 */
export async function getNewlyFrldData(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return [];

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) return [];

    const prevUploadId = uploads[0].id;

    // Get HBs from current upload that have FRL
    const { data: currentWithFrl } = await supabase
        .from('report_data')
        .select('hb, frl')
        .eq('upload_id', currentUploadId)
        .not('frl', 'is', null)
        .neq('frl', '');

    if (!currentWithFrl || currentWithFrl.length === 0) return [];

    // Get HBs from previous upload
    const { data: prevData } = await supabase
        .from('report_data')
        .select('hb, frl')
        .eq('upload_id', prevUploadId);

    // Create a map of HB -> normalized FRL for previous upload
    const prevFrlMap = new Map();
    if (prevData) {
        prevData.forEach(item => {
            const normalizedFrl = normalizeFrlForComparison(item.frl || '');
            prevFrlMap.set(item.hb, normalizedFrl);
        });
    }

    // Filter to get HBs that are newly FRL'd
    const newlyFrldHbs = currentWithFrl
        .filter(item => {
            const prevFrl = prevFrlMap.get(item.hb);
            const currentFrl = normalizeFrlForComparison(item.frl);

            // Item either didn't exist before OR existed without FRL OR FRL changed from empty
            if (!prevFrl || prevFrl === '') {
                // Previous had no FRL, current has FRL
                return currentFrl !== '';
            }

            // Both have FRL - not newly FRL'd
            return false;
        })
        .map(item => item.hb);

    if (newlyFrldHbs.length === 0) return [];

    // Fetch full data for these HBs
    const { data: fullData } = await supabase
        .from('report_data')
        .select('*')
        .eq('upload_id', currentUploadId)
        .in('hb', newlyFrldHbs);

    return fullData || [];
}

/**
 * COMPARISON OPERATIONS (Between uploads)
 */

export async function detectNewItems(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return 0;

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) {
        // No previous upload, nothing to compare to
        return 0;
    }

    const prevUploadId = uploads[0].id;

    // Get HBs from current upload
    const { data: currentHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', currentUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    // Get HBs from previous upload
    const { data: prevHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', prevUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    const prevHBSet = new Set(prevHBs?.map(r => r.hb) || []);
    const newItems = currentHBs?.filter(r => !prevHBSet.has(r.hb)) || [];

    return newItems.length;
}

export async function detectRemovedItems(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return 0;

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) return 0;

    const prevUploadId = uploads[0].id;

    const { data: currentHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', currentUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    const { data: prevHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', prevUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    const currentHBSet = new Set(currentHBs?.map(r => r.hb) || []);
    const removedItems = prevHBs?.filter(r => !currentHBSet.has(r.hb)) || [];

    return removedItems.length;
}

export async function getNewItemsData(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return [];

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) {
        return [];
    }

    const prevUploadId = uploads[0].id;

    const { data: prevHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', prevUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    const prevHBSet = new Set(prevHBs?.map(r => r.hb) || []);

    const { data: currentData } = await supabase
        .from('report_data')
        .select('*')
        .eq('upload_id', currentUploadId);

    return currentData?.filter(r => r.hb && !prevHBSet.has(r.hb)) || [];
}

export async function getRemovedItemsData(currentUploadId) {
    // Get the current upload's date first
    const { data: currentUpload } = await supabase
        .from('uploads')
        .select('upload_date')
        .eq('id', currentUploadId)
        .single();

    if (!currentUpload) return [];

    // Get previous upload (by date, not ID)
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('upload_date', currentUpload.upload_date)
        .order('upload_date', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) return [];

    const prevUploadId = uploads[0].id;

    const { data: currentHBs } = await supabase
        .from('report_data')
        .select('hb')
        .eq('upload_id', currentUploadId)
        .not('hb', 'is', null)
        .neq('hb', '');

    const currentHBSet = new Set(currentHBs?.map(r => r.hb) || []);

    const { data: prevData } = await supabase
        .from('report_data')
        .select('*')
        .eq('upload_id', prevUploadId);

    return prevData?.filter(r => r.hb && !currentHBSet.has(r.hb)) || [];
}

/**
 * DOCK TALLY REPORT OPERATIONS
 */

export async function getDataGroupedByMBL(uploadId = null) {
    let query = uploadId
        ? supabase.from('report_data').select('*').eq('upload_id', uploadId)
        : supabase.from('master_list').select('*');

    const { data, error } = await query;

    if (error) {
        console.error('Error getting grouped data:', error);
        return {};
    }

    // Group by MBL
    const grouped = {};
    for (const row of data || []) {
        const mbl = row.mbl || 'NO MBL';
        if (!grouped[mbl]) {
            grouped[mbl] = {
                mbl: mbl,
                containers: new Set(),
                items: [],
            };
        }
        if (row.container) {
            grouped[mbl].containers.add(row.container);
        }
        grouped[mbl].items.push(row);
    }

    // Convert Sets to arrays
    for (const mbl in grouped) {
        grouped[mbl].containers = Array.from(grouped[mbl].containers);
    }

    return grouped;
}

/**
 * HELPER FUNCTIONS
 */

function normalizeHB(value) {
    if (value === null || value === undefined || value === '') return '';
    // Always preserve the original value as string (including letters and numbers)
    // Just trim whitespace
    return String(value).trim().toUpperCase();
}

function hasValueChanged(oldVal, newVal) {
    const old = (oldVal || '').toString().trim();
    const now = (newVal || '').toString().trim();
    // If old was empty and new has value, it changed
    if (!old && now) return true;
    // If both had values but different, it changed
    if (old && now && old !== now) return true;
    return false;
}

/**
 * AIR CARGO OPERATIONS (STUBS - Tables not yet implemented)
 * TODO: Add air cargo tables to schema and implement these functions
 */

export async function saveAirUpload(filename, rowCount) {
    console.warn('Air cargo tables not yet implemented');
    return null;
}

export async function getAllAirUploads() {
    return [];
}

export async function deleteAirUpload(uploadId) {
    return false;
}

export async function saveAirReportData(uploadId, rows) {
    return 0;
}

export async function getAirReportData(uploadId, filter = 'all') {
    return [];
}

export async function getAirMasterListData(filter = 'all') {
    return [];
}

export async function getAirMasterListMetrics() {
    return { totalRows: 0, withFrl: 0, withoutFrl: 0 };
}

export async function updateAirMasterList(uploadId, rows) {
    return { itemsAdded: 0, itemsUpdated: 0 };
}

export async function getAirMasterListNewItems() {
    return { count: 0, data: [] };
}
