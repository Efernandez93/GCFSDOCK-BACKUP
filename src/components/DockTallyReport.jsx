/**
 * Dock Tally Report Component - 
 * Generates printable Ocean/Air Dock Tally Reports grouped by MBL/MAWB
 * Uses the currently filtered/displayed data from Dashboard
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, Printer, Download, FileText } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export default function DockTallyReport({ isOpen, onClose, data = [], activeFilter, mode = 'ocean' }) {
    const [selectedMBLs, setSelectedMBLs] = useState([]);
    const [generating, setGenerating] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
    const printRef = useRef(null);

    const isAir = mode === 'air';

    // Group the passed data by MBL (Ocean) or MAWB (Air)
    const groupedData = useMemo(() => {
        if (!data || data.length === 0) return {};

        const grouped = {};

        if (isAir) {
            // Air: Group by MAWB
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
            for (const key in grouped) {
                grouped[key].flights = Array.from(grouped[key].flights);
            }
        } else {
            // Ocean: Group by MBL
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
            for (const key in grouped) {
                grouped[key].containers = Array.from(grouped[key].containers);
            }
        }

        return grouped;
    }, [data, isAir]);

    // Select all items when data changes
    useEffect(() => {
        if (isOpen) {
            setSelectedMBLs(Object.keys(groupedData));
        }
    }, [isOpen, groupedData]);

    const toggleMBL = (mbl) => {
        setSelectedMBLs(prev =>
            prev.includes(mbl)
                ? prev.filter(m => m !== mbl)
                : [...prev, mbl]
        );
    };

    const selectAll = () => setSelectedMBLs(Object.keys(groupedData));
    const selectNone = () => setSelectedMBLs([]);

    const handleDownloadPDF = async () => {
        console.log('handleDownloadPDF called');
        console.log('printRef.current:', printRef.current);
        console.log('selectedMBLs:', selectedMBLs);

        if (!printRef.current || selectedMBLs.length === 0) {
            console.log('Early return - printRef or selectedMBLs empty');
            return;
        }

        setGenerating(true);
        console.log('Starting PDF generation...');

        try {
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `Dock_Tally_Report_${timestamp}.pdf`;
            console.log('Filename:', filename);

            // For small number of MBLs, generate directly
            if (selectedMBLs.length <= 15) {
                console.log('Using generateSinglePDF');
                await generateSinglePDF(printRef.current, filename);
            } else {
                // For large documents, generate in batches and merge
                console.log('Using generateBatchPDF');
                await generateBatchPDF(filename);
            }
            console.log('PDF generation completed successfully');

        } catch (err) {
            console.error('Error generating PDF:', err);
            alert('Error generating PDF: ' + (err.message || 'Please try again.'));
        }

        setGenerating(false);
    };

    // Generate a single PDF from element
    // Generate a single PDF from element
    const generateSinglePDF = async (element, filename) => {
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

        // Use .save() which handles the download automatically and reliably
        await html2pdf().set(opt).from(element).save();
    };

    // Generate PDF in batches and merge
    const generateBatchPDF = async (filename) => {
        const { PDFDocument } = await import('pdf-lib');

        const BATCH_SIZE = 10; // Smaller batches for reliability
        const batches = [];

        // Split selected MBLs into batches
        for (let i = 0; i < selectedMBLs.length; i += BATCH_SIZE) {
            batches.push(selectedMBLs.slice(i, i + BATCH_SIZE));
        }

        setProgress({ current: 0, total: batches.length, message: 'Starting PDF generation...' });
        console.log(`Generating ${batches.length} batch(es) for ${selectedMBLs.length} MBLs...`);

        // Create merged PDF document
        const mergedPdf = await PDFDocument.create();

        for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
            const batch = batches[batchIdx];
            setProgress({
                current: batchIdx + 1,
                total: batches.length,
                message: `Processing batch ${batchIdx + 1} of ${batches.length} (${batch.length} MBLs)...`
            });
            console.log(`Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} MBLs)...`);

            // Create an iframe for isolated rendering
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.left = '-9999px';
            iframe.style.top = '0';
            iframe.style.width = '1100px';
            iframe.style.height = '800px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);

            // Wait for iframe to load
            await new Promise(resolve => {
                iframe.onload = resolve;
                iframe.src = 'about:blank';
            });

            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

            // Write complete HTML document to iframe
            const batchHtml = renderBatchContent(batch);
            iframeDoc.open();
            iframeDoc.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: Arial, sans-serif; background: white; }
                        .page-break { page-break-before: always; }
                    </style>
                </head>
                <body>
                    ${batchHtml}
                </body>
                </html>
            `);
            iframeDoc.close();

            // Wait for content to render
            await new Promise(resolve => setTimeout(resolve, 500));

            // Generate PDF for this batch
            const opt = {
                margin: [5, 10, 5, 10],
                image: { type: 'jpeg', quality: 0.90 },
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

            try {
                // Get PDF as array buffer from the iframe body
                const pdfBlob = await html2pdf().set(opt).from(iframeDoc.body).outputPdf('blob');
                const pdfBytes = await pdfBlob.arrayBuffer();

                // Load and merge
                const batchPdf = await PDFDocument.load(pdfBytes);
                const pages = await mergedPdf.copyPages(batchPdf, batchPdf.getPageIndices());
                pages.forEach(page => mergedPdf.addPage(page));
            } catch (batchErr) {
                console.error(`Error in batch ${batchIdx + 1}:`, batchErr);
                throw new Error(`Failed on batch ${batchIdx + 1}: ${batchErr.message}`);
            }

            // Cleanup iframe
            document.body.removeChild(iframe);

            // Delay to prevent browser from freezing
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        setProgress({ current: batches.length, total: batches.length, message: 'Merging PDFs...' });

        // Standard download method
        const mergedPdfBytes = await mergedPdf.save();
        const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link); // Required for some browsers
        link.click();

        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
        setProgress({ current: 0, total: 0, message: '' });
        console.log('PDF generation complete!');
    };

    // Render content for a batch of items (MBLs or MAWBs)
    const renderBatchContent = (itemBatch) => {
        if (isAir) {
            return renderAirBatchContent(itemBatch);
        }
        return renderOceanBatchContent(itemBatch);
    };

    // Ocean-specific rendering
    const renderOceanBatchContent = (mblBatch) => {
        let html = '';

        mblBatch.forEach((mbl, mblIdx) => {
            const group = groupedData[mbl];
            if (!group) return;

            const itemsPerPage = 6;
            const pages = [];
            for (let i = 0; i < group.items.length; i += itemsPerPage) {
                pages.push(group.items.slice(i, i + itemsPerPage));
            }

            pages.forEach((pageItems, pageIdx) => {
                const isPageBreak = (mblIdx > 0 && pageIdx === 0) || pageIdx > 0;

                html += `<div class="${isPageBreak ? 'page-break' : ''}" style="color: black; font-family: Arial, sans-serif; font-size: 11px; background-color: white; padding-top: ${pageIdx > 0 ? '10px' : '0'};">`;

                // Header (only on first page of each MBL)
                if (pageIdx === 0) {
                    html += `
                        <table style="width: 100%; border-collapse: collapse; border: 2px solid black; margin-bottom: -2px; position: relative; z-index: 1;">
                            <tbody>
                                <tr>
                                    <td colspan="3" style="text-align: center; font-weight: bold; font-size: 14px; padding: 6px; border-bottom: 2px solid black;">
                                        Ocean Dock Tally Report
                                    </td>
                                </tr>
                                <tr>
                                    <td style="width: 35%; padding: 6px 10px; border-right: 1px solid black; font-weight: bold;">
                                        MBL: ${mbl}
                                    </td>
                                    <td style="width: 35%; padding: 6px 10px; border-right: 1px solid black; font-weight: bold;">
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

    // Air-specific rendering with SLAC/QTY and 4 Arrival sections
    const renderAirBatchContent = (mawbBatch) => {
        let html = '';
        const today = new Date();
        const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${String(today.getFullYear()).slice(-2)}`;
        const timeStr = `${today.getHours()}:${String(today.getMinutes()).padStart(2, '0')}`;

        mawbBatch.forEach((mawb, mawbIdx) => {
            const group = groupedData[mawb];
            if (!group) return;

            const itemsPerPage = 5;
            const pages = [];
            for (let i = 0; i < group.items.length; i += itemsPerPage) {
                pages.push(group.items.slice(i, i + itemsPerPage));
            }

            pages.forEach((pageItems, pageIdx) => {
                const isPageBreak = (mawbIdx > 0 && pageIdx === 0) || pageIdx > 0;
                const pageNum = pageIdx + 1;

                html += `<div class="${isPageBreak ? 'page-break' : ''}" style="color: black; font-family: Arial, sans-serif; font-size: 10px; background-color: white; padding: 5px;">`;

                // Header - Only on first page of MAWB
                if (pageIdx === 0) {
                    html += `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; border-bottom: 1px solid black; padding-bottom: 3px;">
                        <div><strong>Date:</strong> ${dateStr} ${timeStr}</div>
                        <div style="font-weight: bold; font-size: 14px;">DOCK TALLY REPORT</div>
                        <div><strong>Page:</strong> ${pageNum}</div>
                    </div>
                `;

                    // MAWB Info
                    html += `
                    <div style="font-weight: bold; font-size: 12px; margin-bottom: 4px; border: 1px solid black; padding: 3px;">
                        MAWB: ${mawb}
                    </div>
                `;
                }

                // Table with 4 arrival sections - stretch to fill page
                html += `
                    <table style="width: 100%; height: 700px; border-collapse: collapse; font-size: 8px; border: 1px solid black;">
                        <thead>
                            <tr>
                                <th rowspan="2" style="width: 7%; padding: 2px; border: 1px solid black; font-weight: bold; vertical-align: middle;">HAWB</th>
                                <th rowspan="2" style="width: 7%; padding: 2px; border: 1px solid black; font-weight: bold; vertical-align: middle;">Dest</th>
                                <th rowspan="2" style="width: 5%; padding: 2px; border: 1px solid black; font-weight: bold; vertical-align: middle;">
                                    <div>SLAC</div>
                                    <div style="font-size: 7px; font-weight: normal;">Total</div>
                                </th>
                                <th colspan="5" style="padding: 2px; border: 1px solid black; font-weight: bold; text-align: center;">Arrival 1<div style="font-size: 6px; font-weight: normal;">Supv</div></th>
                                <th colspan="5" style="padding: 2px; border: 1px solid black; font-weight: bold; text-align: center;">Arrival 2<div style="font-size: 6px; font-weight: normal;">Supv</div></th>
                                <th colspan="5" style="padding: 2px; border: 1px solid black; font-weight: bold; text-align: center;">Arrival 3<div style="font-size: 6px; font-weight: normal;">Supv</div></th>
                                <th colspan="5" style="padding: 2px; border: 1px solid black; font-weight: bold; text-align: center;">Arrival 4<div style="font-size: 6px; font-weight: normal;">Supv</div></th>
                            </tr>
                            <tr>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">PCS</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">LOC</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">TIME</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">CRW</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">SUB</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">PCS</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">LOC</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">TIME</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">CRW</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">SUB</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">PCS</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">LOC</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">TIME</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">CRW</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">SUB</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">PCS</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">LOC</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">TIME</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">CRW</th>
                                <th style="width: 3%; padding: 1px; border: 1px solid black; font-size: 6px;">SUB</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                // Always render exactly 5 rows for uniform spacing
                for (let i = 0; i < 5; i++) {
                    const item = pageItems[i] || {}; // Use empty object if no item exists
                    html += `
                        <tr style="height: 20%;">
                            <td style="padding: 3px; border: 1px solid black; font-weight: bold; vertical-align: top; font-size: 9px;">
                                ${item.hawb || ''}
                            </td>
                            <td style="padding: 3px; border: 1px solid black; vertical-align: top; font-size: 7px;">
                                ${item.destination || ''}
                            </td>
                            <td style="padding: 0; border: 1px solid black; text-align: center; vertical-align: top;">
                                <div style="border-bottom: 1px solid black; padding: 2px; font-weight: bold;">${item.slac || ''}</div>
                                <div style="padding: 2px; font-size: 7px;">${item.qty || ''}</div>
                            </td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                            <td style="border: 1px solid black;"></td>
                        </tr>
                        <tr style="height: 20%;">
                            <td colspan="3" style="border: 1px solid black; padding: 2px; vertical-align: top; font-size: 7px;">
                                <span style="color: #666;">Dock Notes:</span>
                            </td>
                            <td colspan="5" style="border: 1px solid black;"></td>
                            <td colspan="5" style="border: 1px solid black;"></td>
                            <td colspan="5" style="border: 1px solid black;"></td>
                            <td colspan="5" style="border: 1px solid black;"></td>
                        </tr>
                    `;
                }

                html += `</tbody></table></div>`;
            });
        });

        return html;
    };

    const handlePrint = () => {
        const printContent = printRef.current;
        const printWindow = window.open('', '', 'width=900,height=700');

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ocean Dock Tally Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            margin: 0;
            padding: 20px;
          }
          .report-page {
            page-break-after: always;
            margin-bottom: 20px;
          }
          .report-page:last-child {
            page-break-after: auto;
          }
          .report-header {
            border: 2px solid black;
            margin-bottom: 0;
          }
          .report-title {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            padding: 8px;
            border-bottom: 2px solid black;
          }
          .report-info-grid {
            display: flex;
          }
          .report-left-panel {
            width: 220px;
            border-right: 2px solid black;
            padding: 10px;
          }
          .report-left-panel p {
            margin: 4px 0;
            font-weight: bold;
          }
          .report-right-panel {
            flex: 1;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid black;
            padding: 6px 8px;
            text-align: left;
          }
          th {
            background: #e0e0e0;
            font-weight: bold;
            font-size: 10pt;
          }
          .arrival-header {
            text-align: center;
            font-weight: bold;
            padding: 4px;
            background: #f0f0f0;
          }
          .mfst-cell {
            display: flex;
            flex-direction: column;
          }
          .mfst-outer {
            border-bottom: 1px solid #999;
            padding-bottom: 2px;
          }
          .mfst-pcs {
            padding-top: 2px;
          }
          @media print {
            .report-page {
              page-break-after: always;
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

    const mblList = Object.keys(groupedData);
    const itemLabel = isAir ? 'MAWBs' : 'MBLs';

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
                        Generate {isAir ? 'Air' : 'Ocean'} Dock Tally Report
                        {activeFilter && activeFilter !== 'all' && (
                            <span style={{
                                fontSize: '0.75rem',
                                background: 'var(--navy-dark)',
                                color: 'white',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                marginLeft: '8px'
                            }}>
                                Filtered: {activeFilter.replace('_', ' ').toUpperCase()}
                            </span>
                        )}
                    </h3>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body" style={{ overflow: 'auto' }}>
                    {mblList.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📄</div>
                            <h3>No data available</h3>
                            <p>Upload a CSV file first to generate reports.</p>
                        </div>
                    ) : (
                        <>
                            {/* MBL Selection */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px'
                                }}>
                                    <span style={{ fontWeight: '500' }}>
                                        Select {itemLabel} to include ({selectedMBLs.length} of {mblList.length})
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button className="btn btn-sm btn-secondary" onClick={selectAll}>
                                            Select All
                                        </button>
                                        <button className="btn btn-sm btn-secondary" onClick={selectNone}>
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                    maxHeight: '120px',
                                    overflowY: 'auto',
                                    padding: '12px',
                                    background: 'var(--bg-tertiary)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {mblList.map(mbl => (
                                        <label
                                            key={mbl}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                padding: '6px 12px',
                                                background: selectedMBLs.includes(mbl) ? 'var(--navy-dark)' : 'white',
                                                color: selectedMBLs.includes(mbl) ? 'white' : 'var(--text-primary)',
                                                borderRadius: 'var(--radius-sm)',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                border: '1px solid var(--border-color)',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedMBLs.includes(mbl)}
                                                onChange={() => toggleMBL(mbl)}
                                                style={{ display: 'none' }}
                                            />
                                            {mbl}
                                            <span style={{
                                                fontSize: '0.75rem',
                                                opacity: 0.7
                                            }}>
                                                ({groupedData[mbl].items.length})
                                            </span>
                                        </label>
                                    ))}
                                </div>
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
                                    dangerouslySetInnerHTML={{ __html: renderBatchContent(selectedMBLs) }}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="modal-footer" style={{ flexDirection: 'column', gap: '12px' }}>
                    {/* Progress Bar */}
                    {generating && progress.total > 0 && (
                        <div style={{ width: '100%' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                marginBottom: '6px',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)'
                            }}>
                                <span>{progress.message}</span>
                                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
                            </div>
                            <div style={{
                                width: '100%',
                                height: '8px',
                                background: 'var(--bg-tertiary)',
                                borderRadius: '4px',
                                overflow: 'hidden'
                            }}>
                                <div style={{
                                    width: `${(progress.current / progress.total) * 100}%`,
                                    height: '100%',
                                    background: 'linear-gradient(90deg, var(--cyan-primary), var(--cyan-light))',
                                    borderRadius: '4px',
                                    transition: 'width 0.3s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
                        <button className="btn btn-secondary" onClick={onClose}>
                            Close
                        </button>
                        <button
                            className="btn btn-secondary"
                            onClick={handlePrint}
                            disabled={selectedMBLs.length === 0 || generating}
                        >
                            <Printer size={18} />
                            Print
                        </button>
                        <button
                            className="btn btn-primary"
                            onClick={handleDownloadPDF}
                            disabled={selectedMBLs.length === 0 || generating}
                        >
                            {generating ? (
                                <>
                                    <span className="loading-spinner" style={{ width: '16px', height: '16px' }}></span>
                                    {progress.total > 0 ? `Batch ${progress.current}/${progress.total}` : 'Generating...'}
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
        </div>
    );
}
