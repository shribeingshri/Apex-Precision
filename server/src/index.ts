import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { leadsRouter } from './routes/leads';
import { clientsRouter } from './routes/clients';
import { projectsRouter } from './routes/projects';
import { productionRouter } from './routes/production';
import { qualityRouter } from './routes/quality';
import { deliveryRouter } from './routes/delivery';
import { invoicesRouter } from './routes/invoices';
import { paymentsRouter } from './routes/payments';
import { expensesRouter } from './routes/expenses';
import { payrollRouter } from './routes/payroll';
import { retainersRouter } from './routes/retainers';
import { employeesRouter } from './routes/employees';
import { tasksRouter } from './routes/tasks';
import { messagesRouter } from './routes/messages';
import { emailLogsRouter } from './routes/email-logs';
import { activityRouter } from './routes/activity';
import { reportsRouter } from './routes/reports';
import { exportRouter } from './routes/export';
import { settingsRouter } from './routes/settings';
import { errorHandler } from './middleware/error';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Global Middleware
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// API Route Mounts
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/production', productionRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/delivery', deliveryRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/expenses', expensesRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/retainers', retainersRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/email-logs', emailLogsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);

// Root healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'Manufacturing ERP Management System',
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend build if exists
const clientDistPath = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(404).send('Manufacturing ERP Client build not found');
    }
  });
});

// Central Error Handler
app.use(errorHandler);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`[Manufacturing ERP] Server running on port ${PORT}`);
  });
}

export default app;

