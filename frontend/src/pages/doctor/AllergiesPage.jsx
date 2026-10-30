import { useState, useEffect } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState, Modal } from '../../components/UI';

const FAMILIES = ['dairy','peanuts','tree_nuts','gluten','eggs','shellfish','fish','soy','sesame','mustard','celery','lupine','sulphites'];
const SEVERITIES = ['mild','moderate','severe'];

export default function AllergiesPage() {
  const [patients, setPatients] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [selPatient, setSelPatient] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ patient:'', allergen_family:'dairy', specific_allergen:'', severity:'moderate', notes:'' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/patients/').then(r => {
      const list = r.data.results || r.data || [];
      setPatients(list);
      if (list.length > 0 && !selPatient) {
        setSelPatient(list[0].id);
      }
    }).catch(err => {
      console.error(err);
      toast.error('Failed to load patient directory');
    });
  }, []);

  const fetchAllergies = async (patId) => {
    if (!patId) return;
    setLoading(true);
    try {
      const r = await api.get('/allergies/', { params: { patient: patId } });
      setAllergies(r.data.results || r.data || []);
    } catch {
      toast.error('Failed to load patient allergies');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selPatient) {
      fetchAllergies(selPatient);
    }
  }, [selPatient]);

  const openNew = () => {
    setForm({
      patient: selPatient || (patients[0]?.id || ''),
      allergen_family: 'dairy',
      specific_allergen: '',
      severity: 'moderate',
      notes: '',
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!form.patient) {
      toast.error('Please select a patient');
      return;
    }
    if (!form.allergen_family) {
      toast.error('Please select an allergen family');
      return;
    }

    setSaving(true);
    try {
      await api.post('/allergies/', form);
      toast.success('Allergy recorded successfully');
      setShowModal(false);
      setSelPatient(form.patient);
      fetchAllergies(form.patient);
    } catch (e) {
      const errText = e.response?.data?.detail ||
        Object.entries(e.response?.data || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ') ||
        'Failed to record allergy';
      toast.error(errText);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (allergyId) => {
    if (!window.confirm('Are you sure you want to remove this allergy record?')) return;
    try {
      await api.delete(`/allergies/${allergyId}/`);
      toast.success('Allergy record removed');
      fetchAllergies(selPatient);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete allergy');
    }
  };

  const sevColor = { mild: '#047857', moderate: '#b45309', severe: '#b91c1c' };
  const sevBg = { mild: '#ecfdf5', moderate: '#fffbeb', severe: '#fef2f2' };
  const sevBorder = { mild: '#a7f3d0', moderate: '#fde68a', severe: '#fecaca' };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Allergy Records</h2>
          <p>Module 4.1 — Record and view per-patient known allergens, severity, and clinical warnings</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          + Add Allergy
        </button>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Select Inpatient:</label>
        <select
          className="form-control"
          style={{ maxWidth: 360 }}
          value={selPatient}
          onChange={e => setSelPatient(e.target.value)}
        >
          <option value="">— Select patient —</option>
          {patients.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} (Ward {p.ward} · Bed {p.bed_no})
            </option>
          ))}
        </select>
        {allergies.length > 0 && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing {allergies.length} documented allergy{allergies.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && <Loading text="Loading allergies..." />}
      {!loading && selPatient && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Allergen Family</th>
                <th>Specific Allergen</th>
                <th>Severity</th>
                <th>Clinical Notes</th>
                <th>Recorded At</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allergies.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon="🛡️"
                      title="No allergies recorded"
                      desc="This patient has no known allergies on file."
                    />
                  </td>
                </tr>
              )}
              {allergies.map(a => (
                <tr key={a.id}>
                  <td>
                    <strong style={{ textTransform: 'capitalize' }}>{a.allergen_family}</strong>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{a.specific_allergen || '—'}</td>
                  <td>
                    <span
                      style={{
                        color: sevColor[a.severity] || '#0f172a',
                        background: sevBg[a.severity] || '#f8fafc',
                        border: `1px solid ${sevBorder[a.severity] || '#e2e8f0'}`,
                        padding: '3px 10px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        display: 'inline-block',
                      }}
                    >
                      {a.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{a.notes || '—'}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    {a.recorded_at ? new Date(a.recorded_at).toLocaleDateString() : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--risk-high)', borderColor: 'rgba(239,68,68,0.3)' }}
                      onClick={() => handleDelete(a.id)}
                      title="Delete Allergy"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Record Allergy Modal */}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Record Known Patient Allergy"
        footer={(
          <>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Record Allergy'}
            </button>
          </>
        )}
      >
        <div className="form-group">
          <label className="form-label">Patient *</label>
          <select
            className="form-control"
            value={form.patient}
            onChange={e => setForm(f => ({ ...f, patient: e.target.value }))}
            required
          >
            <option value="">— Select patient —</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Ward {p.ward} · Bed {p.bed_no})
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Allergen Family *</label>
            <select
              className="form-control"
              value={form.allergen_family}
              onChange={e => setForm(f => ({ ...f, allergen_family: e.target.value }))}
            >
              {FAMILIES.map(f => (
                <option key={f} value={f}>
                  {f.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Severity *</label>
            <select
              className="form-control"
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
            >
              {SEVERITIES.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Specific Allergen (optional)</label>
          <input
            className="form-control"
            value={form.specific_allergen}
            onChange={e => setForm(f => ({ ...f, specific_allergen: e.target.value }))}
            placeholder="e.g. Peanut Butter, Cow's Milk, Tilapia..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Clinical Notes & Symptoms</label>
          <textarea
            className="form-control"
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Anaphylaxis history, skin rashes, respiratory symptoms..."
          />
        </div>
      </Modal>
    </div>
  );
}

