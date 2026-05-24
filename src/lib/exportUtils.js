import { hoursToLabel } from './utils';

// ─── Shared download helper ───────────────────────────────────────────────────

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dayLabel(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function deltaStr(delta) {
  return (delta >= 0 ? '+' : '') + hoursToLabel(delta);
}

// ─── CSV ──────────────────────────────────────────────────────────────────────

export function exportDiffCsv(diff, startDate, endDate) {
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [];

  rows.push([q('Reality Check'), q(`${startDate} to ${endDate}`)]);
  rows.push([]);
  rows.push([q('SUMMARY')]);
  rows.push([q('Category'), q('Planned (h)'), q('Actual (h)'), q('Delta (h)')]);
  for (const { category, planned, actual, delta } of Object.values(diff.byCategory)) {
    rows.push([q(category.label), q(hoursToLabel(planned)), q(hoursToLabel(actual)), q(deltaStr(delta))]);
  }

  rows.push([]);
  rows.push([q('DAY-BY-DAY BREAKDOWN')]);
  rows.push([q('Date'), q('Category'), q('Planned (h)'), q('Actual (h)'), q('Delta (h)')]);
  for (const dateStr of Object.keys(diff.byDay).sort()) {
    const label = dayLabel(dateStr);
    for (const { category, planned, actual, delta } of Object.values(diff.byDay[dateStr])) {
      rows.push([q(label), q(category.label), q(hoursToLabel(planned)), q(hoursToLabel(actual)), q(deltaStr(delta))]);
    }
  }

  const csv = rows.map(r => r.join(',')).join('\n');
  downloadBlob(csv, `reality-check-${startDate}-to-${endDate}.csv`, 'text/csv;charset=utf-8');
}

// ─── JSON ─────────────────────────────────────────────────────────────────────

export function exportDiffJson(diff, startDate, endDate) {
  const payload = {
    range: { start: startDate, end: endDate },
    summary: Object.values(diff.byCategory).map(({ category, planned, actual, delta }) => ({
      category: category.label,
      color: category.color,
      planned_hours: planned,
      actual_hours: actual,
      delta_hours: parseFloat(delta.toFixed(2)),
    })),
    daily: Object.keys(diff.byDay).sort().map(dateStr => ({
      date: dateStr,
      label: dayLabel(dateStr),
      entries: Object.values(diff.byDay[dateStr]).map(({ category, planned, actual, delta }) => ({
        category: category.label,
        planned_hours: planned,
        actual_hours: actual,
        delta_hours: parseFloat(delta.toFixed(2)),
      })),
    })),
  };

  downloadBlob(
    JSON.stringify(payload, null, 2),
    `reality-check-${startDate}-to-${endDate}.json`,
    'application/json'
  );
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

export async function exportDiffPdf(diff, startDate, endDate) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  const headerFill = [30, 41, 59];   // slate-800
  const borderColor = [226, 232, 240]; // slate-200

  // Title
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  doc.text('Reality Check', 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`${startDate}  →  ${endDate}`, 14, 30);

  // Summary table
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Summary', 14, 44);

  autoTable(doc, {
    startY: 48,
    head: [['Category', 'Planned', 'Actual', 'Delta']],
    body: Object.values(diff.byCategory).map(({ category, planned, actual, delta }) => [
      category.label,
      hoursToLabel(planned),
      hoursToLabel(actual),
      deltaStr(delta),
    ]),
    headStyles: { fillColor: headerFill, fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    tableLineColor: borderColor,
    tableLineWidth: 0.1,
  });

  // Day-by-day table
  const dayRows = [];
  for (const dateStr of Object.keys(diff.byDay).sort()) {
    const label = dayLabel(dateStr);
    for (const { category, planned, actual, delta } of Object.values(diff.byDay[dateStr])) {
      dayRows.push([label, category.label, hoursToLabel(planned), hoursToLabel(actual), deltaStr(delta)]);
    }
  }

  if (dayRows.length > 0) {
    const afterSummary = (doc.lastAutoTable?.finalY ?? 60) + 14;
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42);
    doc.text('Day-by-Day Breakdown', 14, afterSummary);

    autoTable(doc, {
      startY: afterSummary + 4,
      head: [['Date', 'Category', 'Planned', 'Actual', 'Delta']],
      body: dayRows,
      headStyles: { fillColor: headerFill, fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      tableLineColor: borderColor,
      tableLineWidth: 0.1,
    });
  }

  doc.save(`reality-check-${startDate}-to-${endDate}.pdf`);
}
