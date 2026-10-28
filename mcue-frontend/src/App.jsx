import React, { useState } from 'react';
import Login from './components/Login';
import Overview from './components/Overview';
import Clients from './components/Clients';
import Shoots from './components/Shoots';
import Payments from './components/Payments';
import Reports from './components/Reports';
import './App.css';

const adminTabs = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'shoots', label: 'Shoots' },
  { id: 'payments', label: 'Payments' },
  { id: 'reports', label: 'Reports' },
];

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('userRole');
  localStorage.removeItem('user');
};

const readSession = () => {
  const token = localStorage.getItem('token');
  if (token && localStorage.getItem('userRole') === 'admin') {
    try {
      return { token, user: JSON.parse(localStorage.getItem('user') || '{}'), message: '' };
    } catch {
      return { token, user: {}, message: '' };
    }
  }
  const hadClientSession = Boolean(token);
  if (hadClientSession) clearStoredSession();
  return { token: null, user: null, message: hadClientSession ? 'This workspace is for studio administrators. Client accounts have been removed.' : '' };
};

function App() {
  const [session, setSession] = useState(readSession);
  const [activeTab, setActiveTab] = useState('overview');

  const handleLogout = () => {
    clearStoredSession();
    setSession({ token: null, user: null, message: '' });
  };

  const handleLoginSuccess = () => {
    setSession(readSession());
    setActiveTab('overview');
  };

  if (!session.token) {
    return <div className="login-screen"><Login onLoginSuccess={handleLoginSuccess} authMessage={session.message} /></div>;
  }

  const accountName = session.user?.name || 'Studio team';
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="MCue Studio Manager dashboard" onClick={() => setActiveTab('overview')}>
          <span className="brand-mark">M</span>
          <span className="brand-name">MCue</span>
          <span className="brand-divider" />
          <span className="brand-caption">STUDIO MANAGER</span>
        </a>

        <nav className="primary-nav" aria-label="Admin navigation">
          {adminTabs.map((tab) => (
            <button key={tab.id} type="button" className={`nav-link${activeTab === tab.id ? ' is-active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="account-menu">
          <div className="account-copy"><span className="account-name">{accountName}</span><span className="account-role">Studio administrator</span></div>
          <span className="account-avatar" aria-hidden="true">{accountInitial}</span>
          <button className="button button-quiet logout-button" onClick={handleLogout} type="button">Log out</button>
        </div>
      </header>

      <main className="main-content is-admin">
        {activeTab === 'overview' && <Overview onNavigate={setActiveTab} />}
        {activeTab === 'clients' && <Clients />}
        {activeTab === 'shoots' && <Shoots onNavigate={setActiveTab} />}
        {activeTab === 'payments' && <Payments />}
        {activeTab === 'reports' && <Reports />}
      </main>
    </div>
  );
}

export default App;
