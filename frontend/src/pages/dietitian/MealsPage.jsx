import { useState, useEffect, useCallback } from 'react';
import api from '../../api';
import toast from 'react-hot-toast';
import { Loading, Modal, EmptyState } from '../../components/UI';

export default function MealsPage() {
  const [meals, setMeals] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [mealTypeFilter, setMealTypeFilter] = useState('');
  const [dietTagFilter, setDietTagFilter] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    meal_type: 'lunch',
    diet_tags: [],
    nutrition_tags: {},
    ingredient_ids: [],
  });

  const [dietTagInput, setDietTagInput] = useState('');

  const fetchMeals = useCallback(async () => {
    try {
      const params = {};
      if (mealTypeFilter) params.meal_type = mealTypeFilter;
      if (dietTagFilter) params.diet_tag = dietTagFilter;
      if (search) params.search = search;
      const res = await api.get('/meals/', { params });
      setMeals(res.data.results || res.data || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load meals');
    } finally {
      setLoading(false);
    }
  }, [mealTypeFilter, dietTagFilter, search]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  useEffect(() => {
    api.get('/ingredients/')
      .then(res => setIngredients(res.data.results || res.data || []))
      .catch(err => console.error(err));
  }, []);

  const handleAddDietTag = () => {
    if (!dietTagInput.trim()) return;
    const tag = dietTagInput.trim().toLowerCase();
    if (!formData.diet_tags.includes(tag)) {
      setFormData(prev => ({ ...prev, diet_tags: [...prev.diet_tags, tag] }));
    }
    setDietTagInput('');
  };

  const handleRemoveDietTag = (tag) => {
    setFormData(prev => ({ ...prev, diet_tags: prev.diet_tags.filter(t => t !== tag) }));
  };

  const handleToggleIngredient = (id) => {
    setFormData(prev => {
      const exists = prev.ingredient_ids.includes(id);
      return {
        ...prev,
        ingredient_ids: exists
          ? prev.ingredient_ids.filter(i => i !== id)
          : [...prev.ingredient_ids, id],
      };
    });
  };

  const handleCreateMeal = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error('Meal name is required');
      return;
    }
    if (formData.ingredient_ids.length === 0) {
      toast.error('Please select at least one ingredient');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/meals/', formData);
      toast.success('New meal added to catalogue');
      setModalOpen(false);
      setFormData({
        name: '',
        description: '',
        meal_type: 'lunch',
        diet_tags: [],
        nutrition_tags: {},
        ingredient_ids: [],
      });
      fetchMeals();
    } catch (err) {
      console.error(err);
      const errText = err.response?.data?.detail ||
        Object.entries(err.response?.data || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' ') : v}`).join('; ') ||
        'Failed to save meal';
      toast.error(errText);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="meals-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Hospital Meal Catalogue</h2>
          <p>Standard dietary formulations, verified ingredients, and allergen composition profiles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
          + Add New Meal
        </button>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Search meal name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ width: 160 }}>
            <select
              className="form-control"
              value={mealTypeFilter}
              onChange={e => setMealTypeFilter(e.target.value)}
            >
              <option value="">All Meal Types</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>
          <div style={{ width: 180 }}>
            <select
              className="form-control"
              value={dietTagFilter}
              onChange={e => setDietTagFilter(e.target.value)}
            >
              <option value="">All Dietary Tags</option>
              <option value="renal">Renal</option>
              <option value="diabetic">Diabetic</option>
              <option value="cardiac">Cardiac</option>
              <option value="vegan">Vegan</option>
              <option value="vegetarian">Vegetarian</option>
              <option value="gluten_free">Gluten-Free</option>
              <option value="low_sodium">Low Sodium</option>
            </select>
          </div>
        </div>
      </div>

      {/* Meals Grid */}
      {loading ? (
        <Loading text="Loading meal catalogue..." />
      ) : meals.length === 0 ? (
        <EmptyState icon="🥗" title="No meals found" desc="Try adjusting your filter search or add a new meal." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
          {meals.map(meal => (
            <div key={meal.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11,
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    color: 'var(--brand-400)',
                    background: 'rgba(99,102,241,0.12)',
                    padding: '2px 8px',
                    borderRadius: 10,
                  }}>
                    {meal.meal_type}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID #{meal.id}</span>
                </div>

                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{meal.name}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12, minHeight: 36 }}>
                  {meal.description || 'Standard hospital dietary preparation.'}
                </p>

                {/* Dietary Tags */}
                {meal.diet_tags && meal.diet_tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {meal.diet_tags.map((tag, idx) => (
                      <span key={idx} style={{
                        fontSize: 11,
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                      }}>
                        🏷️ {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Ingredients Breakdown */}
                <div style={{ background: 'var(--bg-glass)', padding: 12, borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                    Ingredients ({meal.ingredients?.length || 0})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {meal.ingredients?.map(ing => (
                      <span
                        key={ing.id}
                        title={`Family: ${ing.allergen_family || 'None'} · Severity: ${ing.severity_tier || 'N/A'}`}
                        style={{
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: ing.allergen_family ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-elevated)',
                          color: ing.allergen_family ? 'var(--risk-high)' : 'var(--text-primary)',
                          border: ing.allergen_family ? '1px solid rgba(239,68,68,0.2)' : '1px solid var(--border)',
                        }}
                      >
                        {ing.name} {ing.allergen_family && '⚠️'}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-muted)' }}>
                AEARM Cross-Reactivity Verified
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Meal Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Hospital Meal Formulation"
        footer={(
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateMeal} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Meal Formulation'}
            </button>
          </div>
        )}
      >
        <form onSubmit={handleCreateMeal}>
          <div className="form-group">
            <label className="form-label">Meal Name *</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., Steamed Cod with Quinoa & Asparagus"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Meal Slot</label>
              <select
                className="form-control"
                value={formData.meal_type}
                onChange={e => setFormData({ ...formData, meal_type: e.target.value })}
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Add Diet Tag</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. diabetic, renal..."
                  value={dietTagInput}
                  onChange={e => setDietTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDietTag(); } }}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddDietTag}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {formData.diet_tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {formData.diet_tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 12,
                  padding: '2px 8px',
                  borderRadius: 12,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {tag}
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    onClick={() => handleRemoveDietTag(tag)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows="2"
              placeholder="Preparation instructions, dietary rationale..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Ingredients * ({formData.ingredient_ids.length} selected)</label>
            <div style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: 10,
              background: 'var(--bg-elevated)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}>
              {ingredients.map(ing => {
                const checked = formData.ingredient_ids.includes(ing.id);
                return (
                  <label
                    key={ing.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: 4,
                      background: checked ? 'rgba(99,102,241,0.15)' : 'transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleIngredient(ing.id)}
                    />
                    <span>
                      {ing.name}
                      {ing.allergen_family && (
                        <span style={{ color: 'var(--risk-high)', fontSize: 10, marginLeft: 4 }}>
                          ({ing.allergen_family})
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
