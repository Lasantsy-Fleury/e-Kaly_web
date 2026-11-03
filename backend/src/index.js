import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { pool, initDatabase } from './db.js';

import sessionsRouter from './routes/sessions.js';
import studentsRouter from './routes/students.js';
import distributionsRouter from './routes/distributions.js';
import attendanceRouter from './routes/attendance.js';
import usersRouter from './routes/users.js';
import dashboardRouter from './routes/dashboard.js';
import auditRouter from './routes/audit.js';
import authRouter from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Security & Middlewares
app.use(helmet());
app.use(cors({ origin: '*' })); // Allows Web, Mobile and Render requests
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health Checks (essential for Render health check endpoint)
app.get(['/', '/health', '/api/health'], async (req, res) => {
  try {
    const dbCheck = await pool.query('SELECT NOW() as now, current_database() as db');
    res.json({
      status: 'ok',
      service: 'e-Kaly PostgreSQL Backend API',
      database: 'connected',
      currentDb: dbCheck.rows[0].db,
      dbTime: dbCheck.rows[0].now,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'e-Kaly PostgreSQL Backend API',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/distributions', distributionsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/users', usersRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit-logs', auditRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Route non trouvée: ${req.method} ${req.url}` });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[API Error]', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Erreur interne du serveur',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Start server after ensuring DB migrations are ready
async function start() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`=================================================`);
      console.log(`🚀 e-Kaly Backend running on port ${PORT}`);
      console.log(`🩺 Health check: http://localhost:${PORT}/health`);
      console.log(`📦 Database: PostgreSQL`);
      console.log(`=================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
