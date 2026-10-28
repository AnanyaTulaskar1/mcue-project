import React, { useEffect, useMemo, useState } from 'react';
import { clientAPI, paymentAPI, shootAPI } from '../services/api';

const emptyShoot = { title: '', clientId: '', date: '', time: '', location: '', status: 'Scheduled', description: '', notes: '' };
const editableStatuses = ['Scheduled', 'Cancelled'];
const needsDateTime = (status) => ['Scheduled', 'In Progress', 'Completed'].includes(status);
const dateInput = (value) => value ? String(value).slice(0, 10) : '';
const formatDate = (value, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not scheduled' : date.toLocaleDateString(undefined, options);
};
const formatMoney = (amount, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount || 0);

const Shoots = ({ onNavigate }) => {
  const [shoots, setShoots] = useState([]);
  const [clients, setClients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All statuses');
  const [editingShoot, setEditingShoot] = useState(null);
  const [isShootModalOpen, setShootModalOpen] = useState(false);
  const [completionShoot, setCompletionShoot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [shootForm, setShootForm] = useState(emptyShoot);
  const [paymentForm, setPaymentForm] = useState({ amount: '', currency: 'INR', dueDate: '', paymentUrl: '', paymentInstructions: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [shootResponse, clientResponse, paymentResponse] = await Promise.all([
        shootAPI.getShoots(), clientAPI.getClients(), paymentAPI.getPayments()
      ]);
      setShoots(Array.isArray(shootResponse.data) ? shootResponse.data : []);
      setClients(Array.isArray(clientResponse.data) ? clientResponse.data : []);
      setPayments(Array.isArray(paymentResponse.data) ? paymentResponse.data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to load shoots. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchData(); }, []);

  const paymentByShoot = useMemo(() => new Map(payments.map((payment) => [payment.shootId?._id || payment.shootId, payment])), [payments]);
  const counts = useMemo(() => ({
    total: shoots.length,
    scheduled: shoots.filter((shoot) => shoot.status === 'Scheduled').length,
    inProgress: shoots.filter((shoot) => shoot.status === 'In Progress').length,
    completed: shoots.filter((shoot) => shoot.status === 'Completed').length,
  }), [shoots]);

  const filteredShoots = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shoots.filter((shoot) => {
      const matchesStatus = statusFilter === 'All statuses' || shoot.status === statusFilter;
      const clientName = shoot.clientId?.name || '';
      const matchesSearch = !query || [shoot.title, shoot.location, shoot.description, clientName, shoot.clientId?.email]
        .some((value) => String(value || '').toLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    }).sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
      const bDate = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
  }, [shoots, search, statusFilter]);

  const openShootModal = (shoot = null) => {
    setError('');
    setNotice(null);
    setEditingShoot(shoot);
    setShootForm(shoot ? {
      title: shoot.title || '',
      clientId: shoot.clientId?._id || shoot.clientId || '',
      date: dateInput(shoot.date),
      time: shoot.time || '',
      location: shoot.location || '',
      status: shoot.status || 'Scheduled',
      description: shoot.description || '',
      notes: shoot.notes || '',
    } : { ...emptyShoot });
    setShootModalOpen(true);
  };

  const closeShootModal = () => {
    setShootModalOpen(false);
    setEditingShoot(null);
    setShootForm({ ...emptyShoot });
  };

  const openCompletionModal = (shoot) => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);
    setCompletionShoot(shoot);
    setPaymentForm({ amount: '', currency: 'INR', dueDate: dueDate.toISOString().slice(0, 10), paymentUrl: '', paymentInstructions: '' });
    setError('');
    setNotice(null);
  };

  const handleShootSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      const payload = { ...shootForm, date: shootForm.date || '', time: shootForm.time || '' };
      if (editingShoot) await shootAPI.updateShoot(editingShoot._id, payload);
      else await shootAPI.createShoot(payload);
      closeShootModal();
      setNotice({ type: 'success', message: editingShoot ? 'Shoot details saved.' : 'Shoot added to the studio schedule.' });
      await fetchData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save this shoot. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteShoot = async (event) => {
    event.preventDefault();
    if (!completionShoot) return;
    setIsSaving(true);
    setError('');
    try {
      const response = await shootAPI.completeShoot(completionShoot._id, {
        ...paymentForm,
        amount: Number(paymentForm.amount),
        dueDate: paymentForm.dueDate || '',
      });
      setCompletionShoot(null);
      setNotice({
        type: response.data.paymentEmailSent ? 'success' : 'warning',
        message: response.data.message,
      });
      await fetchData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to complete this shoot. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (shoot) => {
    if (!window.confirm(`Remove “${shoot.title || 'this shoot'}” from the schedule?`)) return;
    setError('');
    try {
      await shootAPI.deleteShoot(shoot._id);
      setNotice({ type: 'success', message: 'Shoot removed from the schedule.' });
      await fetchData();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to remove this shoot.');
    }
  };

  return (
    <div className="workspace-page">
      <section className="page-heading">
        <div><span className="eyebrow">SCHEDULE &amp; PRODUCTION</span><h1>Shoots</h1><p>Add each booking after a client conversation, then track its schedule through completion.</p></div>
        <button className="button button-primary" onClick={() => openShootModal()} type="button"><span className="button-plus" aria-hidden="true">+</span> Add shoot</button>
      </section>

      {error && <div className="notice notice-error" role="alert">{error}</div>}
      {notice && <div className={`notice workflow-notice is-${notice.type}`} role="status">{notice.message}</div>}

      <section className="summary-grid shoot-summary-grid" aria-label="Shoot overview">
        <article className="summary-card"><span className="summary-icon client-icon" aria-hidden="true">▣</span><div><span className="summary-label">All shoots</span><strong>{loading ? '—' : counts.total}</strong></div></article>
        <article className="summary-card"><span className="summary-icon scheduled-icon" aria-hidden="true">◷</span><div><span className="summary-label">Scheduled</span><strong>{loading ? '—' : counts.scheduled}</strong></div></article>
        <article className="summary-card"><span className="summary-icon progress-icon" aria-hidden="true">◉</span><div><span className="summary-label">In progress</span><strong>{loading ? '—' : counts.inProgress}</strong></div></article>
        <article className="summary-card"><span className="summary-icon active-icon" aria-hidden="true">✓</span><div><span className="summary-label">Completed</span><strong>{loading ? '—' : counts.completed}</strong></div></article>
      </section>

      <section className="panel data-panel">
        <div className="data-panel-heading shoots-panel-heading">
          <div><h2>Studio schedule</h2><p>One record for every client session.</p></div>
          <div className="table-controls">
            <label className="search-field"><span className="search-icon" aria-hidden="true">⌕</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shoots" aria-label="Search shoots" /></label>
            <select className="filter-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter shoots by status">
              <option>All statuses</option>{['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Requested', 'Acknowledged'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="loading-state"><span className="loading-spinner" />Loading shoots…</div> : filteredShoots.length === 0 ? (
          <div className="empty-state table-empty"><span className="empty-state-icon" aria-hidden="true">▣</span><h3>{search || statusFilter !== 'All statuses' ? 'No shoots match these filters' : 'Your schedule is ready'}</h3><p>{search || statusFilter !== 'All statuses' ? 'Try another search or status.' : 'Create a client record first, then add the first shoot.'}</p>{!search && statusFilter === 'All statuses' && (clients.length ? <button className="button button-secondary" onClick={() => openShootModal()} type="button">Add the first shoot</button> : <button className="button button-secondary" onClick={() => onNavigate?.('clients')} type="button">Add a client</button>)}</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table shoots-table">
              <thead><tr><th>Session</th><th>Client</th><th>Date &amp; time</th><th>Location</th><th>Status</th><th>Payment</th><th className="align-right">Actions</th></tr></thead>
              <tbody>{filteredShoots.map((shoot) => {
                const payment = paymentByShoot.get(shoot._id);
                const needsPayment = shoot.status === 'Completed' && !payment;
                return <tr key={shoot._id}>
                  <td><div className="shoot-title-cell"><span className="shoot-type-mark" aria-hidden="true">✳</span><div><strong>{shoot.title}</strong><span>{shoot.description || 'Studio booking'}</span></div></div></td>
                  <td><div className="client-name-cell"><strong>{shoot.clientId?.name || 'Client record missing'}</strong><span>{shoot.clientId?.email || 'No email'}</span></div></td>
                  <td className="date-cell"><div className="shoot-date-time"><strong>{formatDate(shoot.date)}</strong>{shoot.time && <span>{shoot.time}</span>}</div></td>
                  <td>{shoot.location || <span className="muted-cell">Not set</span>}</td>
                  <td><span className={`status-pill status-${(shoot.status || 'Scheduled').toLowerCase().replaceAll(' ', '-')}`}>{shoot.status || 'Scheduled'}</span></td>
                  <td>{payment ? <span className={`payment-status payment-status-${payment.status.toLowerCase()}`}>{formatMoney(payment.amount, payment.currency)} · {payment.status.toLowerCase()}</span> : <span className="muted-cell">—</span>}</td>
                  <td className="align-right action-cell">
                    <button className="table-action" onClick={() => openShootModal(shoot)} type="button">Edit</button>
                    {shoot.status !== 'Completed' && shoot.status !== 'Cancelled' && <button className="table-action is-acknowledge" onClick={() => openCompletionModal(shoot)} type="button">Mark done</button>}
                    {needsPayment && <button className="table-action is-acknowledge" onClick={() => openCompletionModal(shoot)} type="button">Issue payment</button>}
                    {!payment && <button className="table-action is-danger" onClick={() => handleDelete(shoot)} type="button">Remove</button>}
                  </td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
        {!loading && shoots.length > 0 && <div className="table-footer">Showing {filteredShoots.length} of {shoots.length} shoots</div>}
      </section>

      {isShootModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeShootModal(); }}>
          <section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="shoot-modal-title">
            <div className="modal-heading"><div><span className="eyebrow">STUDIO SCHEDULE</span><h2 id="shoot-modal-title">{editingShoot ? 'Edit shoot' : 'Add a shoot'}</h2></div><button className="modal-close" onClick={closeShootModal} type="button" aria-label="Close dialog">×</button></div>
            <form onSubmit={handleShootSubmit}>
              {error && <div className="notice notice-error modal-notice" role="alert">{error}</div>}
              <div className="form-grid">
                <label className="form-field">Session title<input name="title" value={shootForm.title} onChange={(event) => setShootForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Wedding portraits" required autoFocus /></label>
                <label className="form-field">Client<select name="clientId" value={shootForm.clientId} onChange={(event) => setShootForm((current) => ({ ...current, clientId: event.target.value }))} required><option value="">Choose a client</option>{clients.map((client) => <option key={client._id} value={client._id}>{client.name} · {client.email}</option>)}</select></label>
                <label className="form-field">Shoot date<input name="date" type="date" value={shootForm.date} onChange={(event) => setShootForm((current) => ({ ...current, date: event.target.value }))} required={needsDateTime(shootForm.status)} /></label>
                <label className="form-field">Start time<input name="time" type="time" value={shootForm.time} onChange={(event) => setShootForm((current) => ({ ...current, time: event.target.value }))} required={needsDateTime(shootForm.status)} /></label>
                <label className="form-field">Location <span className="optional-label">Optional</span><input name="location" value={shootForm.location} onChange={(event) => setShootForm((current) => ({ ...current, location: event.target.value }))} placeholder="Studio or venue" /></label>
                <label className="form-field">Status<select name="status" value={shootForm.status} onChange={(event) => setShootForm((current) => ({ ...current, status: event.target.value }))}>{editableStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
                <label className="form-field shoot-client-brief">Shoot details <span className="optional-label">Optional</span><textarea name="description" value={shootForm.description} onChange={(event) => setShootForm((current) => ({ ...current, description: event.target.value }))} rows="3" placeholder="Session type, package, or client requirements" /></label>
                <label className="form-field shoot-client-brief">Studio notes <span className="optional-label">Optional</span><textarea name="notes" value={shootForm.notes} onChange={(event) => setShootForm((current) => ({ ...current, notes: event.target.value }))} rows="3" placeholder="Equipment, setup, or follow-up details" /></label>
              </div>
              <div className="modal-actions"><button className="button button-quiet" onClick={closeShootModal} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Saving…' : editingShoot ? 'Save changes' : 'Add to schedule'}</button></div>
            </form>
          </section>
        </div>
      )}

      {completionShoot && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCompletionShoot(null); }}>
          <section className="modal-card modal-wide" role="dialog" aria-modal="true" aria-labelledby="complete-modal-title">
            <div className="modal-heading"><div><span className="eyebrow">COMPLETE SHOOT</span><h2 id="complete-modal-title">Send the payment request</h2></div><button className="modal-close" onClick={() => setCompletionShoot(null)} type="button" aria-label="Close dialog">×</button></div>
            <p className="completion-summary">{completionShoot.title} · {completionShoot.clientId?.name} <span>{completionShoot.clientId?.email}</span></p>
            <form onSubmit={handleCompleteShoot}>
              {error && <div className="notice notice-error modal-notice" role="alert">{error}</div>}
              <div className="form-grid">
                <label className="form-field">Amount due<input type="number" min="0.01" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="0.00" required /></label>
                <label className="form-field">Currency<select value={paymentForm.currency} onChange={(event) => setPaymentForm((current) => ({ ...current, currency: event.target.value }))}><option value="INR">INR · Indian rupee</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · British pound</option><option value="EUR">EUR · Euro</option></select></label>
                <label className="form-field">Payment due date <span className="optional-label">Optional</span><input type="date" value={paymentForm.dueDate} onChange={(event) => setPaymentForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
                <label className="form-field">Payment link <span className="optional-label">Optional</span><input type="url" value={paymentForm.paymentUrl} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentUrl: event.target.value }))} placeholder="https://…" /></label>
                <label className="form-field shoot-client-brief">Payment instructions <span className="optional-label">Optional</span><textarea value={paymentForm.paymentInstructions} onChange={(event) => setPaymentForm((current) => ({ ...current, paymentInstructions: event.target.value }))} rows="3" maxLength="2000" placeholder="Bank transfer details or other ways to pay" /></label>
              </div>
              <p className="payment-email-hint">Marking this shoot done saves the payment record and emails the request to the client. If email delivery fails, you can retry it from Payments.</p>
              <div className="modal-actions"><button className="button button-quiet" onClick={() => setCompletionShoot(null)} type="button">Cancel</button><button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Saving and emailing…' : 'Mark done & email client'}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default Shoots;
