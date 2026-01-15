/**
 * Ocean Manual Entry Component
 * Allows users to paste tab-separated data and generate dock tally reports
 */

import React, { useState } from 'react';
import { ClipboardList, Trash2, FileText, AlertCircle, Plus } from 'lucide-react';
import ManualDockTallyReport from './ManualDockTallyReport';

// Column order matching the expected paste format (for parsing)
const OCEAN_MANUAL_COLUMNS = [
    { key: 'container', label: 'Container' },
    { key: 'seal', label: 'Seal #' },
    { key: 'carrier', label: 'Carrier' },
    { key: 'mbl', label: 'MBL' },
    { key: 'mi', label: 'MI' },
    { key: 'vessel', label: 'Vessel' },
    { key: 'hb', label: 'HB' },
    { key: 'outer_quantity', label: 'Outer Qty' },
    { key: 'pcs', label: 'PCS' },
    { key: 'wt_lbs', label: 'WT LBS' },
    { key: 'cnee', label: 'CNEE' },
    { key: 'frl', label: 'FRL' },
    { key: 'file_no', label: 'File No' },
    { key: 'dest', label: 'Dest' },
    { key: 'volume', label: 'Volume' },
    { key: 'vbond', label: 'VBOND#' },
    { key: 'tdf', label: 'TDF' },
];

// Columns to display in the editable table (key columns for dock tally)
const DISPLAY_COLUMNS = [
    { key: 'container', label: 'Container' },
    { key: 'mbl', label: 'MBL' },
    { key: 'hb', label: 'HB' },
    { key: 'dest', label: 'Dest' },
    { key: 'outer_quantity', label: 'Outer Qty' },
    { key: 'pcs', label: 'PCS' },
];

export default function OceanManualEntry() {
    const [customIdentifier, setCustomIdentifier] = useState('');
    const [rawText, setRawText] = useState('');
    const [entries, setEntries] = useState([]);
    const [showReport, setShowReport] = useState(false);
    const [error, setError] = useState('');

    // Parse tab-separated data
    const parseData = () => {
        setError('');

        if (!rawText.trim()) {
            setError('Please paste some data first');
            return;
        }

        const lines = rawText.trim().split('\n');
        const parsedEntries = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split('\t');
            const entry = { id: Date.now() + i };

            OCEAN_MANUAL_COLUMNS.forEach((col, idx) => {
                entry[col.key] = values[idx]?.trim() || '';
            });

            // Only add if we have at least an HB or MBL
            if (entry.hb || entry.mbl) {
                parsedEntries.push(entry);
            }
        }

        if (parsedEntries.length === 0) {
            setError('No valid entries found. Make sure data is tab-separated and includes HB or MBL values.');
            return;
        }

        setEntries(parsedEntries);
        setRawText(''); // Clear the paste area after successful parse
    };

    // Update a single entry field
    const updateEntry = (id, field, value) => {
        setEntries(prev => prev.map(entry =>
            entry.id === id ? { ...entry, [field]: value } : entry
        ));
    };

    // Delete a single entry
    const deleteEntry = (id) => {
        setEntries(prev => prev.filter(entry => entry.id !== id));
    };

    // Clear all entries
    const clearAll = () => {
        setEntries([]);
        setRawText('');
        setError('');
    };

    // Add a new blank row
    const addRow = () => {
        const newEntry = {
            id: Date.now(),
            container: '',
            seal: '',
            carrier: '',
            mbl: '',
            mi: '',
            vessel: '',
            hb: '',
            outer_quantity: '',
            pcs: '',
            wt_lbs: '',
            cnee: '',
            frl: '',
            file_no: '',
            dest: '',
            volume: '',
            vbond: '',
            tdf: '',
        };
        setEntries(prev => [...prev, newEntry]);
        setError('');
    };

    // Add multiple blank rows
    const addMultipleRows = (count) => {
        const newEntries = [];
        for (let i = 0; i < count; i++) {
            newEntries.push({
                id: Date.now() + i,
                container: '',
                seal: '',
                carrier: '',
                mbl: '',
                mi: '',
                vessel: '',
                hb: '',
                outer_quantity: '',
                pcs: '',
                wt_lbs: '',
                cnee: '',
                frl: '',
                file_no: '',
                dest: '',
                volume: '',
                vbond: '',
                tdf: '',
            });
        }
        setEntries(prev => [...prev, ...newEntries]);
        setError('');
    };

    // Generate dock tally report
    const generateReport = () => {
        if (entries.length === 0) {
            setError('No entries to generate report from');
            return;
        }
        setShowReport(true);
    };

    return (
        <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
            }}>
                <ClipboardList size={28} style={{ color: 'var(--info)' }} />
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Ocean Manual Entry</h2>
            </div>

            {/* Custom Identifier Input */}
            <div style={{
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
            }}>
                <label style={{ fontWeight: '500' }}>Custom Identifier:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: '600' }}>#</span>
                    <input
                        type="text"
                        value={customIdentifier}
                        onChange={(e) => setCustomIdentifier(e.target.value)}
                        placeholder="339"
                        style={{
                            padding: '8px 12px',
                            border: '1px solid var(--border-color)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '1rem',
                            width: '120px'
                        }}
                    />
                </div>
            </div>

            {/* Paste Area */}
            <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
            }}>
                <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '500'
                }}>
                    Paste Tab-Separated Data:
                </label>
                <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Paste data from Excel here (tab-separated)...&#10;Example: TLLU5213200	71069	ZIMU	VLC10196687	7043431562	ZIM VIRGINIA	6460048297	5	120	3131	TONTITOWN DISTRIBUTION	45995	7043431573	TUL U18-U24	6.72		1/11/2026"
                    style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '12px',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--radius-sm)',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        resize: 'vertical'
                    }}
                />
                <button
                    className="btn btn-primary"
                    onClick={parseData}
                    style={{ marginTop: '12px' }}
                >
                    Parse Data
                </button>
            </div>

            {/* OR Divider */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '20px',
                color: 'var(--text-muted)'
            }}>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
                <span style={{ fontWeight: '500' }}>OR</span>
                <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
            </div>

            {/* Manual Entry Section */}
            <div style={{
                marginBottom: '20px',
                padding: '16px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
            }}>
                <label style={{
                    display: 'block',
                    marginBottom: '12px',
                    fontWeight: '500'
                }}>
                    Add Rows Manually:
                </label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={addRow}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={16} />
                        Add 1 Row
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => addMultipleRows(5)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={16} />
                        Add 5 Rows
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => addMultipleRows(10)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        <Plus size={16} />
                        Add 10 Rows
                    </button>
                </div>
                <p style={{
                    marginTop: '12px',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)'
                }}>
                    Add blank rows and fill in the data manually. All fields in the table below are editable.
                </p>
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '12px 16px',
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {/* Parsed Entries Table */}
            {entries.length > 0 && (
                <div style={{
                    marginBottom: '20px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden'
                }}>
                    <div style={{
                        padding: '12px 16px',
                        background: 'var(--navy-dark)',
                        color: 'white',
                        fontWeight: '600',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <span>Parsed Entries ({entries.length})</span>
                        <button
                            className="btn btn-sm"
                            onClick={clearAll}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: 'white',
                                border: 'none'
                            }}
                        >
                            <Trash2 size={14} />
                            Clear All
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.8rem'
                        }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-tertiary)' }}>
                                    <th style={{
                                        padding: '8px',
                                        borderBottom: '1px solid var(--border-color)',
                                        textAlign: 'left',
                                        width: '40px'
                                    }}>
                                        #
                                    </th>
                                    {DISPLAY_COLUMNS.map(col => (
                                        <th key={col.key} style={{
                                            padding: '8px',
                                            borderBottom: '1px solid var(--border-color)',
                                            textAlign: 'left',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {col.label}
                                        </th>
                                    ))}
                                    <th style={{
                                        padding: '8px',
                                        borderBottom: '1px solid var(--border-color)',
                                        width: '60px'
                                    }}>
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, idx) => (
                                    <tr key={entry.id} style={{
                                        background: idx % 2 === 0 ? 'white' : 'var(--bg-secondary)'
                                    }}>
                                        <td style={{
                                            padding: '4px 8px',
                                            borderBottom: '1px solid var(--border-color)',
                                            color: 'var(--text-muted)'
                                        }}>
                                            {idx + 1}
                                        </td>
                                        {DISPLAY_COLUMNS.map(col => (
                                            <td key={col.key} style={{
                                                padding: '4px',
                                                borderBottom: '1px solid var(--border-color)'
                                            }}>
                                                <input
                                                    type="text"
                                                    value={entry[col.key] || ''}
                                                    onChange={(e) => updateEntry(entry.id, col.key, e.target.value)}
                                                    style={{
                                                        width: '100%',
                                                        padding: '4px 6px',
                                                        border: '1px solid transparent',
                                                        borderRadius: '3px',
                                                        fontSize: '0.8rem',
                                                        background: 'transparent'
                                                    }}
                                                    onFocus={(e) => {
                                                        e.target.style.border = '1px solid var(--info)';
                                                        e.target.style.background = 'white';
                                                    }}
                                                    onBlur={(e) => {
                                                        e.target.style.border = '1px solid transparent';
                                                        e.target.style.background = 'transparent';
                                                    }}
                                                />
                                            </td>
                                        ))}
                                        <td style={{
                                            padding: '4px 8px',
                                            borderBottom: '1px solid var(--border-color)',
                                            textAlign: 'center'
                                        }}>
                                            <button
                                                onClick={() => deleteEntry(entry.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--danger)',
                                                    padding: '4px'
                                                }}
                                                title="Delete row"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Generate Report Button */}
            {entries.length > 0 && (
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className="btn btn-primary"
                        onClick={generateReport}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        <FileText size={18} />
                        Generate Dock Tally Report
                    </button>
                </div>
            )}

            {/* Manual Dock Tally Report Modal */}
            <ManualDockTallyReport
                isOpen={showReport}
                onClose={() => setShowReport(false)}
                entries={entries}
                customIdentifier={customIdentifier}
                mode="ocean"
            />
        </div>
    );
}
