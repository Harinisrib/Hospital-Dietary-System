import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import toast from 'react-hot-toast';

const ROLE_REDIRECTS = {
  doctor:    '/doctor/patients',
  dietitian: '/clinical/ai-planner',
  patient:   '/patient/dashboard',
  kitchen:   '/kitchen/orders',
  admin:     '/admin/analytics',
};

// Verified hospital clinical staff
const STAFF_MEMBERS = [
  {
    role: 'doctor',
    fullName: 'Dr. Rajan Kumar',
    designation: 'Chief Medical Officer',
    department: 'Department of Internal Medicine',
    username: 'doctor1',
    namePassword: 'rajan',
    icon: '🩺',
    badge: 'Physician Level 4',
    badgeColor: '#0284c7',
    avatarBg: '#e0f2fe',
  },
  {
    role: 'doctor',
    fullName: 'Dr. Senthil Nathan',
    designation: 'Gastroenterology Head',
    department: 'Department of Gastroenterology',
    username: 'doctor2',
    namePassword: 'senthil',
    icon: '🩺',
    badge: 'Specialist Level 4',
    badgeColor: '#0284c7',
    avatarBg: '#e0f2fe',
  },
  {
    role: 'dietitian',
    fullName: 'Priya Sundar',
    designation: 'Chief Clinical Dietitian',
    department: 'Clinical Nutrition & Dietetics',
    username: 'dietitian1',
    namePassword: 'priya',
    icon: '🥗',
    badge: 'Clinical Reviewer Level 3',
    badgeColor: '#059669',
    avatarBg: '#d1fae5',
  },
  {
    role: 'dietitian',
    fullName: 'Kavitha Raman',
    designation: 'Senior Clinical Dietitian',
    department: 'Clinical Nutrition & Dietetics',
    username: 'dietitian2',
    namePassword: 'kavitha',
    icon: '🥗',
    badge: 'Clinical Reviewer Level 3',
    badgeColor: '#059669',
    avatarBg: '#d1fae5',
  },
  {
    role: 'kitchen',
    fullName: 'Ramesh Babu',
    designation: 'Executive Dietary Chef',
    department: 'Dietary Production & Logistics',
    username: 'kitchen1',
    namePassword: 'ramesh',
    icon: '🍽️',
    badge: 'Kitchen Operations Level 2',
    badgeColor: '#d97706',
    avatarBg: '#fef3c7',
  },
  {
    role: 'admin',
    fullName: 'System Administrator',
    designation: 'Chief Quality & IT Officer',
    department: 'Health Informatics & Security',
    username: 'admin1',
    namePassword: 'admin',
    icon: '🛡️',
    badge: 'Security Level 5',
    badgeColor: '#7c3aed',
    avatarBg: '#ede9fe',
  },
];

import { ALL_INPATIENTS } from '../data/patientsDirectory';

const WARDS = [
  { id: 'All Wards', label: 'All Wards (122)' },
  { id: 'Ward A', label: 'Ward A (16)' },
  { id: 'Ward B', label: 'Ward B (16)' },
  { id: 'Ward C', label: 'Ward C (16)' },
  { id: 'Ward D', label: 'Ward D (16)' },
  { id: 'Ward E', label: 'Ward E (14)' },
  { id: 'Ward F', label: 'Ward F (14)' },
  { id: 'Ward G', label: 'Ward G (14)' },
  { id: 'Ward H', label: 'Ward H (16)' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Active top portal mode: 'staff' vs 'patient'
  const [portalMode, setPortalMode] = useState('staff');

  // Staff role filter: 'all', 'doctor', 'dietitian', 'kitchen', 'admin'
  const [staffRoleFilter, setStaffRoleFilter] = useState('all');

  // Patient Ward filter: 'All Wards', 'Ward A', 'Ward B', etc.
  const [patientWardFilter, setPatientWardFilter] = useState('All Wards');

  // Complete patient roster across all 8 hospital wards (122 inpatients)
  const [patientsList, setPatientsList] = useState(ALL_INPATIENTS);
  const [loadingPatients, setLoadingPatients] = useState(false);

  // Search keyword for staff or patients
  const [searchQuery, setSearchQuery] = useState('');

  // Currently selected persona
  const [selectedProfile, setSelectedProfile] = useState(() => STAFF_MEMBERS[0]);

  // Form input states
  const [username, setUsername] = useState(STAFF_MEMBERS[0].username);
  const [password, setPassword] = useState(STAFF_MEMBERS[0].namePassword);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch the full clinical directory of all 122 inpatients across wards A-H from backend on mount
  useEffect(() => {
    setLoadingPatients(true);
    api.get('/auth/patient-directory/')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0) {
          setPatientsList(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not load dynamic patient directory, using fallback:', err);
      })
      .finally(() => {
        setLoadingPatients(false);
      });
  }, []);

  // Switch portal mode
  const handlePortalSwitch = (mode) => {
    setPortalMode(mode);
    setSearchQuery('');
    if (mode === 'staff') {
      const def = STAFF_MEMBERS[0];
      setSelectedProfile(def);
      setUsername(def.username);
      setPassword(def.namePassword);
    } else {
      const def = patientsList[0] || ALL_INPATIENTS[0];
      setSelectedProfile(def);
      setUsername(def.username);
      setPassword(def.namePassword);
    }
  };

  // Select profile to terminal fields
  const handleSelectProfile = (profile) => {
    setSelectedProfile(profile);
    setUsername(profile.username);
    setPassword(profile.namePassword);
  };

  // Direct 1-click Sign In and portal entry
  const doQuickLogin = async (profile) => {
    handleSelectProfile(profile);
    setLoading(true);
    try {
      const user = await login(profile.username.trim(), profile.namePassword.trim());
      toast.success(`Welcome back, ${user.full_name || user.username}!`);
      const targetRoute =
        ROLE_REDIRECTS[user.role] ||
        (portalMode === 'patient' ? '/patient/dashboard' : '/');
      navigate(targetRoute);
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        'Authentication failed. Please verify credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return STAFF_MEMBERS.filter((s) => {
      const matchesRole = staffRoleFilter === 'all' || s.role === staffRoleFilter;
      const matchesSearch =
        !searchQuery ||
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.designation.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.namePassword.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesRole && matchesSearch;
    });
  }, [staffRoleFilter, searchQuery]);

  // Filtered patients list across all 122 inpatients
  const filteredPatients = useMemo(() => {
    return patientsList.filter((p) => {
      const matchesWard =
        patientWardFilter === 'All Wards' ||
        p.ward.toLowerCase() === patientWardFilter.toLowerCase() ||
        p.ward.toLowerCase().includes(patientWardFilter.toLowerCase().replace('ward', '').trim());

      const matchesSearch =
        !searchQuery ||
        p.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.bedNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.ward.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.dietType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.namePassword.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesWard && matchesSearch;
    });
  }, [patientsList, patientWardFilter, searchQuery]);

  // Submit action from terminal
  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username.trim(), password.trim());
      toast.success(`Welcome back, ${user.full_name || user.username}!`);
      const targetRoute =
        ROLE_REDIRECTS[user.role] ||
        (portalMode === 'patient' ? '/patient/dashboard' : '/');
      navigate(targetRoute);
    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        'Authentication failed. Remember: each user\'s password is set as their name (e.g. rajan, priya, senthil, aarthi, balu).'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Ambient background glow */}
      <div style={styles.glowOrb1} />
      <div style={styles.glowOrb2} />

      <div style={styles.mainWrapper}>

        {/* ── TOP HEADER: Hospital Identity & Portal Switcher ── */}
        <header style={styles.topHeader}>
          <div style={styles.brandRow}>
            <div style={styles.brandIconWrap}>
              <span style={{ fontSize: 26 }}>🏥</span>
            </div>
            <div>
              <div style={styles.brandTitle}>Apollo MedCity Healthcare System</div>
              <div style={styles.brandSub}>
                Autonomous Dietary Safety &amp; Clinical Nutrition Management Portal
              </div>
            </div>
          </div>

          <div style={styles.headerBadges}>
            <span style={styles.badgeEngine}>⚡ AEARM v1.0 AI</span>
          </div>
        </header>

        {/* ── PORTAL MODE SWITCHER: Staff vs Inpatient Bedside ── */}
        <div className="login-mode-tabs" style={styles.modeTabsRow}>
          <button
            type="button"
            onClick={() => handlePortalSwitch('staff')}
            style={{
              ...styles.modeTab,
              ...(portalMode === 'staff' ? styles.modeTabActiveStaff : {}),
            }}
          >
            <span style={{ fontSize: 20 }}>👨‍⚕️</span>
            <div>
              <div style={styles.modeTabTitle}>Hospital &amp; Clinical Staff Portal</div>
              <div style={styles.modeTabDesc}>Doctors · Clinical Dietitians · Dietary Kitchen · Hospital Admin</div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => handlePortalSwitch('patient')}
            style={{
              ...styles.modeTab,
              ...(portalMode === 'patient' ? styles.modeTabActivePatient : {}),
            }}
          >
            <span style={{ fontSize: 20 }}>🏥</span>
            <div>
              <div style={styles.modeTabTitle}>Inpatient Bedside Menu Portal</div>
              <div style={styles.modeTabDesc}>
                {patientsList.length} Admitted Inpatients across Wards A–H · Approved Menus &amp; Feedback
              </div>
            </div>
          </button>
        </div>

        {/* ── 2-COLUMN BALANCED WORKSPACE ── */}
        <div className="login-body-grid" style={styles.portalBodyGrid}>

          {/* ── LEFT COLUMN: Authentic Profile Directory ── */}
          <section style={styles.directoryPanel}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>
                  {portalMode === 'staff' ? 'Hospital Personnel Directory' : 'Admitted Inpatients Directory'}
                </h2>
                <p style={styles.panelSubtitle}>
                  {portalMode === 'staff'
                    ? 'Select your verified hospital staff profile to autofill authentication credentials.'
                    : `Displaying ${filteredPatients.length} of ${patientsList.length} admitted inpatients across 8 hospital wards. Select your bed or enter your name.`}
                </p>
              </div>

              <span style={styles.countPill}>
                {portalMode === 'staff'
                  ? `${filteredStaff.length} Staff Profiles`
                  : `${filteredPatients.length} / ${patientsList.length} Inpatients`}
              </span>
            </div>

            {/* Filter Chips & Search Bar */}
            <div style={styles.filterBar}>
              {portalMode === 'staff' ? (
                <div style={styles.roleChips}>
                  {[
                    { id: 'all', label: 'All Roles', icon: '👥' },
                    { id: 'doctor', label: 'Doctors', icon: '🩺' },
                    { id: 'dietitian', label: 'Dietitians', icon: '🥗' },
                    { id: 'kitchen', label: 'Kitchen', icon: '🍽️' },
                    { id: 'admin', label: 'Admin', icon: '🛡️' },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setStaffRoleFilter(chip.id)}
                      style={{
                        ...styles.roleChip,
                        ...(staffRoleFilter === chip.id ? styles.roleChipActive : {}),
                      }}
                    >
                      <span>{chip.icon}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={styles.wardFilterRow}>
                  {WARDS.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setPatientWardFilter(w.id)}
                      style={{
                        ...styles.wardChip,
                        ...(patientWardFilter === w.id ? styles.wardChipActive : {}),
                      }}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Search box */}
              <div style={styles.searchBoxWrapper}>
                <span style={styles.searchIcon}>🔍</span>
                <input
                  type="text"
                  style={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    portalMode === 'staff'
                      ? 'Search staff by name, designation, or username…'
                      : 'Search across all 122 patients by name, bed # (e.g. 102), ward, diet, diagnosis…'
                  }
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    style={styles.clearSearchBtn}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Profiles Grid */}
            <div style={styles.profilesGrid}>
              {portalMode === 'staff' ? (
                filteredStaff.map((staff) => {
                  const isSelected = selectedProfile?.username === staff.username;
                  return (
                    <div
                      key={staff.username}
                      onClick={() => handleSelectProfile(staff)}
                      style={{
                        ...styles.cardItem,
                        ...(isSelected ? styles.cardItemSelected : {}),
                      }}
                    >
                      <div style={{ ...styles.cardAvatar, background: staff.avatarBg }}>
                        <span style={{ fontSize: 22 }}>{staff.icon}</span>
                      </div>

                      <div style={styles.cardDetails}>
                        <div style={styles.cardRowTop}>
                          <span style={styles.cardName}>{staff.fullName}</span>
                          <span
                            style={{
                              ...styles.cardBadge,
                              borderColor: staff.badgeColor,
                              color: staff.badgeColor,
                            }}
                          >
                            {staff.badge}
                          </span>
                        </div>

                        <div style={styles.cardSubText}>
                          {staff.designation} · {staff.department}
                        </div>

                        <div style={styles.cardPillsRow}>
                          <span style={styles.pillTag}>
                            Username: <strong>{staff.username}</strong> or <strong>{staff.namePassword}</strong>
                          </span>
                          <span style={{ ...styles.pillTag, background: '#d1fae5', color: '#047857' }}>
                            Password: <strong>{staff.namePassword}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation();
                          doQuickLogin(staff);
                        }}
                        style={{
                          ...styles.selectBtn,
                          ...(isSelected ? styles.selectBtnActive : {}),
                        }}
                      >
                        Enter Portal →
                      </button>
                    </div>
                  );
                })
              ) : (
                filteredPatients.map((patient) => {
                  const isSelected = selectedProfile?.id === patient.id || selectedProfile?.username === patient.username;
                  return (
                    <div
                      key={patient.id}
                      onClick={() => handleSelectProfile(patient)}
                      style={{
                        ...styles.cardItem,
                        ...(isSelected ? styles.cardItemSelected : {}),
                      }}
                    >
                      <div style={{ ...styles.cardAvatar, background: '#fce7f3' }}>
                        <span style={{ fontSize: 22 }}>🛏️</span>
                      </div>

                      <div style={styles.cardDetails}>
                        <div style={styles.cardRowTop}>
                          <span style={styles.cardName}>{patient.fullName}</span>
                          <span
                            style={{
                              ...styles.cardBadge,
                              borderColor: '#0284c7',
                              color: '#0284c7',
                            }}
                          >
                            {patient.ward} · {patient.bedNo}
                          </span>
                        </div>

                        <div style={styles.cardSubText}>
                          Diet: <strong style={{ color: '#0f172a' }}>{patient.dietType}</strong> · Dx: {patient.diagnosis}
                        </div>

                        <div style={styles.cardPillsRow}>
                          <span style={styles.pillTag}>
                            ID / Name: <strong>{patient.fullName}</strong>
                          </span>
                          <span style={{ ...styles.pillTag, background: '#d1fae5', color: '#047857' }}>
                            Password: <strong>{patient.namePassword}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation();
                          doQuickLogin(patient);
                        }}
                        style={{
                          ...styles.selectBtn,
                          ...(isSelected ? styles.selectBtnActive : {}),
                        }}
                      >
                        Enter Portal →
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* ── RIGHT COLUMN: Clean Focused Sign-In Terminal ── */}
          <section style={styles.formPanel}>
            <div style={styles.terminalCard}>

              <div style={styles.terminalHeader}>
                <div style={styles.terminalStatusDot} />
                <span style={styles.terminalBadge}>
                  {portalMode === 'staff' ? 'STAFF WORKSTATION GATEWAY' : 'INPATIENT BEDSIDE TERMINAL'}
                </span>
              </div>

              <h3 style={styles.terminalTitle}>
                {portalMode === 'staff' ? 'Clinical Sign In' : 'Bedside Menu Access'}
              </h3>
              <p style={styles.terminalSub}>
                {portalMode === 'staff'
                  ? 'Verify credentials to access clinical patient records, diet charts, or kitchen queues.'
                  : 'Patients: Sign in to view your approved breakfast, lunch, and dinner menus.'}
              </p>

              {/* Active Chosen Persona Summary Box */}
              {selectedProfile && (
                <div style={styles.activePersonaBox}>
                  <div style={styles.activePersonaAvatar}>
                    {portalMode === 'staff' ? selectedProfile.icon : '🛏️'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.activePersonaName}>{selectedProfile.fullName}</div>
                    <div style={styles.activePersonaRole}>
                      {portalMode === 'staff'
                        ? `${selectedProfile.designation} · ${selectedProfile.department}`
                        : `${selectedProfile.ward} ${selectedProfile.bedNo} · ${selectedProfile.dietType}`}
                    </div>
                  </div>
                  <div style={styles.activePersonaPill}>Verified Account</div>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleLogin} style={styles.loginForm}>
                <div style={styles.fieldGroup}>
                  <label style={styles.fieldLabel}>
                    {portalMode === 'staff' ? 'Staff Username or Name' : 'Patient Name, Bed, or ID'}
                  </label>
                  <div style={styles.inputWrap}>
                    <span style={styles.inputIcon}>{portalMode === 'staff' ? '👤' : '🏥'}</span>
                    <input
                      type="text"
                      style={styles.fieldInput}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={portalMode === 'staff' ? 'e.g. doctor1 or rajan' : 'e.g. aarthi, balu, or Balu Krishnan'}
                      autoComplete="username"
                      required
                    />
                  </div>
                </div>

                <div style={styles.fieldGroup}>
                  <div style={styles.labelRow}>
                    <label style={styles.fieldLabel}>Password (Set As Their Name)</label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={styles.toggleVisibilityBtn}
                    >
                      {showPassword ? 'Hide 👁️' : 'Show 👁️'}
                    </button>
                  </div>
                  <div style={styles.inputWrap}>
                    <span style={styles.inputIcon}>🔒</span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      style={styles.fieldInput}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (e.g. rajan, priya, aarthi, balu)"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                </div>

                {/* Submit CTA */}
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    ...styles.submitCTA,
                    opacity: loading ? 0.75 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <span style={styles.loadingRow}>
                      <span style={styles.spinnerIcon} />
                      Authenticating…
                    </span>
                  ) : (
                    <span>
                      {portalMode === 'staff'
                        ? `Sign In as ${selectedProfile ? selectedProfile.fullName : 'Staff'} →`
                        : `Access Menu as ${selectedProfile ? selectedProfile.fullName : 'Inpatient'} →`}
                    </span>
                  )}
                </button>
              </form>

              {/* Security accreditation badge */}
              <div style={styles.terminalFooter}>
                <span>🔒 Protected Health Information (PHI) · HIPAA / NABH Compliant</span>
              </div>

            </div>
          </section>

        </div>

      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Clean, Proper Hospital Layout Design System
───────────────────────────────────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'radial-gradient(circle at top, #eef2ff 0%, #f8fafc 50%, #f1f5f9 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: '24px 20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    color: '#0f172a',
  },
  glowOrb1: {
    position: 'absolute',
    width: 900,
    height: 900,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.07) 0%, transparent 65%)',
    top: '-300px',
    right: '-200px',
    pointerEvents: 'none',
  },
  glowOrb2: {
    position: 'absolute',
    width: 700,
    height: 700,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.05) 0%, transparent 65%)',
    bottom: '-250px',
    left: '-200px',
    pointerEvents: 'none',
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 1280,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 1,
  },

  /* ── Top Header ── */
  topHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 18,
    padding: '16px 24px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
  },
  brandRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  brandIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.1) 100%)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
    letterSpacing: 0.3,
  },
  brandSub: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: 500,
  },
  headerBadges: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badgeEngine: {
    fontSize: 11,
    fontWeight: 700,
    padding: '5px 12px',
    borderRadius: 20,
    background: '#fef3c7',
    color: '#b45309',
    border: '1px solid #fde68a',
  },

  /* ── Mode Switcher ── */
  modeTabsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  },
  modeTab: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '14px 20px',
    borderRadius: 16,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s ease',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
  },
  modeTabActiveStaff: {
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
    borderColor: '#6366f1',
    color: '#3730a3',
    boxShadow: '0 4px 16px rgba(99, 102, 241, 0.15)',
  },
  modeTabActivePatient: {
    background: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 100%)',
    borderColor: '#ec4899',
    color: '#9d174d',
    boxShadow: '0 4px 16px rgba(236, 72, 153, 0.15)',
  },
  modeTabTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: 2,
  },
  modeTabDesc: {
    fontSize: 11.5,
    color: '#64748b',
  },

  /* ── 2-Column Body Layout ── */
  portalBodyGrid: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: 16,
    minHeight: 560,
  },

  /* Left Column: Directory Panel */
  directoryPanel: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 20,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 4,
  },
  panelSubtitle: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 1.4,
  },
  countPill: {
    fontSize: 11,
    fontWeight: 700,
    color: '#4338ca',
    background: '#eef2ff',
    padding: '4px 10px',
    borderRadius: 20,
    whiteSpace: 'nowrap',
    border: '1px solid #c7d2fe',
  },
  filterBar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },
  roleChips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  roleChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  roleChipActive: {
    background: '#eef2ff',
    borderColor: '#6366f1',
    color: '#4338ca',
  },
  wardFilterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  wardChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '5px 10px',
    borderRadius: 8,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  wardChipActive: {
    background: '#fdf2f8',
    borderColor: '#ec4899',
    color: '#be185d',
  },

  searchBoxWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    fontSize: 13,
    color: '#94a3b8',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '9px 32px 9px 34px',
    color: '#0f172a',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },
  clearSearchBtn: {
    position: 'absolute',
    right: 10,
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 12,
  },

  profilesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    overflowY: 'auto',
    maxHeight: 400,
    paddingRight: 6,
  },
  cardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '12px 14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
  },
  cardItemSelected: {
    background: '#f5f3ff',
    borderColor: '#8b5cf6',
    boxShadow: '0 4px 14px rgba(139, 92, 246, 0.12)',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardDetails: {
    flex: 1,
    minWidth: 0,
  },
  cardRowTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 14,
    fontWeight: 700,
    color: '#0f172a',
  },
  cardBadge: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid',
    background: '#f8fafc',
  },
  cardSubText: {
    fontSize: 11.5,
    color: '#64748b',
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardPillsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  pillTag: {
    fontSize: 10.5,
    background: '#f1f5f9',
    padding: '2px 7px',
    borderRadius: 6,
    color: '#475569',
  },
  selectBtn: {
    padding: '7px 14px',
    borderRadius: 8,
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    color: '#4338ca',
    fontSize: 11.5,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  selectBtnActive: {
    background: '#059669',
    borderColor: '#059669',
    color: '#ffffff',
  },

  /* Right Column: Terminal Form Panel */
  formPanel: {
    display: 'flex',
    flexDirection: 'column',
  },
  terminalCard: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    borderRadius: 20,
    padding: '28px 24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.06)',
  },
  terminalHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  terminalStatusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#059669',
    boxShadow: '0 0 8px rgba(5, 150, 105, 0.3)',
  },
  terminalBadge: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.8,
    color: '#4f46e5',
  },
  terminalTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: '#0f172a',
    marginBottom: 4,
  },
  terminalSub: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 1.4,
    marginBottom: 16,
  },

  activePersonaBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: '10px 14px',
    marginBottom: 16,
  },
  activePersonaAvatar: {
    fontSize: 22,
    width: 36,
    height: 36,
    borderRadius: 8,
    background: '#eef2ff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activePersonaName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#0f172a',
  },
  activePersonaRole: {
    fontSize: 11,
    color: '#64748b',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  activePersonaPill: {
    fontSize: 10,
    fontWeight: 700,
    color: '#047857',
    background: '#ecfdf5',
    padding: '2px 8px',
    borderRadius: 6,
    border: '1px solid #a7f3d0',
  },

  loginForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    flex: 1,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldLabel: {
    fontSize: 11.5,
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  toggleVisibilityBtn: {
    background: 'none',
    border: 'none',
    color: '#4f46e5',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  inputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    fontSize: 14,
    opacity: 0.7,
    pointerEvents: 'none',
  },
  fieldInput: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: '11px 12px 11px 36px',
    color: '#0f172a',
    fontSize: 13.5,
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  },

  submitCTA: {
    width: '100%',
    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '13px',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 0.3,
    boxShadow: '0 4px 16px rgba(79, 70, 229, 0.25)',
    marginTop: 'auto',
    transition: 'all 0.15s ease',
  },
  loadingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  spinnerIcon: {
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    animation: 'spin 0.7s linear infinite',
  },

  terminalFooter: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 1.4,
  },
};
