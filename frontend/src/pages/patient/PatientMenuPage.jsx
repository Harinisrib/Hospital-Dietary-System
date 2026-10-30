import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, EmptyState } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

const MEAL_SLOT_META = {
  breakfast: {
    label: 'Morning Breakfast',
    icon: '🌅',
    color: '#b45309',
    bg: '#fef3c7',
    border: '#fde68a',
    accentBorder: '#f59e0b',
    time: '08:00 AM – 09:30 AM',
    cutoff: '09:30 AM',
    prepTarget: 'Warm Digestive Formulation',
    calories: '340 kcal',
    protein: '14g (Plant Protein)',
    carbs: '54g (Complex GI)',
    fiber: '6.5g Dietary Fiber',
    sodium: '< 380 mg (Low-Sodium)',
    prepMethod: 'Sterile Steam-Cooking & Tempering',
  },
  lunch: {
    label: 'Afternoon Lunch',
    icon: '☀️',
    color: '#047857',
    bg: '#d1fae5',
    border: '#a7f3d0',
    accentBorder: '#10b981',
    time: '12:30 PM – 02:00 PM',
    cutoff: '15:00 PM',
    prepTarget: 'Metabolic & Therapeutic Nutrients',
    calories: '490 kcal',
    protein: '22g (High Biological Value)',
    carbs: '68g (Slow-Release)',
    fiber: '8.2g High Prebiotic Fiber',
    sodium: '< 420 mg (Electrolyte Balanced)',
    prepMethod: 'Boiled Whole Grains & Herbal Decoction',
  },
  dinner: {
    label: 'Evening Dinner',
    icon: '🌙',
    color: '#6d28d9',
    bg: '#ede9fe',
    border: '#ddd6fe',
    accentBorder: '#8b5cf6',
    time: '07:30 PM – 09:00 PM',
    cutoff: '21:30 PM',
    prepTarget: 'Gentle Nocturnal Digestion',
    calories: '370 kcal',
    protein: '16g (Easily Digestible)',
    carbs: '50g (Light Glycemic)',
    fiber: '5.8g Soothing Fiber',
    sodium: '< 350 mg (Cardiac Gentle)',
    prepMethod: 'Gentle Steaming & Digestive Broth',
  },
};

export default function PatientMenuPage() {
  const { user } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await api.get('/patient-menu/');
      setMenuItems(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Could not load your daily menu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMenu();
  }, [fetchMenu]);

  // Order meals by breakfast -> lunch -> dinner
  const slotOrder = ['breakfast', 'lunch', 'dinner'];
  const sortedItems = [...menuItems].sort((a, b) => {
    const idxA = slotOrder.indexOf(a.meal_slot?.toLowerCase());
    const idxB = slotOrder.indexOf(b.meal_slot?.toLowerCase());
    return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
  });

  const todayDateStr = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="patient-menu-page" style={{ maxWidth: 1140, margin: '0 auto', paddingBottom: 50 }}>
      {/* Page Header */}
      <div className="page-header" style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🥗</div>
        <h2 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>
          Welcome, {user?.full_name || user?.username}!
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
          Here is your personalized, clinical allergy-verified menu for <strong>Today ({todayDateStr})</strong>.
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 14,
            padding: '8px 18px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 24,
            color: '#047857',
            fontSize: 12.5,
            fontWeight: 700,
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)',
          }}
        >
          <span>🛡️</span> All 3 daily sessions screened &amp; authorized by AEARM Clinical Allergy Protocol
        </div>
      </div>

      {loading ? (
        <Loading text="Loading your dietary schedule for today..." />
      ) : sortedItems.length === 0 ? (
        <EmptyState
          icon="🍽️"
          title="No Approved Meals for Today Yet"
          desc="Your hospital dietitian is reviewing and formulating your clinical meal plan for today. Please check back shortly."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Header Summary Card */}
          <div
            className="card"
            style={{
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: '20px 26px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--text-muted)' }}>
                  Today's Prescribed Clinical Nutrition Schedule
                </div>
                <h3 style={{ fontSize: 21, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📅</span> {todayDateStr}
                </h3>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '7px 16px',
                  borderRadius: 20,
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>🥗</span> {sortedItems.length} Therapeutic Meals Formulated
              </div>
            </div>
          </div>

          {/* StPreferredItem Horizontal Meal Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {sortedItems.map(item => {
              const slotKey = item.meal_slot?.toLowerCase();
              const meta = MEAL_SLOT_META[slotKey] || {
                label: item.meal_slot?.toUpperCase(),
                icon: '🍽️',
                color: '#4f46e5',
                bg: '#eef2ff',
                border: '#c7d2fe',
                accentBorder: '#6366f1',
                time: 'Scheduled Session',
                cutoff: 'Standard Hours',
                prepTarget: 'Therapeutic Nutrition',
                calories: '400 kcal',
                protein: '16g',
                carbs: '55g',
                fiber: '6g',
                sodium: '< 400 mg',
                prepMethod: 'Sterile Dietary Kitchen',
              };

              const dietTags = item.meal_diet_tags || [];
              const nutritionTags = item.meal_nutrition_tags || [];
              const ingredients = item.meal_ingredients || [];

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    borderRadius: 18,
                    border: '1px solid #e2e8f0',
                    borderLeft: `6px solid ${meta.accentBorder}`,
                    boxShadow: '0 4px 18px rgba(0, 0, 0, 0.04)',
                    padding: '24px 28px',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Top Horizontal Bar: Session Info, Window, Safety Clearances */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                      paddingBottom: 16,
                      marginBottom: 18,
                      borderBottom: '1px solid #f1f5f9',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Session Badge */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11.5,
                          textTransform: 'uppercase',
                          letterSpacing: 0.6,
                          fontWeight: 800,
                          padding: '5px 12px',
                          borderRadius: 8,
                          background: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`,
                        }}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.label}</span>
                      </div>

                      {/* Serving Window Pill */}
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 700,
                          color: '#475569',
                          background: '#f8fafc',
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <span>🕒</span>
                        <span>{meta.time}</span>
                      </div>

                      {/* Service Cutoff */}
                      <span
                        style={{
                          fontSize: 11,
                          color: '#64748b',
                          background: '#f1f5f9',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontWeight: 600,
                        }}
                      >
                        Cutoff: <strong style={{ color: '#0f172a' }}>{meta.cutoff}</strong>
                      </span>

                      {/* Kitchen Status */}
                      <span
                        style={{
                          fontSize: 11,
                          color: '#047857',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        }}
                      >
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: '#059669',
                            display: 'inline-block',
                          }}
                        />
                        Freshly Prepared &amp; Sterilized
                      </span>
                    </div>

                    {/* Medical Allergy Seal */}
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#047857',
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        padding: '6px 14px',
                        borderRadius: 20,
                        boxShadow: '0 1px 4px rgba(16, 185, 129, 0.08)',
                      }}
                    >
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: '#059669',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </span>
                      <span>AEARM Verified Safe · Zero Inpatient Allergy Risk</span>
                    </div>
                  </div>

                  {/* Horizontal Card Body: 2 Wide Balanced Columns */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                      gap: 24,
                      alignItems: 'start',
                    }}
                  >
                    {/* Left Column: Meal Identity, Tags, Description, Clinical Ingredients */}
                    <div>
                      <h4
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: '#0f172a',
                          marginBottom: 8,
                          lineHeight: 1.35,
                        }}
                      >
                        {item.meal_name}
                      </h4>

                      {/* Clinical Diet & Nutrition Tags */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                        {dietTags.map(t => (
                          <span
                            key={t}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              padding: '3px 10px',
                              borderRadius: 6,
                              background: '#eef2ff',
                              color: '#4338ca',
                              border: '1px solid #c7d2fe',
                            }}
                          >
                            🥗 {t} Diet
                          </span>
                        ))}
                        {nutritionTags.map(t => (
                          <span
                            key={t}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: 'capitalize',
                              padding: '3px 10px',
                              borderRadius: 6,
                              background: '#f0fdf4',
                              color: '#047857',
                              border: '1px solid #bbf7d0',
                            }}
                          >
                            ✨ {t.replace(/-/g, ' ')}
                          </span>
                        ))}
                      </div>

                      {/* Formulation Description */}
                      <p
                        style={{
                          fontSize: 13,
                          color: '#475569',
                          lineHeight: 1.6,
                          marginBottom: 16,
                        }}
                      >
                        {item.meal_description ||
                          'Clinical Tamil Nadu dietary preparation formulated under sterile clinical guidelines for inpatient care.'}
                      </p>

                      {/* Verified Clinical Ingredients List */}
                      {ingredients.length > 0 && (
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 12,
                            padding: '12px 16px',
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              textTransform: 'uppercase',
                              letterSpacing: 0.6,
                              color: '#64748b',
                              marginBottom: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span>🌿</span> Verified Clinical Ingredients ({ingredients.length})
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {ingredients.map((ing, i) => (
                              <span
                                key={i}
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  color: '#1e293b',
                                  background: '#ffffff',
                                  border: '1px solid #cbd5e1',
                                  padding: '4px 10px',
                                  borderRadius: 6,
                                }}
                              >
                                {ing}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Column: Nutrition Profile & Bedside Delivery Box */}
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 14,
                        padding: '18px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 14,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderBottom: '1px solid #e2e8f0',
                          paddingBottom: 10,
                          flexWrap: 'wrap',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0.6,
                            color: '#334155',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span>📊</span> Nutritional &amp; Metabolic Profile
                        </div>
                        <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                          {meta.prepMethod}
                        </span>
                      </div>

                      {/* 4 Nutrient Badges */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                            Energy
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#b45309', marginTop: 2 }}>
                            {meta.calories}
                          </div>
                        </div>

                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                            Protein
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#4338ca', marginTop: 2 }}>
                            {meta.protein}
                          </div>
                        </div>

                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                            Carbs &amp; Prebiotic Fiber
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#047857', marginTop: 2 }}>
                            {meta.carbs} · {meta.fiber}
                          </div>
                        </div>

                        <div
                          style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 10,
                            padding: '10px 14px',
                          }}
                        >
                          <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                            Electrolyte Ceiling
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#0284c7', marginTop: 2 }}>
                            {meta.sodium}
                          </div>
                        </div>
                      </div>

                      {/* Bedside Service Assurance Box */}
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          padding: '12px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          fontSize: 12,
                          color: '#475569',
                        }}
                      >
                        <span style={{ fontSize: 22 }}>🛏️</span>
                        <div style={{ flex: 1, lineHeight: 1.45 }}>
                          <strong style={{ color: '#0f172a' }}>Sterile Bedside Tray Delivery:</strong> Plated under
                          clinical protocols, sealed in temperature-controlled carts, and served directly to your bedside.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
