/* Shared UI micro-components */

export function Spinner() {
  return <span className="spinner" />;
}

export function Loading({ text = 'Loading...' }) {
  return (
    <div className="loading-center">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

export function RiskBadge({ tier }) {
  if (!tier) return null;
  const cls = { High: 'risk-high', Medium: 'risk-medium', Low: 'risk-low' }[tier] || 'risk-low';
  const dot = { High: '🔴', Medium: '🟡', Low: '🟢' }[tier] || '⚪';
  return <span className={`risk-badge ${cls}`}>{dot} {tier}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  const labels = {
    pending:      'Pending',
    low_risk:     'Low Risk',
    medium_risk:  'Medium Risk',
    high_risk:    'High Risk',
    approved:     'Approved',
    rejected:     'Rejected',
  };
  return (
    <span className={`status-badge status-${status}`}>
      {labels[status] || status}
    </span>
  );
}

export function AearmCard({ trace }) {
  if (!trace) return null;
  const tier = trace.risk_tier?.toLowerCase();
  return (
    <div className={`aearm-card ${tier}`}>
      <div className="aearm-header">
        <RiskBadge tier={trace.risk_tier} />
        <span className="aearm-score">
          Score: {(trace.risk_score * 100).toFixed(1)}%
        </span>
      </div>
      <p className="aearm-explanation">{trace.explanation}</p>
      <div className="aearm-components">
        <div className="aearm-comp">
          <div className="aearm-comp-label">Severity</div>
          <div className="aearm-comp-value">{(trace.severity_component * 100).toFixed(0)}%</div>
          <div className="progress-bar">
            <div className={`progress-fill ${tier}`} style={{ width: `${trace.severity_component * 100}%` }} />
          </div>
        </div>
        <div className="aearm-comp">
          <div className="aearm-comp-label">Confidence</div>
          <div className="aearm-comp-value">{(trace.confidence_component * 100).toFixed(0)}%</div>
          <div className="progress-bar">
            <div className={`progress-fill ${tier}`} style={{ width: `${trace.confidence_component * 100}%` }} />
          </div>
        </div>
        <div className="aearm-comp">
          <div className="aearm-comp-label">Cross-React</div>
          <div className="aearm-comp-value">{(trace.cross_component * 100).toFixed(0)}%</div>
          <div className="progress-bar">
            <div className={`progress-fill ${tier}`} style={{ width: `${trace.cross_component * 100}%` }} />
          </div>
        </div>
      </div>
      {trace.direct_match && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--risk-high)' }}>
          ⚠ Direct match: <strong>{trace.direct_match[0]}</strong> ({trace.direct_match[1]})
        </div>
      )}
      {!trace.direct_match && trace.cross_match && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--risk-medium)' }}>
          ⚡ Cross-reactive: <strong>{trace.cross_match[0]}</strong> ({trace.cross_match[1]})
        </div>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, maxWidth, width, style }) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div 
        className="modal" 
        style={{ 
          ...(maxWidth ? { maxWidth } : {}), 
          ...(width ? { width } : {}), 
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...(style || {}) 
        }}
      >
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
          {children}
        </div>
        {footer && <div className="modal-footer" style={{ flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, desc }) {
  return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon || '📋'}</div>
      <h3>{title}</h3>
      {desc && <p>{desc}</p>}
    </div>
  );
}

export function Pagination({ currentPage, totalPages, onPageChange, totalItems, pageSize }) {
  if (totalPages <= 1) return null;
  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        Showing <strong>{start}</strong> - <strong>{end}</strong> of <strong>{totalItems}</strong> entries
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          className="btn btn-secondary btn-sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          &larr; Prev
        </button>
        <span style={{ fontSize: 13, padding: '0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}
