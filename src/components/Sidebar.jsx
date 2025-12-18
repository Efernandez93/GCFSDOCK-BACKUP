/**
 * Sidebar Component - Upload history and navigation
 */

import { useState } from 'react';
import {
    Upload,
    Folder,
    Trash2,
    RefreshCw,
    Package,
    Star,
    LogOut
} from 'lucide-react';

export default function Sidebar({
    uploads,
    selectedUpload,
    isMasterList,
    masterListCount,
    onSelectUpload,
    onSelectMasterList,
    onUploadClick,
    onDeleteUpload,
    onRefresh,
    onLogout
}) {
    const [deleting, setDeleting] = useState(null);

    const handleDelete = async (uploadId, e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this upload?')) {
            setDeleting(uploadId);
            await onDeleteUpload(uploadId);
            setDeleting(null);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const truncateFilename = (filename, maxLength = 25) => {
        if (filename.length <= maxLength) return filename;
        return filename.substring(0, maxLength - 3) + '...';
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <h2 style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '1.125rem'
                }}>
                    📊 Global Dock Tally
                </h2>
            </div>

            <div className="sidebar-content">
                {/* Upload Button */}
                <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginBottom: '20px' }}
                    onClick={onUploadClick}
                >
                    <Upload size={18} />
                    Upload CSV
                </button>

                {/* Master List */}
                <div style={{ marginBottom: '16px' }}>
                    <div
                        className={`upload-item master-list ${isMasterList ? 'active' : ''}`}
                        onClick={onSelectMasterList}
                    >
                        <div className="upload-date" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Package size={16} />
                            Master List
                        </div>
                        <div className="upload-count">{masterListCount} items</div>
                    </div>
                </div>

                {/* Upload History Label */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px'
                }}>
                    <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}>
                        Upload History
                    </span>
                    <button
                        className="btn btn-ghost btn-icon"
                        style={{ width: '28px', height: '28px' }}
                        onClick={onRefresh}
                        title="Refresh"
                    >
                        <RefreshCw size={14} />
                    </button>
                </div>

                {/* Upload List */}
                <div className="upload-list">
                    {uploads.length === 0 ? (
                        <div className="empty-state" style={{ padding: '20px' }}>
                            <p style={{ fontSize: '0.875rem' }}>No uploads yet</p>
                        </div>
                    ) : (
                        uploads.map((upload, index) => (
                            <div
                                key={upload.id}
                                className={`upload-item ${selectedUpload === upload.id && !isMasterList ? 'active' : ''}`}
                                onClick={() => onSelectUpload(upload.id)}
                            >
                                <div className="upload-date" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {index === 0 && <Star size={12} fill="currentColor" />}
                                    {formatDate(upload.upload_date)}
                                </div>
                                <div className="upload-filename" title={upload.filename}>
                                    {truncateFilename(upload.filename)}
                                </div>
                                <div className="upload-count" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span>{upload.row_count} rows</span>
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        style={{ width: '24px', height: '24px', opacity: 0.7 }}
                                        onClick={(e) => handleDelete(upload.id, e)}
                                        disabled={deleting === upload.id}
                                        title="Delete"
                                    >
                                        {deleting === upload.id ? (
                                            <span className="loading-spinner" style={{ width: '12px', height: '12px' }}></span>
                                        ) : (
                                            <Trash2 size={12} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="sidebar-footer">
                <button
                    className="btn btn-ghost"
                    style={{ width: '100%' }}
                    onClick={onLogout}
                >
                    <LogOut size={16} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
