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
    // Delete report data first
    await supabase.from('report_data').delete().eq('upload_id', uploadId);

    // Delete the upload record
    const { error } = await supabase.from('uploads').delete().eq('id', uploadId);

    if (error) {
        console.error('Error deleting upload:', error);
        return false;
    }
    return true;
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

    for (const row of rows) {
        const hb = normalizeHB(row['HB']);
        if (!hb) continue;

        // Check if item exists in master list
        const { data: existing } = await supabase
            .from('master_list')
            .select('id, frl, tdf, vbond')
            .eq('hb', hb)
            .single();

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

        if (existing) {
            // Determine update reason
            let updateReason = [];
            if (hasValueChanged(existing.frl, row['FRL'])) updateReason.push('FRL');
            if (hasValueChanged(existing.tdf, row['TDF'])) updateReason.push('TDF');
            if (hasValueChanged(existing.vbond, row['VBOND#'])) updateReason.push('VBOND');

            if (updateReason.length > 0) {
                itemData.last_update_reason = updateReason.join(', ');
                await supabase.from('master_list').update(itemData).eq('id', existing.id);
                itemsUpdated++;
            }
        } else {
            // New item
            itemData.first_seen_upload_id = uploadId;
            itemData.created_at = new Date().toISOString();
            await supabase.from('master_list').insert(itemData);
            itemsAdded++;
        }
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
 * COMPARISON OPERATIONS (Between uploads)
 */

export async function detectNewItems(currentUploadId) {
    // Get previous upload
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('id', currentUploadId)
        .order('id', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) {
        // No previous upload, all items are new
        const { count } = await supabase
            .from('report_data')
            .select('*', { count: 'exact', head: true })
            .eq('upload_id', currentUploadId);
        return count || 0;
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
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('id', currentUploadId)
        .order('id', { ascending: false })
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
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('id', currentUploadId)
        .order('id', { ascending: false })
        .limit(1);

    if (!uploads || uploads.length === 0) {
        return await getReportData(currentUploadId);
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
    const { data: uploads } = await supabase
        .from('uploads')
        .select('id')
        .lt('id', currentUploadId)
        .order('id', { ascending: false })
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
    try {
        const num = parseFloat(value);
        if (!isNaN(num)) {
            return String(Math.floor(num));
        }
        return String(value).trim();
    } catch {
        return String(value).trim();
    }
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
