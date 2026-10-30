# Hospital Dietary Department Meal Planning & Patient Allergy Verification Portal

> **Adaptive Explainable Allergy Risk Model (AEARM)** — Final Year Capstone Project

A comprehensive clinical dietary web application designed to eliminate hospital meal allergy incidents. The system automatically screens patient meal plans against direct and cross-reactive allergens, computes a mathematically grounded risk score, produces transparent plain-English clinical explanations, and adapts confidence scores over time using adaptive exponential smoothing.

---

## 🏗️ Architecture & Technology Stack

- **Backend**: Python 3.12+ · Django 5.x · Django REST Framework (DRF) · Token Authentication
- **Database**: SQLite3 (relational schema across 12 models)
- **Frontend**: React 19 · Vite · React Router v7 · Vanilla CSS Design System (Dark mode, glassmorphism, responsive) · Chart.js (`react-chartjs-2`) · React Hot Toast
- **Allergy Verification Engine**: Adaptive Explainable Allergy Risk Model (AEARM)
- **Logistics**: Tray QR generation (`qrcode` + `Pillow`) & batch barcode scan verification

---

## 🧠 The 4-Component AEARM Pipeline

1. **Component 1 — Allergen Matching (Graph-Based Cross-Reactivity Search)**:
   - Compares meal ingredients against patient allergen records using **graph-based cross-reactivity search using Breadth-First Search (BFS) with distance-based risk decay**.
   - Replaces the former flat lookup ($1.0 / 0.5 / 0.0$) with an unweighted graph where allergen families are nodes and documented immunological relationships are edges.
   - Computes minimum hop count via BFS and calculates risk contribution smoothly as $\text{Weight} = \frac{1}{1 + \text{distance}}$:
     - **0 hops (Direct Match)**: $\frac{1}{1+0} = 1.0$ (e.g., Peanut $\rightarrow$ Peanut)
     - **1 hop (Direct Cross-Reactivity)**: $\frac{1}{1+1} = 0.5$ (e.g., Peanut $\rightarrow$ Tree Nut, Peanut $\rightarrow$ Soy, Shrimp $\rightarrow$ Crayfish)
     - **2 hops (Indirect Cross-Reactivity)**: $\frac{1}{1+2} \approx 0.333$ (e.g., Peanut $\rightarrow$ Lupine via Soy)
     - **No path (Unrelated)**: $0.0$ (e.g., Peanut $\rightarrow$ Dairy)
   - **Worked Demonstration (Peanut $\rightarrow$ Lupine)**: A patient allergic to peanuts receiving a dish with lupine flour traverses the path $\text{Peanut} \rightarrow \text{Soy} \rightarrow \text{Lupine}$ (2 hops), producing a risk contribution of $0.333$. Under the previous flat lookup, this was treated as $0.0$ (clean/no match), demonstrating a significant clinical safety enhancement without breaking backward compatibility for 1.0 and 0.5 cases.
   - **Clinically Documented Edges (Strictly Conservative)**:
     - Legume / Nut Network: `peanut` $\leftrightarrow$ `tree_nut`, `peanut` $\leftrightarrow$ `soy`, `soy` $\leftrightarrow$ `lupine` (immunologically validated homology across 7S/11S seed storage globulins and vicilins).
     - Crustacean Cluster: `shrimp` $\leftrightarrow$ `crab` $\leftrightarrow$ `lobster` $\leftrightarrow$ `crayfish` (broad cross-reactivity mediated by highly conserved invertebrate muscle tropomyosin).
     - Isolated/Clean Nodes: `dairy`, `gluten`, `eggs`, `fish`, `sesame` (zero unverified speculative edges).

2. **Component 2 — Weighted Risk Scoring**:
   - Combines worst-case patient allergy severity, ingredient confidence, and cross-reactivity probability using **trained weights** learned from data via logistic regression with gradient descent:
     $$R = \min\Big(1.0,\; (S \cdot 0.36) + (C \cdot 0.36) + (X \cdot 0.28)\Big)$$
   - Replaced initial hand-picked heuristic weights ($0.50 / 0.30 / 0.20$) with stable, normalized weights learned from a 30-example additive factorial dataset (3 severity $\times$ 5 confidence $\times$ 2 cross levels).
   - **Methodology & Debugging Process**:
     - *Issue 1 (Distribution Mismatch)*: Initial training on negative examples without allergen matches ($X = 0$, bypassed in production by the short-circuit rule) produced negative confidence weights. Fixed with a balanced factorial design varying factors independently.
     - *Issue 2 (Interaction vs. Additive Rule)*: Expanding from 18 to 30 examples with a threshold-interaction rule caused cross-reactivity weights to collapse toward zero because the linear model ($w_1 S + w_2 C + w_3 X + b$) cannot represent interaction effects. Switching to a purely additive clinical labeling rule ($\text{Score} = S + C + X \ge 1.9$) resolved this structural mismatch, achieving stable convergence across 2,000 to 5,000 epochs with $\le 0.03$ drift.
   - **Deliberate Manual Retraining**: Retraining is executed exclusively as a deliberate, manually triggered management command (`python manage.py retrain_aearm_weights`), with terminal inspection and interactive confirmation. It is intentionally not automated per sign-off to ensure clinical stability.
   - Categorizes risk into three operational tiers:
     - **Low Risk ($R < 0.40$)**: Auto-approved and sent directly to the kitchen queue.
     - **Medium Risk ($0.40 \le R < 0.70$)**: Routed to the Dietitian for single review and verification.
     - **High Risk ($R \ge 0.70$)**: Escalated to Senior Clinical Reviewers requiring documented medical rationale.

3. **Component 3 — Adaptive Confidence Update**:
   - Updates ingredient safety confidence after patient consumption outcomes:
     $$C_{t+1} = \text{clamp}\Big(C_t + \alpha \cdot (\text{Outcome} - C_t),\; 0.0,\; 1.0\Big)$$
   - $\alpha = 0.10$ (exponential smoothing rate), $\text{Outcome} = 1.0$ (safe) or $0.0$ (adverse reaction).
   - The update is applied **only to the flagged allergen ingredient(s)** identified in the decision trace — not averaged across all meal ingredients.

4. **Component 4 — Salience-Ranked Explanation**:
   - Generates deterministic, plain-English rationales prioritizing the primary driver of risk (direct match vs. cross-reactivity vs. uncalibrated ingredient confidence).

---

## 🔬 Model Evaluation (Leave-One-Out Cross-Validation — LOOCV)

The self-trained logistic regression risk model was formally evaluated using **Leave-One-Out Cross-Validation (LOOCV)**. With a compact clinical dataset of 30 labeled factorial scenarios, a conventional single train/test split would waste valuable training examples and yield high-variance, unstable estimates. LOOCV is the gold standard for small datasets: the algorithm trains 30 separate models (each trained on 29 held-out examples and evaluated on the single held-out fold) and aggregates the predictions.

### Real Execution Results (`python manage.py evaluate_aearm_model`)

```
Confusion Matrix:
                 Predicted Safe   Predicted Risky
  Actual Safe           8                 4
  Actual Risky          1                17

Aggregated Metrics (30 LOOCV Folds):
  Accuracy:   0.833  (83.3%)
  Precision:  0.810  (17 / 21)
  Recall:     0.944  (17 / 18)
  F1 Score:   0.872
```

### Clinical Interpretation
**Recall matters most here because a false negative (missed risky meal) is far more dangerous than a false positive (unnecessary flag), and the current result favors recall (0.944) over precision (0.810), which is the right trade-off direction for a patient-safety system.**
- **1 False Negative**: Only 1 truly risky scenario was missed by the model across all 30 held-out evaluations.
- **4 False Positives**: 4 safe scenarios were conservatively flagged as risky—this incurs minor dietitian review time rather than compromising patient safety.

---

## 👥 Clinical User Accounts & Authentic Credentials

*Authentication Policy: Each user's password is set to their name in lowercase (or capitalized).*

| Role | Staff / User | Username | Password (Their Name) | Access Rights & Modules |
| :--- | :--- | :--- | :--- | :--- |
| **Doctor / Physician** | Dr. Rajan Kumar | `doctor1` or `rajan` | `rajan` | Patient Inpatient Records, Diagnoses & Allergy Logging |
| **Doctor / Gastro** | Dr. Senthil Nathan | `doctor2` or `senthil` | `senthil` | Inpatient Admissions, Specialty Diagnoses & Directives |
| **Dietitian (Lead)** | Priya Sundar | `dietitian1` or `priya` | `priya` | Autonomous AI Meal Planning, Constraint Engine & Sign-offs |
| **Dietitian (Senior)** | Kavitha Raman | `dietitian2` or `kavitha` | `kavitha` | Clinical Sign-Off Queue, Salience Explanation & Audit |
| **Kitchen Staff** | Chef Ramesh Babu | `kitchen1` or `ramesh` | `ramesh` | Tray Queue, Status Tracking (Prep/Ready/Dispatched), Batch QR Scan |
| **Patient (Bedside)** | Aarthi Rajan | `patient1` or `aarthi` | `aarthi` | Daily Approved Menu, Nutrition Breakdown & Bedside Feedback |
| **Administrator** | System Administrator | `admin1` or `admin` | `admin` | Risk Analytics Dashboard, Full Audit Log Trail, Confidence Monitor |

---

## 🚀 Quick Start Guide

### 1. Backend Setup & Startup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Seed synthetic Tamil Nadu hospital dataset (120 patients, 42 Tamil Nadu meals, 105+ ingredients)
python manage.py seed_data

# Run AEARM unit test suite (43 tests passing)
python manage.py test portal --verbosity=1

# Start the Django development server
python manage.py runserver 127.0.0.1:8000
```

### 2. Frontend Setup & Startup

In a separate terminal:

```bash
cd frontend

# Install node dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser to: `http://localhost:5173`

---

## 🧪 Testing and Verification

Run all unit tests verifying the 4 AEARM pipeline components, math formulas, trained weights, and sign-off routing:

```bash
cd backend
python manage.py test portal
```

**Test Coverage Summary (43 Unit Tests across 12 Test Classes):**
- `TestMatchAllergens`: Direct match detection, cross-reactivity lookup, true negatives, priority handling.
- `TestComputeRisk`: Dynamic AEARM trained weights, boundary threshold scoring (High $\ge 0.70$), component sum consistency.
- `TestUpdateConfidence`: Exponential smoothing convergence over 10 simulated overrides, boundary clamps $[0.0, 1.0]$.
- `TestExplain`: Salience ordering, lead reasons in explanations, tier naming consistency.
- `TestRouteForSignoff`: Role escalation logic (Low $\rightarrow$ auto, Medium $\rightarrow$ dietitian, High $\rightarrow$ senior reviewer).
- `TestDietConstraintsComposition`: Multi-morbidity conflict resolution — priority-tier winner, same-tier default-to-normal, strictness hierarchy.
- `TestAEARMWeightTraining`: Strict positivity ($w > 0$), sum normalization ($\sum w = 1.0$), convergence stability check across 2,000 vs 5,000 epochs ($< 0.10$ drift tolerance), dynamic config loading, and 30-example additive dataset balance & determinism.
- `TestModelEvaluationLOOCV`: Leave-One-Out Cross-Validation metrics and confusion matrix validation (83.3% accuracy, 0.944 recall).
- `TestGraphCrossReactivitySearch`: BFS cross-reactivity graph search with distance-based risk decay ($w = 1 / (1 + d)$).
- `TestAutoAssignAllSummary`: Autonomous batch clinical auto-assignment summary across inpatients.
- `TestDoctorRoleBoundary`: Strict role boundary enforcement ensuring doctor, dietitian, kitchen, patient, and admin isolation.
- `TestCrossReactivityFallbackBoundary`: Conservative fallback staging lookup ($0.5$) for unmapped immunologic pairs.

---

## 📁 Repository Structure

```
fp/
├── backend/
│   ├── hospital_diet/        # Django settings, URLs, WSGI
│   ├── portal/               # Core application
│   │   ├── aearm.py          # 4 AEARM components + router
│   │   ├── diet_constraints.py  # Multi-morbidity constraint solver
│   │   ├── models.py         # 12 Relational DB models
│   │   ├── serializers.py    # DRF serializers
│   │   ├── views.py          # Role-gated API viewsets
│   │   ├── weight_training.py # 30-example additive grid + logistic regression
│   │   ├── tests.py          # 29 Automated AEARM + constraint unit tests
│   │   ├── utils/qr.py       # QR code generator
│   │   └── management/       # seed_data & retrain_aearm_weights commands
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── components/       # Sidebar, UI elements (RiskBadge, AearmCard, Modal)
│   │   ├── context/          # AuthContext (Role & session management)
│   │   ├── pages/            # Role pages (Doctor, Dietitian, Kitchen, Patient, Admin)
│   │   ├── App.jsx           # Client router
│   │   └── index.css         # Dark-mode glassmorphism design system
│   └── package.json
└── README.md
```
