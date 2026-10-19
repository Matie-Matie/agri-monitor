import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/auth.js';
import catalogRoutes from './routes/catalog.js';
import productRoutes from './routes/products.js';
import stockRoutes from './routes/stock.js';
import salesRoutes from './routes/sales.js';
import reportRoutes from './routes/reports.js';
import dashboardRoutes from './routes/dashboard.js';
import customerRoutes from './routes/customers.js';
import userRoutes from './routes/users.js';
import activityRoutes from './routes/activity.js';
import { notFound, errorHandler } from './middleware/error.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api', authRoutes);
app.use('/api', catalogRoutes);
app.use('/api', productRoutes);
app.use('/api', stockRoutes);
app.use('/api', customerRoutes);
app.use('/api', salesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/activity-logs', activityRoutes);

// Standalone/localhost mode: serve the built frontend (frontend/dist) from this same server,
// so one process + one port runs the whole system. Skipped when the build isn't there
// (e.g. on Render, where the frontend is hosted separately).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = process.env.FRONTEND_DIST || path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(path.join(distDir, 'index.html'))) {
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

export default app;