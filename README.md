# Agri Monitor — POS & Inventory System

Web-based Point of Sale and Inventory system for **Mitch Agri Supply**.
Thesis project: "Agri Monitor: A Web-Based Point of Sale and Inventory System of Mitch Agri Supply"
BSIT Web Development, ISU Roxas — by Roan Bermudez & James Mathew Corpuz.

## Stack
- **Frontend**: React + Vite + Tailwind CSS v4 + Framer Motion + Recharts + Zustand
- **Backend**: Node.js + Express + MySQL (mysql2)
- **Design**: Green + white (MatieePort style), Poppins, pill inputs, 22px cards

## Setup

### 1. Database
```bash
cd backend
npm install
npm run db:init   # applies schema.sql + seed data (idempotent, safe to re-run)
```

### 2. Backend API
```bash
cd backend
npm run dev       # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev       # http://localhost:5173 (proxies /api to :5000)
```

## Demo accounts
| Username | Password | Role |
| :--- | :--- | :--- |
| admin | admin123 | Admin — full access |
| cashier | cashier123 | Staff — POS + inventory view |

## Key features
- **POS checkout** with transactional FIFO stock deduction (sell soonest-expiry batch first)
- **Inventory** by batch with expiry tracking (expired / expiring ≤ 30 days / low / out badges)
- **Stock-in** receiving with batch numbers and expiry dates
- **Reports**: sales, inventory, low-stock, expiration — CSV export
- **Dashboard**: today's sales, low stock, expiring items, 7-day chart
- **Audit trail**: every sale, stock movement, and action is logged
- **Roles**: Admin (full) / Staff (POS + inventory)
- **Guards**: oversell blocked, expired stock blocked from sale, double-click safe checkout

## API (REST, /api)
`POST /login` · `GET /me` · `GET/POST /products` · `GET /products/:id` · `POST /products/:id/batches` ·
`GET /inventory` · `POST /stock/adjustments` · `POST /sales` (checkout) · `GET /sales` · `GET /sales/:id` ·
`GET /sales/daily-summary` · `GET /reports/inventory|low-stock|expiry|sales` · `GET /reports/export/:type` ·
`GET /dashboard` · `GET/POST /users` · `GET /activity-logs` · categories & suppliers CRUD

## Notes
- MariaDB (XAMPP) works with the included schema. MySQL 8 also compatible.
- `JWT_SECRET` should be changed in production.
- Seed data includes deliberately expired / expiring / low-stock / out-of-stock batches for demo purposes.
