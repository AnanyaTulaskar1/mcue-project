import React, { useEffect, useMemo, useState } from 'react';
import { clientAPI } from '../services/api';

const initialsFor = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'C';

const Clients = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', company: '', notes: '' });

  useEffect(() => { fetchClients(); }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await clientAPI.getClients();
      setClients(Array.isArray(response.data) ? response.data : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return clients;
    return clients.filter((client) => [client.name, client.email, client.phone, client.company, client.notes]
      .some((value) => String(value || '').toLowerCase().includes(query)));
  }, [clients, search]);

  const openModal = (client = null) => {
    setError('');
    setEditingClient(client);
    setFormData(client
      ? { name: client.name || '', email: client.email || '', phone: client.phone || '', company: client.company || '', notes: client.notes || '' }
      : { name: '', email: '', phone: '', company: '', notes: '' });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  };

  const handleInputChange = (event) => {
    setFormData((current) => ({ ...current, [event.target.name]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    try {
      if (editingClient) await clientAPI.updateClient(editingClient._id, formData);
      else await clientAPI.createClient(formData);
      closeModal();
      await fetchClients();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save this client. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client) => {
    if (!window.confirm(`Remove ${client.name || 'this client'} from your directory?`)) return;
    try {
      await clientAPI.deleteClient(client._id);
      await fetchClients();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to remove this client. Please try again.');
    }
  };

  return (
    <div className="workspace-page">
      <section className="page-heading">
        <div>
          <span className="eyebrow">RELATIONSHIPS</span>
          <h1>Clients</h1>
          <p>Save the contact details you collect through calls, messages, and referrals.</p>
        </div>
        <button className="button button-primary" onClick={() => openModal()} type="button">
          <span className="button-plus" aria-hidden="true">+</span> Add client
        </button>
      </section>

      {error && <div className="notice notice-error" role="alert">{error}</div>}

      <section className="summary-grid" aria-label="Client overview">
        <article className="summary-card">
          <span className="summary-icon client-icon" aria-hidden="true">♙</span>
          <div><span className="summary-label">Total clients</span><strong>{loading ? '—' : clients.length}</strong></div>
        </article>
        <article className="summary-card">
          <span className="summary-icon active-icon" aria-hidden="true">✦</span>
          <div><span className="summary-label">Showing</span><strong>{loading ? '—' : filteredClients.length}</strong></div>
        </article>
        <article className="summary-card summary-note">
          <span className="note-dot" />A thoughtful client experience starts with good details.
        </article>
      </section>

      <section className="panel data-panel">
        <div className="data-panel-heading">
          <div>
            <h2>Client directory</h2>
            <p>Clients are contacts in your studio records. They do not need an account.</p>
          </div>
          <label className="search-field">
            <span className="search-icon" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients"
              aria-label="Search clients"
            />
          </label>
        </div>

        {loading ? (
          <div className="loading-state"><span className="loading-spinner" />Loading your client directory…</div>
        ) : filteredClients.length === 0 ? (
          <div className="empty-state table-empty">
            <span className="empty-state-icon" aria-hidden="true">♙</span>
            <h3>{search ? 'No clients match that search' : 'Your directory is ready to grow'}</h3>
            <p>{search ? 'Try searching with a different name or email.' : 'Add a client to keep their contact details close at hand.'}</p>
            {!search && <button className="button button-secondary" onClick={() => openModal()} type="button">Add your first client</button>}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table clients-table">
              <thead>
                <tr><th>Client</th><th>Contact</th><th>Phone</th><th>Company</th><th>Notes</th><th className="align-right">Actions</th></tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => (
                  <tr key={client._id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar">{initialsFor(client.name)}</span>
                        <span className="person-name">{client.name || 'Unnamed client'}</span>
                      </div>
                    </td>
                    <td>{client.email ? <a className="table-link" href={`mailto:${client.email}`}>{client.email}</a> : <span className="muted-cell">No email</span>}</td>
                    <td>{client.phone || <span className="muted-cell">Not provided</span>}</td>
                    <td>{client.company || <span className="muted-cell">—</span>}</td>
                    <td className="notes-cell">{client.notes || <span className="muted-cell">—</span>}</td>
                    <td className="align-right action-cell">
                      <button className="table-action" onClick={() => openModal(client)} type="button">Edit</button>
                      <button className="table-action is-danger" onClick={() => handleDelete(client)} type="button">Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {isModalOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="client-modal-title">
            <div className="modal-heading">
              <div><span className="eyebrow">CLIENT DETAILS</span><h2 id="client-modal-title">{editingClient ? 'Edit client' : 'Add a client'}</h2></div>
              <button className="modal-close" onClick={closeModal} type="button" aria-label="Close dialog">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              {error && <div className="notice notice-error modal-notice" role="alert">{error}</div>}
              <label className="form-field">Full name<input name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Jamie Morgan" required autoFocus /></label>
              <label className="form-field">Email address<input name="email" type="email" value={formData.email} onChange={handleInputChange} placeholder="jamie@example.com" required /></label>
              <label className="form-field">Phone number <span className="optional-label">Optional</span><input name="phone" type="tel" value={formData.phone} onChange={handleInputChange} placeholder="+1 555 000 0000" /></label>
              <label className="form-field">Company <span className="optional-label">Optional</span><input name="company" value={formData.company} onChange={handleInputChange} placeholder="Company or organization" /></label>
              <label className="form-field">Studio notes <span className="optional-label">Optional</span><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="3" placeholder="Preferences, package details, or anything to remember" /></label>
              <div className="modal-actions">
                <button className="button button-quiet" onClick={closeModal} type="button">Cancel</button>
                <button className="button button-primary" disabled={isSaving} type="submit">{isSaving ? 'Saving…' : editingClient ? 'Save changes' : 'Create client'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
};

export default Clients;
