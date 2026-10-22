# Agri Monitor — POS & Inventory System

Web-based Point of Sale and Inventory system for **Mitch Agri Supply**.
Thesis project: "Agri Monitor: A Web-Based Point of Sale and Inventory System of Mitch Agri Supply"
BSIT Web Development, ISU Roxas — by Roan Bermudez & James Mathew Corpuz.

## Quick start (Windows, localhost) — just double-click `start.bat`

1. Install **XAMPP** (only MySQL is needed, Apache is not) and **Node.js LTS** once.
2. Double-click **`start.bat`**. It starts MySQL if needed, creates or updates the database by itself, and opens http://localhost:5000.
3. Keep the black window open while using the system. Press CTRL+C in it to stop.

The download already contains everything (system files + built screens), so **no internet is needed** on the computer. The first run loads demo data; later runs only apply updates and never touch existing data.
If it says it can't reach the database: open XAMPP Control Panel, press **Start** on MySQL, then double-click `start.bat` again.

> **Never run `npm run db:init` on a database with real data** — it drops every table. `start.bat` uses the safe `db:setup` (create if missing, otherwise migrate).

### Notes for the developer
- One server runs everything: the backend serves the built frontend from `frontend/dist` (rebuild with `cd frontend && npm run build -- --mode handover`, which keeps the API URL relative). `frontend/dist` and `backend/node_modules` are committed on purpose so an offline PC can run it.
- The hosted demo (Render + Aiven) was deployed from the separate repo `Matie-Matie/agri-monitor-backend`. Its git history lives in `.render-backend.git` (not part of this repo): `git --git-dir=.render-backend.git --work-tree=backend <command>`. **Run `npm run db:migrate` against the Aiven database before pushing the revised backend there**, or the hosted app will break.

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

### Existing database (already has data)
Never re-run `db:init` on a database with real data: it drops tables. Use the non-destructive migration instead:
```bash
cd backend
npm run db:migrate   # idempotent; adds customers, payment status, per-batch supplier
```
Optional env: `LOW_STOCK_THRESHOLD` (default 10): one global low-stock rule for every product.

## Demo accounts
| Username | Password | Role |
| :--- | :--- | :--- |
| admin | admin123 | Admin — full access |
| cashier | cashier123 | Staff — POS + view products |

## Version 3 (2026-10-22)

- **Footer with version** on every page and the login screen: *Version 3 · Revision 2 · Updated October 22, 2026*. Bump `frontend/src/version.js` on each revision.
- **Date validation** — impossible dates (e.g. Feb 31) are rejected for date received / expiry, both in the form and by the server. Date received cannot be in the future, and expiry cannot be before the date received. Report and sales date filters are validated too.
- **Admin has Point of Sale again** (admin and staff can both sell).

## Panel revisions (2026-10)
- **Barcode:** every product's SKU is its barcode. *Products > barcode icon* (or tick several rows > Print labels) prints Code128 labels. POS has an always-focused **Scan barcode** field: the USB scanner types the code + Enter and the item is added (scan again to add another).
- **Auto batch number** `B{YYMMDD}-{productId}-{nn}` on every receiving; *Add product* with a first quantity creates the product and its first batch together.
- **Products page = inventory:** click a row to see its batches (supplier, date received, expiry). Filters for low / out / expiring / expired / active / inactive; dashboard cards link straight to them.
- **Customers in POS:** pick or add a customer; **Charge (unpaid)** creates an *Invoice*, *Paid now* creates a *Receipt*. Mark invoices paid from *Sales*.
- **Suppliers** page (admin); each stock batch records its supplier, so one product can come from several.
- Admin can use the POS again (Version 3); reorder level removed (low stock = ≤ `LOW_STOCK_THRESHOLD`).

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
