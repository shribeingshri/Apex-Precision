import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Project } from '../types';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Plus, Factory, Layers, Calendar, CheckCircle2, RefreshCw } from 'lucide-react';

export const Manufacturing: React.FC = () => {
  const [productionLogs, setProductionLogs] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    producedQty: 500,
    productionDate: new Date().toISOString().split('T')[0],
    productionShift: 'Shift A (Morning)',
    machineLine: 'CNC Line 01',
    recordedMaterialCost: 25000,
    labourCost: 8000,
    notes: 'Standard manufacturing run',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [logs, projs] = await Promise.all([
        apiRequest<any[]>('/api/production'),
        apiRequest<Project[]>('/api/projects'),
      ]);
      setProductionLogs(logs);
      setProjects(projs);
      if (projs.length > 0 && !formData.projectId) {
        setFormData((prev) => ({ ...prev, projectId: projs[0].id }));
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

  const handleLogProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/production', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsLogModalOpen(false);
      fetchData();
      alert('Production run successfully recorded!');
    } catch (err: any) {
      alert(err.message || 'Failed to record production');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manufacturing & Production Runs</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Log shift batches, machine lines, material costs, and direct labor consumption
          </p>
        </div>
        <button
          onClick={() => setIsLogModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Record Production Batch
        </button>
      </div>

      {/* Production History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Batch Code / Date</th>
                <th className="px-6 py-3.5">Project / Product</th>
                <th className="px-6 py-3.5">Shift & Machine</th>
                <th className="px-6 py-3.5 text-right">Units Produced</th>
                <th className="px-6 py-3.5 text-right">Material Cost</th>
                <th className="px-6 py-3.5 text-right">Labor Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    Loading production records...
                  </td>
                </tr>
              ) : productionLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500">
                    No production runs recorded yet.
                  </td>
                </tr>
              ) : (
                productionLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sky-400 font-semibold">{log.batchCode || 'PROD-LOG'}</div>
                      <div className="text-xs text-slate-500">{formatDate(log.productionDate)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{log.project?.name}</div>
                      <div className="text-xs text-slate-400">{log.project?.productName} ({log.project?.client?.companyName})</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{log.productionShift || 'Standard'}</div>
                      <div className="text-xs text-slate-500">{log.machineLine || 'Line A'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {log.producedQty.toLocaleString()} units
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-medium">
                      {formatCurrency(log.recordedMaterialCost)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-300 font-medium">
                      {formatCurrency(log.labourCost)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Production Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        title="Record Manufacturing Batch"
        subtitle="Log completed unit output from the factory floor"
        maxWidth="lg"
      >
        <form onSubmit={handleLogProduction} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Project *</label>
            <select
              required
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} &bull; {p.name} ({p.productName})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Units Produced *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.producedQty}
                onChange={(e) => setFormData({ ...formData, producedQty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Production Date *</label>
              <input
                type="date"
                required
                value={formData.productionDate}
                onChange={(e) => setFormData({ ...formData, productionDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Shift</label>
              <input
                type="text"
                value={formData.productionShift}
                onChange={(e) => setFormData({ ...formData, productionShift: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Machine / Line</label>
              <input
                type="text"
                value={formData.machineLine}
                onChange={(e) => setFormData({ ...formData, machineLine: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Material Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.recordedMaterialCost}
                onChange={(e) => setFormData({ ...formData, recordedMaterialCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Labour Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={formData.labourCost}
                onChange={(e) => setFormData({ ...formData, labourCost: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsLogModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Record Batch Output
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

