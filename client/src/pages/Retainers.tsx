import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Retainer, Client } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Clock, Plus, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

export const Retainers: React.FC = () => {
  const [retainers, setRetainers] = useState<Retainer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    scope: 'Annual Comprehensive CNC Machine Spares & Tooling Maintenance',
    contractValue: 1200000,
    recurringFee: 100000,
    billingFrequency: 'MONTHLY',
    startDate: new Date().toISOString().split('T')[0],
    renewalDate: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
    estimatedDeliveryCosts: 400000,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [retList, cls] = await Promise.all([
        apiRequest<Retainer[]>('/api/retainers'),
        apiRequest<Client[]>('/api/clients'),
      ]);
      setRetainers(retList);
      setClients(cls);
      if (cls.length > 0 && !formData.clientId) {
        setFormData((prev) => ({ ...prev, clientId: cls[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateRetainer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/retainers', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Retainer contract agreement successfully initialized!');
    } catch (err: any) {
      alert(err.message || 'Failed to create retainer');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Retainer & Maintenance Contracts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Recurring client service agreements, recurring cashflows, renewal alerts, and profit margins
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> New Retainer Agreement
        </button>
      </div>

      {/* Retainers Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Contract Code / Client</th>
                <th className="px-6 py-3.5">Scope of Maintenance</th>
                <th className="px-6 py-3.5 text-right">Contract Value</th>
                <th className="px-6 py-3.5 text-right">Recurring Fee</th>
                <th className="px-6 py-3.5">Next Renewal</th>
                <th className="px-6 py-3.5 text-right">Est. Profit</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading retainer contracts...
                  </td>
                </tr>
              ) : retainers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No active retainers found.
                  </td>
                </tr>
              ) : (
                retainers.map((ret) => {
                  const estProfit = Number(ret.contractValue) - Number(ret.estimatedDeliveryCosts);
                  const marginPct =
                    Number(ret.contractValue) > 0
                      ? Math.round((estProfit / Number(ret.contractValue)) * 100)
                      : 0;

                  return (
                    <tr key={ret.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-6 py-4">
                        <div className="font-mono text-sky-400 font-semibold">{ret.retainerCode}</div>
                        <div className="font-semibold text-white">{ret.client?.companyName}</div>
                      </td>
                      <td className="px-6 py-4 text-xs max-w-xs truncate text-slate-300">
                        {ret.scope}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-white">
                        {formatCurrency(ret.contractValue)}
                      </td>
                      <td className="px-6 py-4 text-right font-semibold text-emerald-400">
                        {formatCurrency(ret.recurringFee)}{' '}
                        <span className="text-[11px] text-slate-500 font-normal">/{ret.billingFrequency.toLowerCase()}</span>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-sky-400" />
                          {formatDate(ret.renewalDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-semibold text-emerald-400">{formatCurrency(estProfit)}</div>
                        <div className="text-[11px] text-slate-500">Margin: {marginPct}%</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <Badge variant={getStatusBadgeVariant(ret.status)}>{ret.status}</Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Retainer Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Establish Retainer Agreement"
        subtitle="Long-term service & component replenishment contract"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRetainer} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Client *</label>
            <select
              required
              value={formData.clientId}
              onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.companyName} ({c.clientCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Contract Scope *</label>
            <input
              type="text"
              required
              value={formData.scope}
              onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Total Contract Value (₹) *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.contractValue}
                onChange={(e) => setFormData({ ...formData, contractValue: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Recurring Retainer Fee (₹) *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.recurringFee}
                onChange={(e) => setFormData({ ...formData, recurringFee: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Billing Frequency</label>
              <select
                value={formData.billingFrequency}
                onChange={(e) => setFormData({ ...formData, billingFrequency: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
                <option value="ANNUALLY">Annually</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Estimated Delivery Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.estimatedDeliveryCosts}
                onChange={(e) => setFormData({ ...formData, estimatedDeliveryCosts: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Renewal Target Date *</label>
              <input
                type="date"
                required
                value={formData.renewalDate}
                onChange={(e) => setFormData({ ...formData, renewalDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Finalize Retainer Agreement
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

