import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState, Modal, Pagination } from '../../components/UI';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [search, setSearch] = useState('');
  const [inspectLog, setInspectLog] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    try {
      const params = {};
      if (selectedEntity) params.entity = selectedEntity;
      if (selectedRole) params.role = selectedRole;
      if (search) params.search = search;
      const res = await api.get('/audit-logs/', { params });
      setLogs(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [selectedEntity, selectedRole, search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(logs.length / pageSize) || 1;
  const paginatedLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleEntity = (e) => {
    setSelectedEntity(e.target.value);
    setPage(1);
  };

  const handleRole = (e) => {
    setSelectedRole(e.target.value);
    setPage(1);
  };

  return (
    <div className="audit-log-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Hospital Dietary Department Audit Trail</h2>
          <p>Immutable record of all patient updates, allergy records, meal assignments, sign-offs, and batch scans</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs}>
          🔄 Refresh Trail
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search action or keyword..."
              value={search}
              onChange={handleSearch}
            />
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-control"
              value={selectedEntity}
              onChange={handleEntity}
            >
              <option value="">All Entities</option>
              <option value="Patient">Patient</option>
              <option value="Allergy">Allergy</option>
              <option value="MealPlan">MealPlan</option>
              <option value="SignOff">SignOff</option>
              <option value="Order">Order</option>
              <option value="DeliveryLog">DeliveryLog</option>
            </select>
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-control"
              value={selectedRole}
              onChange={handleRole}
            >
              <option value="">All Roles</option>
              <option value="doctor">Doctor</option>
              <option value="dietitian">Dietitian</option>
              <option value="senior_reviewer">Senior Reviewer</option>
              <option value="kitchen">Kitchen Staff</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <Loading text="Loading audit records..." />
      ) : logs.length === 0 ? (
        <EmptyState icon="🔍" title="No Audit Records Found" desc="No events match your current filter criteria." />
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Action Executed</th>
                  <th>User / Role</th>
                  <th>Timestamp</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedLogs.map(log => (
                  <tr key={log.id}>
                    <td>#{log.id}</td>
                    <td>
                      <span style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        fontWeight: 600,
                      }}>
                        {log.entity}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--text-secondary)' }}>
                      {log.entity_id ? `#${log.entity_id}` : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: 'var(--brand-400)' }}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{log.actor_name || 'System / Admin'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {log.actor_role?.replace('_', ' ')}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setInspectLog(log)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={logs.length}
            pageSize={pageSize}
          />
        </div>
      )}

      {/* Detail Modal */}
      {inspectLog && (
        <Modal
          open={Boolean(inspectLog)}
          onClose={() => setInspectLog(null)}
          title={`Audit Record #${inspectLog.id} — ${inspectLog.entity} ${inspectLog.action}`}
          footer={(
            <button className="btn btn-secondary" onClick={() => setInspectLog(null)}>
              Close
            </button>
          )}
        >
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ACTOR</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{inspectLog.actor_name || 'System'}</div>
                <div style={{ fontSize: 12, color: 'var(--brand-400)', textTransform: 'capitalize' }}>{inspectLog.actor_role}</div>
              </div>
              <div style={{ background: 'var(--bg-elevated)', padding: 12, borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>TIMESTAMP</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{new Date(inspectLog.timestamp).toLocaleString()}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Target: {inspectLog.entity} #{inspectLog.entity_id || 'N/A'}</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Action Payload / Detail</label>
              <pre style={{
                background: 'var(--bg-base)',
                padding: 12,
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                fontFamily: 'JetBrains Mono',
                fontSize: 12,
                color: 'var(--text-primary)',
                overflowX: 'auto',
              }}>
                {JSON.stringify(inspectLog.detail, null, 2)}
              </pre>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
