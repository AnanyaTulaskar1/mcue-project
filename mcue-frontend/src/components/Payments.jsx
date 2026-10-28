import React, { useEffect, useMemo, useState } from 'react';
import { paymentAPI } from '../services/api';

const money = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);
const moneyByCurrency = (payments) => {
  const totals = payments.reduce((summary, payment) => {
    const currency = payment.currency || 'INR';
    summary[currency] = (summary[currency] || 0) + (payment.amount || 0);
    return summary;
  }, {});
  const entries = Object.entries(totals);
  return entries.length ? entries.map(([currency, amount]) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)).join(' · ') : '₹0';
};
const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date';

const Payments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState('All payments');
  const [search, setSearch] = useState('');

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await paymentAPI.getPayments();
      setPayments(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load payment records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchPayments(); }, []);

  const totals = useMemo(() => ({
    invoiced: moneyByCurrency(payments),
    paid: moneyByCurrency(payments.filter((payment) => payment.status === 'Paid')),
    outstanding: moneyByCurrency(payments.filter((payment) => payment.status !== 'Paid')),
    failedEmails: payments.filter((payment) => payment.emailStatus === 'Failed').length,
  }), [payments]);

  const filteredPayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const statusMatch = filter === 'All payments' || payment.status === filter;
      const textMatch = !query || [payment.clientName, payment.clientEmail, payment.shootTitle, payment.shootId?.title]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return statusMatch && textMatch;
    });
  }, [payments, filter, search]);

  const updateStatus = async (payment) => {
    const status = payment.status === 'Paid' ? 'Unpaid' : 'Paid';
    setSavingId(payment._id);
    setError('');
    setNotice(null);
    try {
      await paymentAPI.updatePayment(payment._id, { status });
      setNotice({ type: 'success', message: status === 'Paid' ? 'Payment marked as received.' : 'Payment marked as unpaid.' });
      await fetchPayments();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to update this payment.');
    } finally {
      setSavingId('');
    }
  };

  const resendPaymentRequest = async (payment) => {
    setSavingId(payment._id);
    setError('');
    setNotice(null);
    try {
      const response = await paymentAPI.sendPaymentRequest(payment._id);
      setNotice({ type: response.data.paymentEmailSent ? 'success' : 'warning', message: response.data.message });
      await fetchPayments();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to send the payment email.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="workspace-page">
      <section className="page-heading"><div><span className="eyebrow">INVOICES &amp; COLLECTIONS</span><h1>Payments</h1><p>Payment requests are recorded and emailed when a shoot is marked done.</p></div></section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className={`notice workflow-notice is-${notice.type}`} role="status">{notice.message}</div>}

      <section className="summary-grid payment-summary-grid" aria-label="Payment totals">
        <article className="summary-card"><span className="summary-icon client-icon" aria-hidden="true">₹</span><div><span className="summary-label">Total invoiced</span><strong className="summary-money">{loading ? '—' : totals.invoiced}</strong></div></article>
        <article className="summary-card"><span className="summary-icon active-icon" aria-hidden="true">✓</span><div><span className="summary-label">Received</span><strong className="summary-money">{loading ? '—' : totals.paid}</strong></div></article>
        <article className="summary-card"><span className="summary-icon requested-icon" aria-hidden="true">◷</span><div><span className="summary-label">Outstanding</span><strong className="summary-money">{loading ? '—' : totals.outstanding}</strong></div></article>
        <article className="summary-card"><span className="summary-icon progress-icon" aria-hidden="true">✉</span><div><span className="summary-label">Email issues</span><strong>{loading ? '—' : totals.failedEmails}</strong></div></article>
      </section>

      <section className="panel data-panel">
        <div className="data-panel-heading">
          <div><h2>Payment records</h2><p>{payments.length} saved {payments.length === 1 ? 'request' : 'requests'}</p></div>
          <div className="table-controls">
            <label className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client or shoot" aria-label="Search payments" /></label>
            <select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter payments"><option>All payments</option><option>Unpaid</option><option>Paid</option></select>
          </div>
        </div>
      {loading ? <div className="loading-state"><span className="loading-spinner" />Loading payment records…</div> : filteredPayments.length === 0 ? (
          <div className="empty-state table-empty"><span className="empty-state-icon" aria-hidden="true">₹</span><h3>{search || filter !== 'All payments' ? 'No payments match these filters' : 'No payment requests yet'}</h3><p>{search || filter !== 'All payments' ? 'Try another search or payment status.' : 'When the studio marks a shoot done, its payment record and email status will appear here.'}</p></div>
        ) : (
          <div className="table-scroll"><table className="data-table payments-table">
            <thead><tr><th>Client</th><th>Shoot</th><th>Amount</th><th>Payment status</th><th>Email status</th><th>Due date</th><th className="align-right">Actions</th></tr></thead>
            <tbody>{filteredPayments.map((payment) => {
              const paymentStatus = payment.status || 'Unpaid';
              const emailStatus = payment.emailStatus || 'Not sent';
              return <tr key={payment._id}>
              <td><div className="client-name-cell"><strong>{payment.clientName || payment.clientId?.name || 'Client'}</strong><a className="table-link" href={`mailto:${payment.clientEmail || payment.clientId?.email || ''}`}>{payment.clientEmail || payment.clientId?.email || 'No email'}</a></div></td>
              <td>{payment.shootTitle || payment.shootId?.title || 'Shoot'}</td>
              <td className="payment-amount-cell">{money(payment.amount, payment.currency)}</td>
              <td><span className={`payment-status payment-status-${paymentStatus.toLowerCase()}`}>{paymentStatus}</span></td>
              <td><div className="email-status-cell"><span className={`email-status-dot email-status-${emailStatus.toLowerCase().replaceAll(' ', '-')}`} />{emailStatus}{payment.emailLastError && <small title={payment.emailLastError}>{payment.emailLastError}</small>}</div></td>
              <td>{dateLabel(payment.dueDate)}</td>
              <td className="align-right action-cell">
                {paymentStatus !== 'Paid' && <button className="table-action" onClick={() => resendPaymentRequest(payment)} type="button" disabled={savingId === payment._id}>{savingId === payment._id ? 'Sending…' : 'Resend email'}</button>}
                <button className={`table-action${paymentStatus === 'Paid' ? '' : ' is-acknowledge'}`} onClick={() => updateStatus(payment)} type="button" disabled={savingId === payment._id}>{savingId === payment._id ? 'Saving…' : paymentStatus === 'Paid' ? 'Mark unpaid' : 'Mark paid'}</button>
              </td>
            </tr>;
            })}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
};

export default Payments;
