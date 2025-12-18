/**
 * Dashboard Component - Main application view
 */

import { useState, useEffect, useMemo } from 'react';
import { Download, FileText, X, Anchor, Plane } from 'lucide-react';
import Sidebar from './Sidebar';
import MetricsBar from './MetricsBar';
import DataTable from './DataTable';
import SearchBar from './SearchBar';
import UploadModal from './UploadModal';
import DockTallyReport from './DockTallyReport';
import { exportToCSV } from '../lib/csvUtils';
import {
    getAllUploads,
    deleteUpload,
    getReportData,
    getMasterListData,
    getMasterListMetrics,
    getMasterListNewItems,
    getMasterListUpdatedItems,
    getMasterListNewFrl,
    getNewItemsData,
    getRemovedItemsData,
    detectNewItems,
    detectRemovedItems,
    // Air functions
    getAllAirUploads,
    deleteAirUpload,
    getAirReportData,
    getAirMasterListData,
    getAirMasterListMetrics,
    getAirMasterListNewItems,
} from '../lib/localDatabase';

export default function Dashboard({ onLogout }) {
    // Mode: 'ocean' or 'air'
    const [mode, setMode] = useState('ocean');

    // State
    const [uploads, setUploads] = useState([]);
    const [selectedUpload, setSelectedUpload] = useState(null);
    const [isMasterList, setIsMasterList] = useState(true);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [searchField, setSearchField] = useState('all');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showDockReport, setShowDockReport] = useState(false);
    const [toast, setToast] = useState(null);

    // Metrics state
    const [metrics, setMetrics] = useState({
        totalRows: 0,
        withFrl: 0,
        withoutFrl: 0,
        newItems: 0,
        updatedItems: 0,
        removedItems: 0,
        newFrl: 0,
    });

    // Load uploads on mount and when mode changes
    useEffect(() => {
        loadUploads();
        // Reset selection when mode changes
        setSelectedUpload(null);
        setIsMasterList(true);
        setActiveFilter('all');
        setSearchText('');
    }, [mode]);

    // Load data when selection changes
    useEffect(() => {
        if (isMasterList) {
            loadMasterListData();
        } else if (selectedUpload) {
            loadUploadData(selectedUpload);
        }
    }, [isMasterList, selectedUpload, activeFilter, mode]);

    const loadUploads = async () => {
        const uploadList = mode === 'air'
            ? await getAllAirUploads()
            : await getAllUploads();
        setUploads(uploadList);
    };

    const loadMasterListData = async () => {
        setLoading(true);
        try {
            if (mode === 'air') {
                // Air mode
                const allMasterData = await getAirMasterListData('all');
                const uniqueMawbSet = new Set(allMasterData.filter(r => r.mawb && r.mawb.trim() !== '').map(r => r.mawb));
                const masterMetrics = await getAirMasterListMetrics();
                const newItems = await getAirMasterListNewItems();

                setMetrics({
                    totalRows: masterMetrics.totalRows,
                    uniqueMbls: uniqueMawbSet.size,
                    withFrl: masterMetrics.withFrl,
                    withoutFrl: masterMetrics.withoutFrl,
                    newItems: newItems.count,
                    updatedItems: 0,
                    removedItems: 0,
                    newFrl: 0,
                });

                let loadedData = [];
                switch (activeFilter) {
                    case 'new_items':
                        loadedData = newItems.data;
                        break;
                    default:
                        loadedData = await getAirMasterListData(activeFilter);
                }
                setData(loadedData);
            } else {
                // Ocean mode (original logic)
                const allMasterData = await getMasterListData('all');
                const uniqueMblSet = new Set(allMasterData.filter(r => r.mbl && r.mbl.trim() !== '').map(r => r.mbl));
                const masterMetrics = await getMasterListMetrics();
                const newItems = await getMasterListNewItems();
                const updatedItems = await getMasterListUpdatedItems();
                const newFrl = await getMasterListNewFrl();

                setMetrics({
                    totalRows: masterMetrics.totalRows,
                    uniqueMbls: uniqueMblSet.size,
                    withFrl: masterMetrics.withFrl,
                    withoutFrl: masterMetrics.withoutFrl,
                    newItems: newItems.count,
                    updatedItems: updatedItems.count,
                    removedItems: 0,
                    newFrl: newFrl.count,
                });

                let loadedData = [];
                switch (activeFilter) {
                    case 'new_items':
                        loadedData = newItems.data;
                        break;
                    case 'updated_items':
                        loadedData = updatedItems.data;
                        break;
                    case 'new_frl':
                        loadedData = newFrl.data;
                        break;
                    default:
                        loadedData = await getMasterListData(activeFilter);
                }
                setData(loadedData);
            }
        } catch (err) {
            console.error('Error loading master list:', err);
            showToast('Error loading data', 'error');
        }
        setLoading(false);
    };

    const loadUploadData = async (uploadId) => {
        setLoading(true);
        try {
            if (mode === 'air') {
                // Air mode
                const reportData = await getAirReportData(uploadId);
                const uniqueMawbSet = new Set(reportData.filter(r => r.mawb && r.mawb.trim() !== '').map(r => r.mawb));
                const withLog = reportData.filter(r => r.log && r.log.trim() !== '').length;

                setMetrics({
                    totalRows: reportData.length,
                    uniqueMbls: uniqueMawbSet.size,
                    withFrl: withLog,
                    withoutFrl: reportData.length - withLog,
                    newItems: 0,
                    removedItems: 0,
                    updatedItems: 0,
                    newFrl: 0,
                });

                const loadedData = await getAirReportData(uploadId, activeFilter);
                setData(loadedData);
            } else {
                // Ocean mode (original logic)
                const reportData = await getReportData(uploadId);
                const uniqueMblSet = new Set(reportData.filter(r => r.mbl && r.mbl.trim() !== '').map(r => r.mbl));
                const withFrl = reportData.filter(r => r.frl && r.frl.trim() !== '').length;
                const newItemsCount = await detectNewItems(uploadId);
                const removedItemsCount = await detectRemovedItems(uploadId);

                setMetrics({
                    totalRows: reportData.length,
                    uniqueMbls: uniqueMblSet.size,
                    withFrl,
                    withoutFrl: reportData.length - withFrl,
                    newItems: newItemsCount,
                    removedItems: removedItemsCount,
                    updatedItems: 0,
                    newFrl: 0,
                });

                let loadedData = [];
                switch (activeFilter) {
                    case 'new_items':
                        loadedData = await getNewItemsData(uploadId);
                        break;
                    case 'updated_items':
                        loadedData = await getRemovedItemsData(uploadId);
                        break;
                    default:
                        loadedData = await getReportData(uploadId, activeFilter);
                }
                setData(loadedData);
            }
        } catch (err) {
            console.error('Error loading upload data:', err);
            showToast('Error loading data', 'error');
        }
        setLoading(false);
    };

    // Filtered data based on search
    const filteredData = useMemo(() => {
        if (!searchText.trim()) return data;

        const searchLower = searchText.toLowerCase();

        return data.filter(row => {
            if (searchField === 'all') {
                return Object.values(row).some(val =>
                    val && String(val).toLowerCase().includes(searchLower)
                );
            }
            const value = row[searchField];
            return value && String(value).toLowerCase().includes(searchLower);
        });
    }, [data, searchText, searchField]);

    // Handlers
    const handleSelectUpload = (uploadId) => {
        setSelectedUpload(uploadId);
        setIsMasterList(false);
        setActiveFilter('all');
        setSearchText('');
    };

    const handleSelectMasterList = () => {
        setSelectedUpload(null);
        setIsMasterList(true);
        setActiveFilter('all');
        setSearchText('');
    };

    const handleDeleteUpload = async (uploadId) => {
        const success = mode === 'air'
            ? await deleteAirUpload(uploadId)
            : await deleteUpload(uploadId);
        if (success) {
            await loadUploads();
            if (selectedUpload === uploadId) {
                handleSelectMasterList();
            }
            showToast('Upload deleted successfully', 'success');
        } else {
            showToast('Failed to delete upload', 'error');
        }
    };

    const handleFilterChange = (filter) => {
        setActiveFilter(filter);
        setSearchText('');
    };

    const handleUploadSuccess = async ({ rowsInserted, itemsAdded, itemsUpdated }) => {
        await loadUploads();
        handleSelectMasterList();
        showToast(
            `Upload successful! ${rowsInserted} rows, ${itemsAdded} new items, ${itemsUpdated} updated`,
            'success'
        );
    };

    const handleDownloadCSV = () => {
        if (filteredData.length === 0) {
            showToast('No data to export', 'error');
            return;
        }

        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `export_${timestamp}.csv`;
        exportToCSV(filteredData, filename);
        showToast('CSV downloaded successfully', 'success');
    };

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const getSelectedTitle = () => {
        if (isMasterList) return '📦 Master List';
        const upload = uploads.find(u => u.id === selectedUpload);
        if (upload) {
            const date = new Date(upload.upload_date);
            return `📄 ${date.toLocaleDateString()} - ${upload.filename}`;
        }
        return 'Select an upload';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh' }}>
            <Sidebar
                uploads={uploads}
                selectedUpload={selectedUpload}
                isMasterList={isMasterList}
                masterListCount={metrics.totalRows}
                onSelectUpload={handleSelectUpload}
                onSelectMasterList={handleSelectMasterList}
                onUploadClick={() => setShowUploadModal(true)}
                onDeleteUpload={handleDeleteUpload}
                onRefresh={loadUploads}
                onLogout={onLogout}
            />

            <main className="main-content">
                {/* Ocean/Air Mode Tabs */}
                <div style={{
                    display: 'flex',
                    gap: '0',
                    marginBottom: '16px',
                    borderBottom: '2px solid var(--border-color)'
                }}>
                    <button
                        onClick={() => setMode('ocean')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            border: 'none',
                            borderBottom: mode === 'ocean' ? '3px solid var(--info)' : '3px solid transparent',
                            background: mode === 'ocean' ? 'var(--info-bg)' : 'transparent',
                            color: mode === 'ocean' ? 'var(--info)' : 'var(--text-secondary)',
                            fontWeight: mode === 'ocean' ? '600' : '400',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Anchor size={20} />
                        Ocean
                    </button>
                    <button
                        onClick={() => setMode('air')}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 24px',
                            border: 'none',
                            borderBottom: mode === 'air' ? '3px solid var(--info)' : '3px solid transparent',
                            background: mode === 'air' ? 'var(--info-bg)' : 'transparent',
                            color: mode === 'air' ? 'var(--info)' : 'var(--text-secondary)',
                            fontWeight: mode === 'air' ? '600' : '400',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '0.95rem'
                        }}
                    >
                        <Plane size={20} />
                        Air
                    </button>
                </div>

                <header className="content-header">
                    <div>
                        <h1 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>
                            {getSelectedTitle()}
                        </h1>
                        {activeFilter !== 'all' && (
                            <button
                                className="btn btn-sm btn-ghost"
                                onClick={() => setActiveFilter('all')}
                                style={{ marginTop: '4px' }}
                            >
                                <X size={14} />
                                Clear Filter
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => setShowDockReport(true)}
                        >
                            <FileText size={18} />
                            Dock Report
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handleDownloadCSV}
                            disabled={filteredData.length === 0}
                        >
                            <Download size={18} />
                            Download CSV
                        </button>
                    </div>
                </header>

                <div className="content-body">
                    <MetricsBar
                        metrics={metrics}
                        activeFilter={activeFilter}
                        onFilterChange={handleFilterChange}
                        isMasterList={isMasterList}
                        mode={mode}
                    />

                    <SearchBar
                        searchText={searchText}
                        searchField={searchField}
                        onSearchChange={setSearchText}
                        onFieldChange={setSearchField}
                        onClear={() => setSearchText('')}
                        mode={mode}
                    />

                    <div style={{
                        marginBottom: '12px',
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)'
                    }}>
                        Showing {filteredData.length} of {data.length} rows
                    </div>

                    <DataTable data={filteredData} loading={loading} mode={mode} />
                </div>
            </main>

            {/* Modals */}
            <UploadModal
                isOpen={showUploadModal}
                onClose={() => setShowUploadModal(false)}
                onSuccess={handleUploadSuccess}
                mode={mode}
            />

            <DockTallyReport
                isOpen={showDockReport}
                onClose={() => setShowDockReport(false)}
                data={filteredData}
                activeFilter={activeFilter}
                mode={mode}
            />

            {/* Toast Notification */}
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.type === 'success' ? '✓' : '⚠'}
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    );
}
