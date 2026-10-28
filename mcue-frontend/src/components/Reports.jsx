import React, { useEffect, useMemo, useState } from 'react';
import { paymentAPI, shootAPI } from '../services/api';

const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const currencyTotals = (items) => {
  const grouped = items.reduce((totals, item) => {
    const currency = item.currency || 'INR';
    totals[currency] = (totals[currency] || 0) + (item.amount || 0);
    return totals;
  }, {});
  const entries = Object.entries(grouped);
  return entries.length ? entries.map(([currency, amount]) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)).join(' · ') : '₹0';
};
const csvCell = (value) => {
  const safeValue = String(value ?? '').replace(/[\r\n]+/g, ' ');
  const spreadsheetSafe = /^[=+@\-]/.test(safeValue) ? `'${safeValue}` : safeValue;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
};
const insideRange = (date, from, to) => {
  const day = date ? new Date(date).toISOString().slice(0, 10) : '';
  return (!from || (day && day >= from)) && (!to || (day && day <= to));
};

const Reports = () => {
  const [shoots, setShoots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([shootAPI.getShoots(), paymentAPI.getPayments()])
      .then(([shootResponse, paymentResponse]) => {
        if (!active) return;
        setShoots(Array.isArray(shootResponse.data) ? shootResponse.data : []);
        setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load studio reports.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const reportRows = useMemo(() => {
    const paymentByShoot = new Map(payments.map((payment) => [payment.shootId?._id || payment.shootId, payment]));
    const knownPaymentIds = new Set();
    const rows = shoots.filter((shoot) => insideRange(shoot.date || shoot.createdAt, from, to)).map((shoot) => {
      const payment = paymentByShoot.get(shoot._id);
      if (payment) knownPaymentIds.add(payment._id);
      return { shoot, payment };
    });
    payments.forEach((payment) => {
      if (knownPaymentIds.has(payment._id)) return;
      const date = payment.shootId?.date || payment.createdAt;
      if (insideRange(date, from, to)) rows.push({ shoot: payment.shootId || null, payment });
    });
    return rows;
  }, [shoots, payments, from, to]);

  const completedCount = reportRows.filter(({ shoot }) => shoot?.status === 'Completed').length;
  const invoiced = reportRows.map(({ payment }) => payment).filter(Boolean);
  const outstanding = invoiced.filter((payment) => payment.status !== 'Paid');
  const received = invoiced.filter((payment) => payment.status === 'Paid');

  const exportCsv = () => {
    const columns = ['Shoot ID', 'Client', 'Client email', 'Shoot title', 'Shoot date', 'Start time', 'Location', 'Shoot status', 'Invoice amount', 'Currency', 'Payment status', 'Payment due date', 'Payment email status', 'Email last sent', 'Paid date'];
    const records = reportRows.map(({ shoot, payment }) => [
      shoot?._id || payment?.shootId?._id || payment?.shootId || '',
      payment?.clientName || shoot?.clientId?.name || payment?.clientId?.name || '',
      payment?.clientEmail || shoot?.clientId?.email || payment?.clientId?.email || '',
      payment?.shootTitle || shoot?.title || '',
      shoot?.date ? dateLabel(shoot.date) : '',
      shoot?.time || '',
      shoot?.location || '',
      shoot?.status || '',
      payment?.amount ?? '',
      payment?.currency || '',
      payment?.status || '',
      payment?.dueDate ? dateLabel(payment.dueDate) : '',
      payment?.emailStatus || '',
      payment?.emailSentAt ? dateLabel(payment.emailSentAt) : '',
      payment?.paidAt ? dateLabel(payment.paidAt) : '',
    ]);
    const csv = [columns, ...records].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const file = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mcue-studio-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="workspace-page">
      <section className="page-heading"><div><span className="eyebrow">STUDIO PERFORMANCE</span><h1>Reports</h1><p>Review shoot activity and payment collection, then export a detailed spreadsheet for your records.</p></div><button className="button button-primary" onClick={exportCsv} type="button" disabled={loading || reportRows.length === 0}>↓ Export CSV</button></section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <section className="panel report-filter-panel">
        <div><strong>Report period</strong><span>Use shoot dates; unscheduled sessions use their record creation date.</span></div>
        <label className="report-date-field">From<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="report-date-field">To<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
        {(from || to) && <button className="table-action" onClick={() => { setFrom(''); setTo(''); }} type="button">Clear dates</button>}
      </section>

      <section className="summary-grid report-summary-grid" aria-label="Report totals">
        <article className="summary-card"><span className="summary-icon client-icon" aria-hidden="true">▣</span><div><span className="summary-label">Shoot records</span><strong>{loading ? '—' : reportRows.length}</strong></div></article>
        <article className="summary-card"><span className="summary-icon active-icon" aria-hidden="true">✓</span><div><span className="summary-label">Completed</span><strong>{loading ? '—' : completedCount}</strong></div></article>
        <article className="summary-card"><span className="summary-icon scheduled-icon" aria-hidden="true">₹</span><div><span className="summary-label">Total invoiced</span><strong className="summary-money">{loading ? '—' : currencyTotals(invoiced)}</strong></div></article>
        <article className="summary-card"><span className="summary-icon active-icon" aria-hidden="true">✓</span><div><span className="summary-label">Received</span><strong className="summary-money">{loading ? '—' : currencyTotals(received)}</strong></div></article>
        <article className="summary-card"><span className="summary-icon requested-icon" aria-hidden="true">◷</span><div><span className="summary-label">Outstanding</span><strong className="summary-money">{loading ? '—' : currencyTotals(outstanding)}</strong></div></article>
      </section>

      <section className="panel data-panel">
        <div className="data-panel-heading"><div><h2>Report detail</h2><p>{reportRows.length} shoot and payment record{reportRows.length === 1 ? '' : 's'} in this period.</p></div></div>
        {loading ? <div className="loading-state"><span className="loading-spinner" />Preparing your report…</div> : reportRows.length === 0 ? <div className="empty-state table-empty"><span className="empty-state-icon" aria-hidden="true">▤</span><h3>No records for this period</h3><p>Change or clear the dates to view other studio activity.</p></div> : (
          <div className="table-scroll"><table className="data-table report-table">
            <thead><tr><th>Shoot</th><th>Client</th><th>Date</th><th>Shoot status</th><th>Invoice</th><th>Payment status</th><th>Email status</th></tr></thead>
            <tbody>{reportRows.map(({ shoot, payment }, index) => <tr key={shoot?._id || payment?._id || index}>
              <td><strong>{payment?.shootTitle || shoot?.title || 'Shoot record'}</strong></td>
              <td>{payment?.clientName || shoot?.clientId?.name || payment?.clientId?.name || 'Client'}</td>
              <td>{dateLabel(shoot?.date || shoot?.createdAt || payment?.createdAt)}</td>
              <td>{shoot?.status || 'Shoot record unavailable'}</td>
              <td>{payment ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: payment.currency || 'INR', maximumFractionDigits: 2 }).format(payment.amount || 0) : <span className="muted-cell">No invoice</span>}</td>
              <td>{payment ? payment.status : <span className="muted-cell">—</span>}</td>
              <td>{payment ? payment.emailStatus : <span className="muted-cell">—</span>}</td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
};

export default Reports;
