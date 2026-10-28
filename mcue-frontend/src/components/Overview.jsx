import React, { useEffect, useMemo, useState } from 'react';
import { clientAPI, paymentAPI, shootAPI } from '../services/api';

const dateLabel = (value) => value ? new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Date to be confirmed';
const groupedMoney = (values) => {
  const totals = values.reduce((result, item) => {
    const code = item.currency || 'INR';
    result[code] = (result[code] || 0) + (item.amount || 0);
    return result;
  }, {});
  const entries = Object.entries(totals);
  return entries.length ? entries.map(([currency, amount]) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)).join(' · ') : '₹0';
};

const Overview = ({ onNavigate }) => {
  const [clients, setClients] = useState([]);
  const [shoots, setShoots] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([clientAPI.getClients(), shootAPI.getShoots(), paymentAPI.getPayments()])
      .then(([clientResponse, shootResponse, paymentResponse]) => {
        if (!active) return;
        setClients(Array.isArray(clientResponse.data) ? clientResponse.data : []);
        setShoots(Array.isArray(shootResponse.data) ? shootResponse.data : []);
        setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || 'Unable to load the studio dashboard.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const upcoming = useMemo(() => shoots
    .filter((shoot) => ['Scheduled', 'In Progress'].includes(shoot.status))
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'))
    .slice(0, 6), [shoots]);
  const completed = shoots.filter((shoot) => shoot.status === 'Completed').length;
  const unpaid = payments.filter((payment) => payment.status !== 'Paid');
  const paid = payments.filter((payment) => payment.status === 'Paid');

  return (
    <div className="workspace-page dashboard-page">
      <section className="page-heading"><div><span className="eyebrow">MCUE STUDIO</span><h1>Dashboard</h1><p>Your client list, upcoming schedule, and payment activity in one place.</p></div><button className="button button-primary" onClick={() => onNavigate?.('shoots')} type="button"><span className="button-plus" aria-hidden="true">+</span> Add a shoot</button></section>
      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <section className="summary-grid overview-summary-grid" aria-label="Studio summary">
        <article className="summary-card"><span className="summary-icon client-icon" aria-hidden="true">♙</span><div><span className="summary-label">Clients</span><strong>{loading ? '—' : clients.length}</strong></div><button type="button" className="summary-card-link" onClick={() => onNavigate?.('clients')}>Manage clients →</button></article>
        <article className="summary-card"><span className="summary-icon scheduled-icon" aria-hidden="true">◷</span><div><span className="summary-label">Scheduled &amp; in progress</span><strong>{loading ? '—' : shoots.filter((shoot) => ['Scheduled', 'In Progress'].includes(shoot.status)).length}</strong></div><button type="button" className="summary-card-link" onClick={() => onNavigate?.('shoots')}>Open schedule →</button></article>
        <article className="summary-card"><span className="summary-icon active-icon" aria-hidden="true">✓</span><div><span className="summary-label">Completed shoots</span><strong>{loading ? '—' : completed}</strong></div><button type="button" className="summary-card-link" onClick={() => onNavigate?.('reports')}>View reports →</button></article>
        <article className="summary-card"><span className="summary-icon requested-icon" aria-hidden="true">₹</span><div><span className="summary-label">Outstanding</span><strong className="summary-money">{loading ? '—' : groupedMoney(unpaid)}</strong></div><button type="button" className="summary-card-link" onClick={() => onNavigate?.('payments')}>Review payments →</button></article>
      </section>

      <div className="overview-columns">
        <section className="panel overview-panel">
          <div className="overview-panel-heading"><div><span className="eyebrow">NEXT UP</span><h2>Upcoming shoots</h2></div><button className="table-action" type="button" onClick={() => onNavigate?.('shoots')}>See schedule →</button></div>
          {loading ? <div className="loading-state"><span className="loading-spinner" />Loading the schedule…</div> : upcoming.length ? <div className="upcoming-list">{upcoming.map((shoot) => <article className="upcoming-row" key={shoot._id}><div className="upcoming-date"><strong>{shoot.date ? new Date(shoot.date).toLocaleDateString(undefined, { day: '2-digit' }) : '—'}</strong><span>{shoot.date ? new Date(shoot.date).toLocaleDateString(undefined, { month: 'short' }) : 'TBD'}</span></div><div className="upcoming-details"><strong>{shoot.title}</strong><span>{shoot.clientId?.name || 'Client'} · {shoot.time || 'Time not set'}</span><small>{shoot.location || 'Location not set'}</small></div><span className={`status-pill status-${shoot.status.toLowerCase().replaceAll(' ', '-')}`}>{shoot.status}</span></article>)}</div> : <div className="empty-state compact-empty"><h3>No upcoming shoots</h3><p>New bookings will show here once you add them to the schedule.</p><button className="button button-secondary" onClick={() => onNavigate?.('shoots')} type="button">Add a shoot</button></div>}
        </section>

        <section className="panel overview-panel collection-panel">
          <div className="overview-panel-heading"><div><span className="eyebrow">PAYMENT TRACKING</span><h2>Recent requests</h2></div><button className="table-action" type="button" onClick={() => onNavigate?.('payments')}>Open payments →</button></div>
          {loading ? <div className="loading-state"><span className="loading-spinner" />Loading payments…</div> : payments.length ? <div className="recent-payment-list">{[...payments].slice(0, 5).map((payment) => <article className="recent-payment-row" key={payment._id}><div><strong>{payment.clientName || payment.clientId?.name || 'Client'}</strong><span>{payment.shootTitle || payment.shootId?.title || 'Shoot'}</span></div><div className="recent-payment-amount"><strong>{new Intl.NumberFormat('en-IN', { style: 'currency', currency: payment.currency || 'INR', maximumFractionDigits: 0 }).format(payment.amount || 0)}</strong><span className={`payment-status payment-status-${payment.status.toLowerCase()}`}>{payment.status}</span></div></article>)}</div> : <div className="empty-state compact-empty"><h3>No payment requests</h3><p>Requests are emailed when a shoot is marked done.</p></div>}
          <div className="collection-footer"><span>Received</span><strong>{loading ? '—' : groupedMoney(paid)}</strong><button type="button" onClick={() => onNavigate?.('reports')}>Open studio reports →</button></div>
        </section>
      </div>
    </div>
  );
};

export default Overview;
