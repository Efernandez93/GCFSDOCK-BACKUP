/**
 * Manual Dock Tally Report Component
 * Generates printable dock tally reports from manually entered data
 */

import React, { useState, useRef, useMemo } from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export default function ManualDockTallyReport({ isOpen, onClose, entries = [], customIdentifier = '', mode = 'ocean' }) {
    const [generating, setGenerating] = useState(false);
    const printRef = useRef(null);

    // Group entries by MBL
    const groupedData = useMemo(() => {
        if (!entries || entries.length === 0) return {};

        const grouped = {};

        for (const row of entries) {
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

        // Convert Sets to Arrays
        for (const key in grouped) {
            grouped[key].containers = Array.from(grouped[key].containers);
        }

        return grouped;
    }, [entries]);

    const mblList = Object.keys(groupedData);

    // Render Ocean report content
    const renderOceanContent = () => {
        let html = '';

        mblList.forEach((mbl, mblIdx) => {
            const group = groupedData[mbl];
            if (!group) return;

            const itemsPerPage = 6;
            const pages = [];
            for (let i = 0; i < group.items.length; i += itemsPerPage) {
                pages.push(group.items.slice(i, i + itemsPerPage));
            }

            pages.forEach((pageItems, pageIdx) => {
                // Add page break before new MBLs (except the first) and before continuation pages
                if (mblIdx > 0 && pageIdx === 0) {
                    html += `<div class="page-break" style="page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0;"></div>`;
                } else if (pageIdx > 0) {
                    html += `<div class="page-break" style="page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0;"></div>`;
                }

                html += `<div style="page-break-inside: avoid; color: black; font-family: Arial, sans-serif; font-size: 11px; background-color: white;">`;

                // Header (only on first page of each MBL)
                if (pageIdx === 0) {
                    html += `
                        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: -2px; position: relative; z-index: 1;">
                            <tbody>
                                <tr>
                                    <td colspan="2" style="text-align: center; font-weight: bold; font-size: 14px; padding: 6px; border-bottom: 2px solid black; border-right: 2px solid black;">
                                        Ocean Dock Tally Report
                                    </td>
                                    <td style="text-align: center; font-weight: bold; font-size: 14px; padding: 6px; border-bottom: 2px solid black; width: 12%;">
                                        ${customIdentifier ? '#' + customIdentifier : ''}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="width: 30%; padding: 6px 10px; border-right: 1px solid black; font-weight: bold;">
                                        MBL: ${mbl}
                                    </td>
                                    <td style="width: 40%; padding: 6px 10px; border-right: 1px solid black; font-weight: bold; text-align: center;">
                                        Container: ${group.containers.join(', ')}
                                    </td>
                                    <td style="width: 30%; padding: 6px 10px; font-weight: bold;">
                                        Arrival:
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    `;
                }

                // Data table
                html += `
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px; border: 2px solid black; border-top: ${pageIdx === 0 ? 'none' : '2px solid black'};">
                        <thead>
                            <tr>
                                <th style="width: 15%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">HB</th>
                                <th style="width: 12%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">Dest</th>
                                <th style="width: 10%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">
                                    <div>Mfst Qty</div>
                                    <div style="font-size: 8px; font-weight: normal;">(Outer/PCS)</div>
                                </th>
                                <th style="width: 10%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">PCS</th>
                                <th style="width: 10%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">LOC</th>
                                <th style="width: 10%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">TIME</th>
                                <th style="width: 10%; padding: 6px 4px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold;">DMG</th>
                                <th style="width: 10%; padding: 6px 4px; border-bottom: 1px solid black; font-weight: bold;">CRW</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                pageItems.forEach(item => {
                    html += `
                        <tr>
                            <td style="padding: 6px; border-right: 1px solid black; border-bottom: 1px solid black; font-weight: bold; vertical-align: middle; height: 28px;">
                                ${item.hb || ''}
                            </td>
                            <td style="padding: 6px; border-right: 1px solid black; border-bottom: 1px solid black; vertical-align: middle;">
                                ${item.dest || ''}
                            </td>
                            <td style="border-right: 1px solid black; border-bottom: 1px solid black; text-align: center; vertical-align: middle; padding: 0;">
                                <div style="border-bottom: 1px solid black; padding: 4px; font-weight: bold;">${item.outer_quantity || ''}</div>
                                <div style="padding: 4px;">${item.pcs || ''}</div>
                            </td>
                            <td style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 1px solid black;"></td>
                            <td style="border-bottom: 1px solid black;"></td>
                        </tr>
                        <tr>
                            <td style="height: 50px; border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-right: 1px solid black; border-bottom: 2px solid black;"></td>
                            <td style="border-bottom: 2px solid black;"></td>
                        </tr>
                    `;
                });

                html += `</tbody></table></div>`;
            });
        });

        return html;
    };

    const handleDownloadPDF = async () => {
        if (!printRef.current || entries.length === 0) return;

        setGenerating(true);

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const idSuffix = customIdentifier ? `-${customIdentifier}` : '';
            const filename = `Ocean_Manual_Dock_Tally_${timestamp}${idSuffix}.pdf`;

            const opt = {
                margin: [5, 10, 5, 10],
                filename: filename,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: {
                    scale: 1.5,
                    useCORS: true,
                    letterRendering: true,
                    logging: false,
                    windowWidth: 1100
                },
                jsPDF: {
                    unit: 'mm',
                    format: 'letter',
                    orientation: 'landscape'
                },
                pagebreak: {
                    mode: ['css', 'legacy'],
                    before: '.page-break'
                }
            };

            await html2pdf().set(opt).from(printRef.current).save();

        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Error generating PDF: ' + (err.message || 'Please try again.'));
        }

        setGenerating(false);
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        const printWindow = window.open('', '', 'width=900,height=700');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Ocean Dock Tally Report${customIdentifier ? ' #' + customIdentifier : ''}</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        font-size: 11pt;
                        margin: 0;
                        padding: 20px;
                    }
                    .page-break {
                        page-break-before: always;
                    }
                    @media print {
                        .page-break {
                            page-break-before: always;
                        }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
            </body>
            </html>
        `);

        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '1000px', maxHeight: '90vh' }}
            >
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={20} />
                        Manual Ocean Dock Tally Report
                        {customIdentifier && (
                            <span style={{
                                fontSize: '0.875rem',
                                background: 'var(--navy-dark)',
                                color: 'white',
                                padding: '2px 10px',
                                borderRadius: '4px',
                                marginLeft: '8px'
                            }}>
                                #{customIdentifier}
                            </span>
                        )}
                    </h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body" style={{ overflow: 'auto' }}>
                    {entries.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <h3>No entries available</h3>
                            <p>Please add some entries first.</p>
                        </div>
                    ) : (
                        <>
                            <div style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
                                Preview: {entries.length} entries across {mblList.length} MBL(s)
                            </div>

                            {/* Preview */}
                            <div style={{
                                maxHeight: '400px',
                                overflowY: 'auto',
                                border: '1px solid var(--border-color)',
                                borderRadius: 'var(--radius-md)',
                                background: 'white'
                            }}>
                                <div
                                    ref={printRef}
                                    dangerouslySetInnerHTML={{ __html: renderOceanContent() }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrint}
                        disabled={entries.length === 0 || generating}
                    >
                        <Printer size={18} />
                        Print
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleDownloadPDF}
                        disabled={entries.length === 0 || generating}
                    >
                        {generating ? (
                            <>
                                <span className="loading-spinner" style={{ width: '16px', height: '16px' }}></span>
                                Generating...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Download PDF
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
