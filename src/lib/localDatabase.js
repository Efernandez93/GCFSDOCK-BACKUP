/**
 * Local Storage Database - For testing without Supabase
 * This module stores all data in browser localStorage
 */

const STORAGE_KEYS = {
    UPLOADS: 'csvdock_uploads',
    REPORT_DATA: 'csvdock_report_data',
    MASTER_LIST: 'csvdock_master_list',
    // Air cargo storage
    AIR_UPLOADS: 'csvdock_air_uploads',
    AIR_REPORT_DATA: 'csvdock_air_report_data',
    AIR_MASTER_LIST: 'csvdock_air_master_list',
};

// Helper to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Helper to get data from localStorage
function getStorage(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
}

// Helper to save data to localStorage
function setStorage(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

/**
 * UPLOADS OPERATIONS
 */

export async function saveUpload(filename, rowCount) {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    const newUpload = {
        id: generateId(),
        filename,
        row_count: rowCount,
        upload_date: new Date().toISOString(),
    };
    uploads.unshift(newUpload);
    setStorage(STORAGE_KEYS.UPLOADS, uploads);
    return newUpload;
}

export async function getAllUploads() {
    return getStorage(STORAGE_KEYS.UPLOADS);
}

export async function deleteUpload(uploadId) {
    // Delete upload
    const uploads = getStorage(STORAGE_KEYS.UPLOADS).filter(u => u.id !== uploadId);
    setStorage(STORAGE_KEYS.UPLOADS, uploads);

    // Delete associated report data
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA).filter(r => r.upload_id !== uploadId);
    setStorage(STORAGE_KEYS.REPORT_DATA, reportData);

    return true;
}

/**
 * REPORT DATA OPERATIONS
 */

export async function saveReportData(uploadId, rows) {
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA);

    const dataToInsert = rows.map(row => ({
        id: generateId(),
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

    reportData.push(...dataToInsert);
    setStorage(STORAGE_KEYS.REPORT_DATA, reportData);

    return dataToInsert.length;
}

export async function getReportData(uploadId, filter = 'all') {
    let data = getStorage(STORAGE_KEYS.REPORT_DATA).filter(r => r.upload_id === uploadId);

    if (filter === 'with_frl') {
        data = data.filter(r => r.frl && r.frl.trim() !== '');
    } else if (filter === 'without_frl') {
        data = data.filter(r => !r.frl || r.frl.trim() === '');
    }

    return data;
}

/**
 * MASTER LIST OPERATIONS
 */

export async function updateMasterList(uploadId, rows) {
    const masterList = getStorage(STORAGE_KEYS.MASTER_LIST);
    let itemsAdded = 0;
    let itemsUpdated = 0;

    // Master List is a unique catalog by HB - no duplicates
    for (const row of rows) {
        const hb = normalizeHB(row['HB']);
        if (!hb) continue; // Skip rows without HB

        // Check if this HB already exists in master list
        const existingIndex = masterList.findIndex(m => m.hb === hb);

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

        if (existingIndex >= 0) {
            // Update existing entry with latest data
            const existing = masterList[existingIndex];
            masterList[existingIndex] = { ...existing, ...itemData };
            itemsUpdated++;
        } else {
            // Add new entry
            itemData.id = generateId();
            itemData.first_seen_upload_id = uploadId;
            itemData.created_at = new Date().toISOString();
            masterList.push(itemData);
            itemsAdded++;
        }
    }

    setStorage(STORAGE_KEYS.MASTER_LIST, masterList);
    return { itemsAdded, itemsUpdated };
}

export async function getMasterListData(filter = 'all') {
    let data = getStorage(STORAGE_KEYS.MASTER_LIST);

    if (filter === 'with_frl') {
        data = data.filter(r => r.frl && r.frl.trim() !== '');
    } else if (filter === 'without_frl') {
        data = data.filter(r => !r.frl || r.frl.trim() === '');
    }

    return data;
}

export async function getMasterListMetrics() {
    const allData = getStorage(STORAGE_KEYS.MASTER_LIST);
    const totalRows = allData.length;
    const withFrl = allData.filter(r => r.frl && r.frl.trim() !== '').length;
    const withoutFrl = totalRows - withFrl;

    return { totalRows, withFrl, withoutFrl };
}

export async function getLatestUploadId() {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    return uploads.length > 0 ? uploads[0].id : null;
}

export async function getMasterListNewItems() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const data = getStorage(STORAGE_KEYS.MASTER_LIST).filter(
        m => m.first_seen_upload_id === latestUploadId
    );

    return { count: data.length, data };
}

export async function getMasterListUpdatedItems() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const data = getStorage(STORAGE_KEYS.MASTER_LIST).filter(
        m => m.last_updated_upload_id === latestUploadId && m.last_update_reason
    );

    return { count: data.length, data };
}

export async function getMasterListNewFrl() {
    const latestUploadId = await getLatestUploadId();
    if (!latestUploadId) return { count: 0, data: [] };

    const data = getStorage(STORAGE_KEYS.MASTER_LIST).filter(
        m => m.last_updated_upload_id === latestUploadId &&
            m.last_update_reason &&
            m.last_update_reason.includes('FRL')
    );

    return { count: data.length, data };
}

/**
 * COMPARISON OPERATIONS
 */

export async function detectNewItems(currentUploadId) {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    const currentIndex = uploads.findIndex(u => u.id === currentUploadId);

    if (currentIndex === -1 || currentIndex >= uploads.length - 1) {
        // No previous upload
        const currentData = getStorage(STORAGE_KEYS.REPORT_DATA).filter(r => r.upload_id === currentUploadId);
        return currentData.length;
    }

    const prevUploadId = uploads[currentIndex + 1].id;
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA);

    const currentHBs = new Set(
        reportData.filter(r => r.upload_id === currentUploadId && r.hb).map(r => r.hb)
    );
    const prevHBs = new Set(
        reportData.filter(r => r.upload_id === prevUploadId && r.hb).map(r => r.hb)
    );

    let count = 0;
    currentHBs.forEach(hb => {
        if (!prevHBs.has(hb)) count++;
    });

    return count;
}

export async function detectRemovedItems(currentUploadId) {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    const currentIndex = uploads.findIndex(u => u.id === currentUploadId);

    if (currentIndex === -1 || currentIndex >= uploads.length - 1) {
        return 0;
    }

    const prevUploadId = uploads[currentIndex + 1].id;
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA);

    const currentHBs = new Set(
        reportData.filter(r => r.upload_id === currentUploadId && r.hb).map(r => r.hb)
    );
    const prevHBs = new Set(
        reportData.filter(r => r.upload_id === prevUploadId && r.hb).map(r => r.hb)
    );

    let count = 0;
    prevHBs.forEach(hb => {
        if (!currentHBs.has(hb)) count++;
    });

    return count;
}

export async function getNewItemsData(currentUploadId) {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    const currentIndex = uploads.findIndex(u => u.id === currentUploadId);
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA);

    const currentData = reportData.filter(r => r.upload_id === currentUploadId);

    if (currentIndex === -1 || currentIndex >= uploads.length - 1) {
        return currentData;
    }

    const prevUploadId = uploads[currentIndex + 1].id;
    const prevHBs = new Set(
        reportData.filter(r => r.upload_id === prevUploadId && r.hb).map(r => r.hb)
    );

    return currentData.filter(r => r.hb && !prevHBs.has(r.hb));
}

export async function getRemovedItemsData(currentUploadId) {
    const uploads = getStorage(STORAGE_KEYS.UPLOADS);
    const currentIndex = uploads.findIndex(u => u.id === currentUploadId);

    if (currentIndex === -1 || currentIndex >= uploads.length - 1) {
        return [];
    }

    const prevUploadId = uploads[currentIndex + 1].id;
    const reportData = getStorage(STORAGE_KEYS.REPORT_DATA);

    const currentHBs = new Set(
        reportData.filter(r => r.upload_id === currentUploadId && r.hb).map(r => r.hb)
    );
    const prevData = reportData.filter(r => r.upload_id === prevUploadId);

    return prevData.filter(r => r.hb && !currentHBs.has(r.hb));
}

/**
 * DOCK TALLY REPORT
 */

export async function getDataGroupedByMBL(uploadId = null) {
    const data = uploadId
        ? getStorage(STORAGE_KEYS.REPORT_DATA).filter(r => r.upload_id === uploadId)
        : getStorage(STORAGE_KEYS.MASTER_LIST);

    const grouped = {};

    for (const row of data) {
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

    const strValue = String(value).trim();

    // Check if it's scientific notation (e.g., 6.17E+08 or 6.17e+08)
    if (/^-?\d+\.?\d*[eE][+-]?\d+$/.test(strValue)) {
        try {
            const num = parseFloat(strValue);
            if (!isNaN(num)) {
                return String(Math.floor(num));
            }
        } catch {
            // If conversion fails, return original
        }
    }

    // For everything else (including alphanumeric like "62R0537240"), keep as-is
    return strValue;
}

function hasValueChanged(oldVal, newVal) {
    const old = (oldVal || '').toString().trim();
    const now = (newVal || '').toString().trim();
    if (!old && now) return true;
    if (old && now && old !== now) return true;
    return false;
}

/**
 * CLEAR ALL DATA (for testing)
 */
export function clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.UPLOADS);
    localStorage.removeItem(STORAGE_KEYS.REPORT_DATA);
    localStorage.removeItem(STORAGE_KEYS.MASTER_LIST);
    localStorage.removeItem(STORAGE_KEYS.AIR_UPLOADS);
    localStorage.removeItem(STORAGE_KEYS.AIR_REPORT_DATA);
    localStorage.removeItem(STORAGE_KEYS.AIR_MASTER_LIST);
}

/**
 * ===================================
 * AIR CARGO OPERATIONS
 * ===================================
 */

/**
 * AIR UPLOADS
 */
export async function saveAirUpload(filename, rowCount) {
    const uploads = getStorage(STORAGE_KEYS.AIR_UPLOADS);
    const newUpload = {
        id: generateId(),
        filename,
        row_count: rowCount,
        upload_date: new Date().toISOString(),
    };
    uploads.unshift(newUpload);
    setStorage(STORAGE_KEYS.AIR_UPLOADS, uploads);
    return newUpload;
}

export async function getAllAirUploads() {
    return getStorage(STORAGE_KEYS.AIR_UPLOADS);
}

export async function deleteAirUpload(uploadId) {
    const uploads = getStorage(STORAGE_KEYS.AIR_UPLOADS).filter(u => u.id !== uploadId);
    setStorage(STORAGE_KEYS.AIR_UPLOADS, uploads);

    const reportData = getStorage(STORAGE_KEYS.AIR_REPORT_DATA).filter(r => r.upload_id !== uploadId);
    setStorage(STORAGE_KEYS.AIR_REPORT_DATA, reportData);

    return true;
}

/**
 * AIR REPORT DATA
 */
export async function saveAirReportData(uploadId, rows) {
    const reportData = getStorage(STORAGE_KEYS.AIR_REPORT_DATA);

    const dataToInsert = rows.map(row => ({
        id: generateId(),
        upload_id: uploadId,
        mawb: row['MAWB'] || null,
        hawb: row['HAWB'] || null,
        consignee: row['Consignee'] || null,
        carrier: row['Carrier'] || null,
        flight_number: row['FLIGHT NUMBER'] || null,
        freight_location: row['FREIGHT LOCATION'] || null,
        origin: row['ORIGIN'] || null,
        destination: row['DESTINATION'] || null,
        file_number: row['File Number'] || null,
        qty: row['QTY'] || null,
        shipment_type: row['Shipment Type'] || null,
        slac: row['SLAC'] || null,
        weight: row['WEIGHT'] || null,
        eta: row['ETA'] || null,
        eta_time: row['ETA TIME'] || null,
        log: row['LOG'] || null,
        flt_date: row['Flt Date'] || null,
    }));

    reportData.push(...dataToInsert);
    setStorage(STORAGE_KEYS.AIR_REPORT_DATA, reportData);

    return dataToInsert.length;
}

export async function getAirReportData(uploadId, filter = 'all') {
    let data = getStorage(STORAGE_KEYS.AIR_REPORT_DATA).filter(r => r.upload_id === uploadId);

    if (filter === 'with_frl') {
        data = data.filter(r => r.log && r.log.trim() !== '');
    } else if (filter === 'without_frl') {
        data = data.filter(r => !r.log || r.log.trim() === '');
    }

    return data;
}

/**
 * AIR MASTER LIST
 */
export async function getAirMasterListData(filter = 'all') {
    let data = getStorage(STORAGE_KEYS.AIR_MASTER_LIST);

    if (filter === 'with_frl') {
        data = data.filter(r => r.log && r.log.trim() !== '');
    } else if (filter === 'without_frl') {
        data = data.filter(r => !r.log || r.log.trim() === '');
    }

    return data;
}

export async function getAirMasterListMetrics() {
    const data = getStorage(STORAGE_KEYS.AIR_MASTER_LIST);
    const withLog = data.filter(r => r.log && r.log.trim() !== '').length;
    return {
        totalRows: data.length,
        withFrl: withLog,
        withoutFrl: data.length - withLog,
    };
}

export async function updateAirMasterList(uploadId, rows) {
    const masterList = getStorage(STORAGE_KEYS.AIR_MASTER_LIST);
    let itemsAdded = 0;
    let itemsUpdated = 0;

    for (const row of rows) {
        const hawb = normalizeHB(row['HAWB']);
        if (!hawb) continue;

        const existingIndex = masterList.findIndex(m => m.hawb === hawb);

        const itemData = {
            mawb: row['MAWB'] || null,
            hawb: hawb,
            consignee: row['Consignee'] || null,
            carrier: row['Carrier'] || null,
            flight_number: row['FLIGHT NUMBER'] || null,
            freight_location: row['FREIGHT LOCATION'] || null,
            origin: row['ORIGIN'] || null,
            destination: row['DESTINATION'] || null,
            file_number: row['File Number'] || null,
            qty: row['QTY'] || null,
            shipment_type: row['Shipment Type'] || null,
            slac: row['SLAC'] || null,
            weight: row['WEIGHT'] || null,
            eta: row['ETA'] || null,
            eta_time: row['ETA TIME'] || null,
            log: row['LOG'] || null,
            flt_date: row['Flt Date'] || null,
            last_updated_upload_id: uploadId,
            updated_at: new Date().toISOString(),
        };

        if (existingIndex >= 0) {
            const existing = masterList[existingIndex];
            masterList[existingIndex] = { ...existing, ...itemData };
            itemsUpdated++;
        } else {
            itemData.id = generateId();
            itemData.first_seen_upload_id = uploadId;
            itemData.created_at = new Date().toISOString();
            masterList.push(itemData);
            itemsAdded++;
        }
    }

    setStorage(STORAGE_KEYS.AIR_MASTER_LIST, masterList);
    return { itemsAdded, itemsUpdated };
}

export async function getAirMasterListNewItems() {
    const masterList = getStorage(STORAGE_KEYS.AIR_MASTER_LIST);
    const uploads = getStorage(STORAGE_KEYS.AIR_UPLOADS);

    if (uploads.length === 0) return { count: 0, data: [] };

    const latestUploadId = uploads[0].id;
    const newItems = masterList.filter(item => item.first_seen_upload_id === latestUploadId);

    return { count: newItems.length, data: newItems };
}

export function groupAirDataByMAWB(data) {
    const grouped = {};

    for (const row of data) {
        const mawb = row.mawb || 'NO MAWB';
        if (!grouped[mawb]) {
            grouped[mawb] = {
                mawb: mawb,
                flights: new Set(),
                items: [],
            };
        }
        if (row.flight_number) {
            grouped[mawb].flights.add(row.flight_number);
        }
        grouped[mawb].items.push(row);
    }

    for (const mawb in grouped) {
        grouped[mawb].flights = Array.from(grouped[mawb].flights);
    }

    return grouped;
}
