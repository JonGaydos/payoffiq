import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../utils/api';
import { LOAN_TYPES } from '../utils/constants';

export default function Sidebar({ isOpen, onClose }) {
  const { username, logout, authFetch, isAuthenticated } = useAuth();
  const location = useLocation();
  const [loans, setLoans] = useState([]);
  const [expandedType, setExpandedType] = useState(null);

  // Load loans for sidebar navigation
  useEffect(() => {
    if (!isAuthenticated) return;
    authFetch(`${API_BASE}/loans`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setLoans(data))
      .catch(() => {});
  }, [isAuthenticated, location.pathname]);

  // Group loans by type
  const loansByType = loans.reduce((acc, loan) => {
    const type = loan.loan_type || 'mortgage';
    if (!acc[type]) acc[type] = [];
    acc[type].push(loan);
    return acc;
  }, {});

  // Detect current loan context
  const currentLoanId = location.pathname.match(/\/loans\/(\d+)/)?.[1];
  const currentLoanType = currentLoanId
    ? loans.find(l => String(l.id) === currentLoanId)?.loan_type
    : null;
  const isLoanPath = location.pathname.startsWith('/loans');

  return (
    <aside
      className={`
        fixed top-0 left-0 z-50 h-full w-60
        bg-sidebar-bg text-sidebar-text
        flex flex-col
        transition-transform duration-200
        lg:translate-x-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
    >
      {/* Logo */}
      <div className="p-5 pb-3">
        <h1 className="font-serif text-xl font-bold tracking-wide">
          <span className="mr-2">{'\u{1F4B0}'}</span>PayoffIQ
        </h1>
        {username && (
          <p className="text-xs mt-1 opacity-60">Logged in as {username}</p>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {/* General */}
        <NavGroup label="General">
          <NavItem to="/" icon={'\u{1F4CA}'} label="Dashboard" end onClick={onClose} />
        </NavGroup>

        {/* Financial */}
        <NavGroup label="Financial">
          <NavItem to="/loans" icon={'\u{1F3E0}'} label="Loans" onClick={onClose} end />

          {/* Dynamic loan sub-nav */}
          {isLoanPath && Object.entries(loansByType).map(([type, typeLoans]) => {
            const loanType = LOAN_TYPES.find(t => t.value === type) || LOAN_TYPES[0];
            const isExpanded = expandedType === type || currentLoanType === type;

            return (
              <div key={type} className="ml-4">
                <button
                  onClick={() => setExpandedType(isExpanded && currentLoanType !== type ? null : type)}
                  className="flex items-center gap-1.5 w-full px-2 py-1 text-xs opacity-60 hover:opacity-100 transition-opacity"
                >
                  <span className="text-[10px]">{isExpanded ? '\u25BE' : '\u25B8'}</span>
                  <span>{loanType.icon}</span>
                  <span className="font-semibold uppercase tracking-wider">{loanType.label}</span>
                  <span className="ml-auto text-[10px] opacity-50">{typeLoans.length}</span>
                </button>
                {isExpanded && typeLoans.map(loan => (
                  <NavLink
                    key={loan.id}
                    to={`/loans/${loan.id}`}
                    onClick={onClose}
                    className={() => {
                      const active = location.pathname.startsWith(`/loans/${loan.id}`);
                      return `block ml-4 px-2 py-1 text-xs rounded transition-all truncate ${
                        active
                          ? 'text-gold font-semibold bg-gold/10'
                          : 'opacity-50 hover:opacity-80'
                      }`;
                    }}
                  >
                    {loan.name}
                  </NavLink>
                ))}
              </div>
            );
          })}

          <NavItem to="/credit-cards" icon={'\u{1F4B3}'} label="Credit Cards" onClick={onClose} />
          <NavItem to="/strategy" icon={'\u{1F3AF}'} label="Debt Strategy" onClick={onClose} />
        </NavGroup>

        {/* Household */}
        <NavGroup label="Household">
          <NavItem to="/bills" icon={'\u{1F4A1}'} label="Utilities" onClick={onClose} />
          <NavItem to="/insurance" icon={'\u{1F6E1}\uFE0F'} label="Insurance" onClick={onClose} />
          <NavItem to="/maintenance" icon={'\u{1F527}'} label="Maintenance" onClick={onClose} />
        </NavGroup>

        {/* Tools */}
        <NavGroup label="Tools">
          <NavItem to="/documents" icon={'\u{1F4C4}'} label="Documents" onClick={onClose} />
          <NavItem to="/calendar" icon={'\u{1F4C5}'} label="Calendar" onClick={onClose} />
        </NavGroup>

        {/* Account */}
        <NavGroup label="Account">
          <NavItem to="/settings" icon={'\u2699\uFE0F'} label="Settings" onClick={onClose} />
        </NavGroup>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-2">
        <a
          href="https://github.com/JonGaydos/payoffiq"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs opacity-50 hover:opacity-80 transition-opacity"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
        <button
          onClick={logout}
          className="w-full text-left text-xs opacity-50 hover:opacity-80 transition-opacity"
        >
          {'\u{1F6AA}'} Log out
        </button>
      </div>
    </aside>
  );
}

function NavGroup({ label, children }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 px-3 mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function NavItem({ to, icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
          isActive
            ? 'bg-gold/20 text-gold font-semibold border-l-2 border-gold'
            : 'hover:bg-white/5 opacity-75 hover:opacity-100'
        }`
      }
    >
      <span className="text-base">{icon}</span>
      {label}
    </NavLink>
  );
}
