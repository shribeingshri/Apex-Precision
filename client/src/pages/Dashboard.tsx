import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { DashboardMetrics } from '../types';
import { formatCurrency } from '../utils/format';
import {
  Briefcase,
  Layers,
  Factory,
  ShieldCheck,
  AlertTriangle,
  Truck,
  CheckCircle2,
  TrendingUp,
  Receipt,
  Wallet,
  Clock,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiRequest<DashboardMetrics>('/api/dashboard/metrics');
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard metrics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-6 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300">
        <h3 className="font-semibold text-lg">Dashboard Error</h3>
        <p className="text-sm mt-1">{error || 'Unable to retrieve metrics'}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-sm flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  const { operational, financial, charts, alerts } = metrics;

  // Chart colors
  const STATUS_COLORS: Record<string, string> = {
    APPROVED: '#10b981',
    IN_PRODUCTION: '#0284c7',
    QUALITY_INSPECTION: '#8b5cf6',
    READY_FOR_DELIVERY: '#06b6d4',
    COMPLETED: '#059669',
    PLANNING: '#f59e0b',
  };

  const EXPENSE_COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185', '#34d399', '#fbbf24'];

  return (
    <div className="space-y-6">
      {/* Page Title & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Executive Command Dashboard</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Real-time manufacturing operations, financial reconciliation & production KPIs
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" />
          Refresh Metrics
        </button>
      </div>

      {/* Critical Alert Banners */}
      {alerts && alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                alert.severity === 'DANGER'
                  ? 'bg-rose-950/40 border-rose-800/80 text-rose-300'
                  : alert.severity === 'WARNING'
                  ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                  : 'bg-sky-950/40 border-sky-800/80 text-sky-300'
              }`}
            >
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider">{alert.title}</h4>
                <p className="text-sm mt-0.5 font-medium">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Financial Overview Cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Financial Performance & Cashflow
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="text-xs font-medium text-slate-400">Total Invoiced (Billed)</div>
            <div className="text-2xl font-bold text-white mt-1">
              {formatCurrency(financial.totalInvoicedRevenue)}
            </div>
            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
              <span>{financial.invoicedCount} Issued Invoices</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="text-xs font-medium text-emerald-400">Total Collected Cash</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">
              {formatCurrency(financial.totalCollectedCash)}
            </div>
            <div className="text-xs text-slate-500 mt-2">Verified bank & UPI credits</div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="text-xs font-medium text-amber-400">Outstanding Receivables</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">
              {formatCurrency(financial.outstandingReceivables)}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Overdue: {formatCurrency(financial.overdueInvoicesAmount)} ({financial.overdueInvoicesCount})
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm relative overflow-hidden">
            <div className="text-xs font-medium text-slate-400">Total Operational Expenses</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {formatCurrency(financial.recordedExpenses)}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Payroll: {formatCurrency(financial.payrollExpenditure)}
            </div>
          </div>
        </div>
      </div>

      {/* Operational Metrics Cards */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <Factory className="w-4 h-4 text-sky-400" /> Manufacturing & Delivery Pipeline
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <Briefcase className="w-5 h-5 text-sky-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-white">{operational.activeProjects}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active Projects</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <Layers className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-white">{operational.totalUnitsOrdered.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Units Ordered</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <Factory className="w-5 h-5 text-sky-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-white">{operational.unitsInProduction.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">In Production</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-emerald-400">{operational.unitsQualityApproved.toLocaleString()}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">QC Approved</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <AlertTriangle className="w-5 h-5 text-rose-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-rose-400">
              {(operational.rejectedQuantities + operational.reworkQuantities).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Scrap / Rework</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <Truck className="w-5 h-5 text-amber-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-amber-400">{operational.pendingDeliveries}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Pending Dispatch</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center">
            <CheckCircle2 className="w-5 h-5 text-teal-400 mx-auto mb-1.5" />
            <div className="text-lg font-bold text-teal-400">{operational.completedDeliveries}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Delivered Orders</div>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold text-white mb-1">Invoiced Revenue vs. Collected Cash</h3>
          <p className="text-xs text-slate-400 mb-4">
            Compares gross billing invoices with actual cash realized in bank
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                <YAxis
                  stroke="#94a3b8"
                  fontSize={11}
                  tickFormatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(val), '']}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Legend />
                <Bar dataKey="invoiced" name="Invoiced (Billed)" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="collected" name="Collected Cash" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Project Status Distribution */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <h3 className="text-sm font-semibold text-white mb-1">Project Status Distribution</h3>
          <p className="text-xs text-slate-400 mb-4">
            Active manufacturing orders across lifecycle phases
          </p>
          <div className="h-64 flex items-center justify-center">
            {charts.projectStatusDistribution && charts.projectStatusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.projectStatusDistribution}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {charts.projectStatusDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={STATUS_COLORS[entry.status] || '#64748b'}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-500">No project status data recorded</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
