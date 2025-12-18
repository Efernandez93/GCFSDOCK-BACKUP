/**
 * Upload Modal Component - CSV file upload with drag & drop
 */

import { useState, useRef } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { parseCSV, validateColumns, cleanData, cleanAirData } from '../lib/csvUtils';
import {
    saveUpload, saveReportData, updateMasterList,
    saveAirUpload, saveAirReportData, updateAirMasterList
} from '../lib/database';

export default function UploadModal({ isOpen, onClose, onSuccess, mode = 'ocean' }) {
    const [file, setFile] = useState(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [progress, setProgress] = useState({ step: '', detail: '' });
    const fileInputRef = useRef(null);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        setError('');

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.name.endsWith('.csv')) {
            setFile(droppedFile);
        } else {
            setError('Please upload a CSV file');
        }
    };

    const handleFileSelect = (e) => {
        setError('');
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError('');

        try {
            // Step 1: Parse CSV
            setProgress({ step: 'Parsing CSV...', detail: '' });
            const results = await parseCSV(file);

            if (results.errors.length > 0) {
                throw new Error(`CSV parsing error: ${results.errors[0].message}`);
            }

            // Step 2: Validate columns (mode-aware)
            setProgress({ step: 'Validating columns...', detail: '' });
            const validation = validateColumns(results.meta.fields, mode);

            if (!validation.isValid) {
                throw new Error(validation.message);
            }

            // Step 3: Clean data (mode-aware)
            setProgress({ step: 'Cleaning data...', detail: '' });
            const cleanedData = mode === 'air'
                ? cleanAirData(results.data)
                : cleanData(results.data);

            if (cleanedData.length === 0) {
                throw new Error('No valid data rows found in CSV');
            }

            setProgress({ step: 'Saving upload...', detail: `${cleanedData.length} rows` });

            // Step 4: Save upload record (mode-aware)
            const upload = mode === 'air'
                ? await saveAirUpload(file.name, cleanedData.length)
                : await saveUpload(file.name, cleanedData.length);
            if (!upload) {
                throw new Error('Failed to save upload record');
            }

            // Step 5: Save report data (mode-aware)
            setProgress({ step: 'Saving report data...', detail: '' });
            const rowsInserted = mode === 'air'
                ? await saveAirReportData(upload.id, cleanedData)
                : await saveReportData(upload.id, cleanedData);

            if (!rowsInserted) {
                throw new Error('Failed to save report data');
            }

            // Step 6: Update master list (mode-aware)
            setProgress({ step: 'Updating master list...', detail: '' });
            const { itemsAdded, itemsUpdated } = mode === 'air'
                ? await updateAirMasterList(upload.id, cleanedData)
                : await updateMasterList(upload.id, cleanedData);

            setProgress({
                step: 'Complete!',
                detail: `${rowsInserted} rows imported, ${itemsAdded} new items, ${itemsUpdated} updated`
            });

            // Success - wait a moment then close
            setTimeout(() => {
                onSuccess({
                    rowsInserted,
                    itemsAdded,
                    itemsUpdated,
                    uploadId: upload.id
                });
                handleClose();
            }, 1500);

        } catch (err) {
            setError(err.message);
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFile(null);
        setError('');
        setUploading(false);
        setProgress({ step: '', detail: '' });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={20} />
                        Upload CSV File
                    </h3>
                    <button className="btn btn-ghost btn-icon" onClick={handleClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {error && (
                        <div style={{
                            background: 'var(--danger-bg)',
                            border: '1px solid var(--danger)',
                            borderRadius: 'var(--radius-md)',
                            padding: '12px',
                            marginBottom: '16px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            color: 'var(--danger)',
                            fontSize: '0.875rem'
                        }}>
                            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!uploading ? (
                        <>
                            <div
                                className={`drop-zone ${dragActive ? 'active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                />

                                {file ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <FileText size={32} style={{ color: 'var(--accent-primary)' }} />
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{file.name}</div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                                {(file.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <Upload size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                                        <p style={{ fontWeight: '500', marginBottom: '8px' }}>
                                            Drop your CSV file here
                                        </p>
                                        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                            or click to browse
                                        </p>
                                    </>
                                )}
                            </div>

                            <div style={{
                                marginTop: '16px',
                                padding: '12px',
                                background: 'var(--bg-glass)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '0.75rem',
                                color: 'var(--text-muted)'
                            }}>
                                <strong>Required columns:</strong> {
                                    mode === 'air'
                                        ? 'MAWB, HAWB, Consignee, Carrier, FLIGHT NUMBER, FREIGHT LOCATION, ORIGIN, DESTINATION, File Number, QTY, Shipment Type, SLAC, WEIGHT, ETA, ETA TIME, LOG, Flt Date'
                                        : 'CONTAINER, SEAL #, CARRIER, MBL, MI, VESSEL, HB, OUTER QUANTITY, PCS, WT_LBS, CNEE, FRL, FILE_NO, DEST, VOLUME, VBOND#, TDF'
                                }
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            {progress.step === 'Complete!' ? (
                                <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
                            ) : (
                                <span className="loading-spinner" style={{ width: '48px', height: '48px', marginBottom: '16px', display: 'inline-block' }}></span>
                            )}
                            <p style={{ fontWeight: '500', marginBottom: '8px' }}>{progress.step}</p>
                            {progress.detail && (
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{progress.detail}</p>
                            )}
                        </div>
                    )}
                </div>

                {!uploading && (
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={handleClose}>
                            Cancel
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleUpload}
                            disabled={!file}
                        >
                            Upload
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
