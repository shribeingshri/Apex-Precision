import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Expense, Project } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Receipt, Plus, Check, X, Download, Filter } from 'lucide-react';

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    payee: 'Precision Tooling Works',
    date: new Date().toISOString().split('T')[0],
    category: 'RAW_MATERIALS',
    amount: 45000,
    paymentMethod: 'Bank Transfer',
    reference: 'PO-EXP-8891',
    projectId: '',
    notes: 'Grade 5 Titanium billet stock for manufacturing',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [expList, projs] = await Promise.all([
        apiRequest<Expense[]>('/api/expenses'),
        apiRequest<Project[]>('/api/projects'),
      ]);
      setExpenses(expList);
      setProjects(projs);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Expense recorded and submitted for approval!');
    } catch (err: any) {
      alert(err.message || 'Failed to record expense');
    }
  };

  const handleApproval = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await apiRequest(`/api/expenses/${id}/approval`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus: status }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || `Failed to update approval status`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Expense Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Operational and project-specific cost tracking with multi-level approval workflow
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Record New Expense
        </button>
      </div>

      {/* Expenses Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Expense ID / Date</th>
                <th className="px-6 py-3.5">Vendor / Payee</th>
                <th className="px-6 py-3.5">Category</th>
                <th className="px-6 py-3.5">Project Linked</th>
                <th className="px-6 py-3.5 text-right">Amount</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No expenses recorded yet.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sky-400 font-semibold">{exp.expenseCode}</div>
                      <div className="text-xs text-slate-500">{formatDate(exp.date)}</div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white">{exp.payee}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="px-2.5 py-1 bg-slate-800 rounded text-slate-300 font-medium">
                        {exp.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {exp.project ? exp.project.name : 'General Factory Overhead'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-rose-400">
                      {formatCurrency(exp.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(exp.approvalStatus)}>{exp.approvalStatus}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {exp.approvalStatus === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApproval(exp.id, 'APPROVED')}
                            className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded-lg text-xs"
                            title="Approve Expense"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleApproval(exp.id, 'REJECTED')}
                            className="p-1.5 bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 rounded-lg text-xs"
                            title="Reject Expense"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Finalized</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Operational Expense"
        subtitle="Log manufacturing overhead or project-specific cost"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Vendor / Payee *</label>
            <input
              type="text"
              required
              value={formData.payee}
              onChange={(e) => setFormData({ ...formData, payee: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Category *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="RAW_MATERIALS">Raw Materials</option>
                <option value="MANUFACTURING">Manufacturing / Tooling</option>
                <option value="TRANSPORT">Transport & Delivery</option>
                <option value="UTILITIES">Utilities & Power</option>
                <option value="MAINTENANCE">Machine Maintenance</option>
                <option value="ADMINISTRATION">Administration</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Amount (₹) *</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Expense Date *</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Associated Project</label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="">General Overhead</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} &bull; {p.name}
                  </option>
                ))}
              </select>
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
              Submit Expense
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
