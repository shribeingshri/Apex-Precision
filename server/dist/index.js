"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("./routes/auth");
const dashboard_1 = require("./routes/dashboard");
const leads_1 = require("./routes/leads");
const clients_1 = require("./routes/clients");
const projects_1 = require("./routes/projects");
const production_1 = require("./routes/production");
const quality_1 = require("./routes/quality");
const delivery_1 = require("./routes/delivery");
const invoices_1 = require("./routes/invoices");
const payments_1 = require("./routes/payments");
const expenses_1 = require("./routes/expenses");
const payroll_1 = require("./routes/payroll");
const retainers_1 = require("./routes/retainers");
const employees_1 = require("./routes/employees");
const tasks_1 = require("./routes/tasks");
const messages_1 = require("./routes/messages");
const email_logs_1 = require("./routes/email-logs");
const activity_1 = require("./routes/activity");
const reports_1 = require("./routes/reports");
const export_1 = require("./routes/export");
const settings_1 = require("./routes/settings");
const error_1 = require("./middleware/error");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Global Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json());
app.use((0, morgan_1.default)('dev'));
// API Route Mounts
app.use('/api/auth', auth_1.authRouter);
app.use('/api/dashboard', dashboard_1.dashboardRouter);
app.use('/api/leads', leads_1.leadsRouter);
app.use('/api/clients', clients_1.clientsRouter);
app.use('/api/projects', projects_1.projectsRouter);
app.use('/api/production', production_1.productionRouter);
app.use('/api/quality', quality_1.qualityRouter);
app.use('/api/delivery', delivery_1.deliveryRouter);
app.use('/api/invoices', invoices_1.invoicesRouter);
app.use('/api/payments', payments_1.paymentsRouter);
app.use('/api/expenses', expenses_1.expensesRouter);
app.use('/api/payroll', payroll_1.payrollRouter);
app.use('/api/retainers', retainers_1.retainersRouter);
app.use('/api/employees', employees_1.employeesRouter);
app.use('/api/tasks', tasks_1.tasksRouter);
app.use('/api/messages', messages_1.messagesRouter);
app.use('/api/email-logs', email_logs_1.emailLogsRouter);
app.use('/api/activity', activity_1.activityRouter);
app.use('/api/reports', reports_1.reportsRouter);
app.use('/api/export', export_1.exportRouter);
app.use('/api/settings', settings_1.settingsRouter);
// Root healthcheck
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ONLINE',
        system: 'Manufacturing ERP Management System',
        timestamp: new Date().toISOString(),
    });
});
// Serve frontend build if exists
const clientDistPath = path_1.default.resolve(__dirname, '../../client/dist');
app.use(express_1.default.static(clientDistPath));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path_1.default.join(clientDistPath, 'index.html'), (err) => {
        if (err) {
            res.status(404).send('Manufacturing ERP Client build not found');
        }
    });
});
// Central Error Handler
app.use(error_1.errorHandler);
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`[Manufacturing ERP] Server running on port ${PORT}`);
    });
}
exports.default = app;
