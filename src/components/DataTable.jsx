/**
 * Data Table Component - Displays CSV data in a sortable, resizable table
 * With duplicate highlighting for HB and MBL columns
 * Column widths are persisted to localStorage
 */

import { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { DISPLAY_COLUMNS, AIR_DISPLAY_COLUMNS } from '../lib/csvUtils';

const COLUMN_WIDTHS_KEY = 'csvdock_column_widths';
const AIR_COLUMN_WIDTHS_KEY = 'csvdock_air_column_widths';

// Default column widths for Ocean
const DEFAULT_WIDTHS = {
    container: 130,
    seal_number: 100,
    carrier: 80,
    mbl: 120,
    mi: 60,
    vessel: 120,
    hb: 120,
    outer_quantity: 80,
    pcs: 60,
    wt_lbs: 80,
    cnee: 150,
    frl: 100,
    file_no: 80,
    dest: 100,
    volume: 80,
    vbond: 100,
    tdf: 100,
};

// Default column widths for Air
const AIR_DEFAULT_WIDTHS = {
    mawb: 130,
    hawb: 120,
    consignee: 150,
    carrier: 100,
    flight_number: 100,
    freight_location: 120,
    origin: 80,
    destination: 80,
    file_number: 80,
    qty: 60,
    shipment_type: 80,
    slac: 60,
    weight: 80,
    eta: 100,
    eta_time: 80,
    log: 80,
    flt_date: 100,
};

export default function DataTable({ data, loading, mode = 'ocean' }) {
    const columns = mode === 'air' ? AIR_DISPLAY_COLUMNS : DISPLAY_COLUMNS;
    const widthsKey = mode === 'air' ? AIR_COLUMN_WIDTHS_KEY : COLUMN_WIDTHS_KEY;
    const defaultWidths = mode === 'air' ? AIR_DEFAULT_WIDTHS : DEFAULT_WIDTHS;
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [columnWidths, setColumnWidths] = useState(() => {
        // Load saved widths from localStorage
        try {
            const saved = localStorage.getItem(widthsKey);
            if (saved) {
                return { ...defaultWidths, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Error loading column widths:', e);
        }
        return defaultWidths;
    });
    const [resizing, setResizing] = useState(null);

    // Reset column widths when mode changes
    useEffect(() => {
        try {
            const saved = localStorage.getItem(widthsKey);
            if (saved) {
                setColumnWidths({ ...defaultWidths, ...JSON.parse(saved) });
            } else {
                setColumnWidths(defaultWidths);
            }
        } catch (e) {
            setColumnWidths(defaultWidths);
        }
    }, [mode]);

    // Save column widths to localStorage when they change
    useEffect(() => {
        try {
            localStorage.setItem(widthsKey, JSON.stringify(columnWidths));
        } catch (e) {
            console.error('Error saving column widths:', e);
        }
    }, [columnWidths, widthsKey]);

    // Handle mouse move during resize
    useEffect(() => {
        if (!resizing) return;

        const handleMouseMove = (e) => {
            const diff = e.clientX - resizing.startX;
            const newWidth = Math.max(50, Math.min(500, resizing.startWidth + diff));
            setColumnWidths(prev => ({
                ...prev,
                [resizing.colKey]: newWidth
            }));
        };

        const handleMouseUp = () => {
            setResizing(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    // Calculate duplicates for HB/MBL (Ocean) or HAWB/MAWB (Air) columns
    const duplicates = useMemo(() => {
        if (!data || data.length === 0) return { primary: new Set(), secondary: new Set() };

        const primaryKey = mode === 'air' ? 'hawb' : 'hb';
        const secondaryKey = mode === 'air' ? 'mawb' : 'mbl';

        const primaryCounts = {};
        const secondaryCounts = {};

        data.forEach(row => {
            const primaryVal = row[primaryKey];
            const secondaryVal = row[secondaryKey];
            if (primaryVal && primaryVal.trim() !== '') {
                primaryCounts[primaryVal] = (primaryCounts[primaryVal] || 0) + 1;
            }
            if (secondaryVal && secondaryVal.trim() !== '') {
                secondaryCounts[secondaryVal] = (secondaryCounts[secondaryVal] || 0) + 1;
            }
        });

        const duplicatePrimary = new Set(Object.keys(primaryCounts).filter(k => primaryCounts[k] > 1));
        const duplicateSecondary = new Set(Object.keys(secondaryCounts).filter(k => secondaryCounts[k] > 1));

        return { primary: duplicatePrimary, secondary: duplicateSecondary };
    }, [data, mode]);

    const sortedData = useMemo(() => {
        if (!data || !sortConfig.key) return data || [];

        return [...data].sort((a, b) => {
            const aVal = a[sortConfig.key] || '';
            const bVal = b[sortConfig.key] || '';

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [data, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;
        }
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} />
            : <ArrowDown size={14} />;
    };

    const formatCellValue = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && (value.toLowerCase() === 'nan' || value.toLowerCase() === 'none')) {
            return '';
        }
        return value;
    };

    const isDuplicate = (colKey, value) => {
        if (!value || String(value).trim() === '') return false;
        const primaryKey = mode === 'air' ? 'hawb' : 'hb';
        const secondaryKey = mode === 'air' ? 'mawb' : 'mbl';
        if (colKey === primaryKey) return duplicates.primary.has(value);
        if (colKey === secondaryKey) return duplicates.secondary.has(value);
        return false;
    };

    const handleResizeStart = (e, colKey) => {
        e.preventDefault();
        e.stopPropagation();

        setResizing({
            colKey,
            startX: e.clientX,
            startWidth: columnWidths[colKey] || DEFAULT_WIDTHS[colKey] || 100
        });
    };

    if (loading) {
        return (
            <div className="empty-state">
                <span className="loading-spinner" style={{ width: '40px', height: '40px' }}></span>
                <h3 style={{ marginTop: '16px' }}>Loading data...</h3>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">📄</div>
                <h3>No data to display</h3>
                <p>Upload a CSV file or select a different filter</p>
            </div>
        );
    }

    return (
        <div
            className="table-container"
            style={{
                maxHeight: 'calc(100vh - 350px)',
                overflow: 'auto',
                cursor: resizing ? 'col-resize' : 'default'
            }}
        >
            <table className="data-table">
                <thead>
                    <tr>
                        {/* Row number column */}
                        <th style={{ width: 50, minWidth: 50, textAlign: 'center' }}>
                            #
                        </th>
                        {columns.map(col => (
                            <th
                                key={col.key}
                                style={{
                                    width: columnWidths[col.key] || defaultWidths[col.key] || 100,
                                    minWidth: 50,
                                    maxWidth: 500,
                                    position: 'relative',
                                    userSelect: resizing ? 'none' : 'auto'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer',
                                        paddingRight: '10px'
                                    }}
                                    onClick={() => handleSort(col.key)}
                                >
                                    {col.label}
                                    {getSortIcon(col.key)}
                                </div>
                                {/* Resize handle */}
                                <div
                                    onMouseDown={(e) => handleResizeStart(e, col.key)}
                                    style={{
                                        position: 'absolute',
                                        right: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '8px',
                                        cursor: 'col-resize',
                                        background: resizing?.colKey === col.key
                                            ? 'rgba(255, 255, 255, 0.5)'
                                            : 'transparent',
                                        zIndex: 1,
                                        transition: 'background 0.15s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!resizing) {
                                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!resizing) {
                                            e.currentTarget.style.background = 'transparent';
                                        }
                                    }}
                                />
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, idx) => (
                        <tr key={row.id || idx}>
                            {/* Row number cell */}
                            <td style={{
                                width: 50,
                                textAlign: 'center',
                                fontWeight: '500',
                                color: 'var(--text-muted)'
                            }}>
                                {idx + 1}
                            </td>
                            {columns.map(col => {
                                const value = row[col.key];
                                const hasDuplicate = isDuplicate(col.key, value);
                                return (
                                    <td
                                        key={col.key}
                                        style={{
                                            backgroundColor: hasDuplicate ? 'rgba(250, 204, 21, 0.25)' : 'transparent',
                                            width: columnWidths[col.key] || defaultWidths[col.key] || 100,
                                            maxWidth: columnWidths[col.key] || defaultWidths[col.key] || 100,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                        title={hasDuplicate ? `Duplicate ${col.key.toUpperCase()}: ${value}` : String(value || '')}
                                    >
                                        {formatCellValue(value)}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
