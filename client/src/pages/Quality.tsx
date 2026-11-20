import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Project } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDate } from '../utils/format';
import { ShieldCheck, Plus, CheckCircle2, AlertOctagon, RotateCw, RefreshCw } from 'lucide-react';

export const Quality: React.FC = () => {
  const [inspections, setInspections] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    inspectedQty: 500,
    approvedQty: 480,
    rejectedQty: 10,
    reworkQty: 10,
    defectCategory: 'Dimensional Tolerance',
    notes: 'Visual and micrometer inspection passed',
    inspectionDate: new Date().toISOString().split('T')[0],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [qcList, projs] = await Promise.all([
        apiRequest<any[]>('/api/quality'),
        apiRequest<Project[]>('/api/projects'),
      ]);
      setInspections(qcList);
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

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();

    // Critical Mathematical Business Validation
    const sum = formData.approvedQty + formData.rejectedQty + formData.reworkQty;
    if (sum !== formData.inspectedQty) {
      alert(
        `Strict Reconciliation Rule Violation: Inspected Quantity (${formData.inspectedQty}) must exactly equal Approved (${formData.approvedQty}) + Rejected (${formData.rejectedQty}) + Rework (${formData.reworkQty}) = ${sum}`
      );
      return;
    }

    try {
      await apiRequest('/api/quality', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Quality inspection successfully recorded!');
    } catch (err: any) {
      alert(err.message || 'Failed to record inspection');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Quality Assurance & Inspections</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Strict quantity reconciliation: Inspected = Approved + Rejected + Rework
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" /> Record QC Inspection
        </button>
      </div>

      {/* QC Inspections Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">QC ID / Date</th>
                <th className="px-6 py-3.5">Project / Product</th>
                <th className="px-6 py-3.5 text-right">Inspected</th>
                <th className="px-6 py-3.5 text-right text-emerald-400">Approved</th>
                <th className="px-6 py-3.5 text-right text-rose-400">Rejected</th>
                <th className="px-6 py-3.5 text-right text-purple-400">Rework</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading QC inspection records...
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No QC inspections logged yet.
                  </td>
                </tr>
              ) : (
                inspections.map((qc) => (
                  <tr key={qc.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-emerald-400 font-semibold">{qc.inspectionCode || 'QC-PASS'}</div>
                      <div className="text-xs text-slate-500">{formatDate(qc.inspectionDate)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{qc.project?.name}</div>
                      <div className="text-xs text-slate-400">{qc.project?.productName}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {qc.inspectedQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400">
                      {qc.approvedQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-rose-400">
                      {qc.rejectedQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-purple-400">
                      {qc.reworkQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(qc.inspectionStatus)}>{qc.inspectionStatus}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QC Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Quality Control Inspection"
        subtitle="Mandatory rule: Inspected Qty must equal Approved + Rejected + Rework"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordInspection} className="space-y-4">
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
                  {p.projectCode} &bull; {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-300">Quantity Reconciliation Matrix</div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Inspected *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.inspectedQty}
                  onChange={(e) => setFormData({ ...formData, inspectedQty: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-white text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-emerald-400 mb-1">Approved *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.approvedQty}
                  onChange={(e) => setFormData({ ...formData, approvedQty: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-emerald-700/60 rounded text-emerald-400 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-rose-400 mb-1">Rejected</label>
                <input
                  type="number"
                  min="0"
                  value={formData.rejectedQty}
                  onChange={(e) => setFormData({ ...formData, rejectedQty: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-rose-700/60 rounded text-rose-400 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] text-purple-400 mb-1">Rework</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reworkQty}
                  onChange={(e) => setFormData({ ...formData, reworkQty: parseInt(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-purple-700/60 rounded text-purple-400 text-xs font-bold"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 flex justify-between pt-1">
              <span>Sum (Approved + Rejected + Rework):</span>
              <span
                className={`font-mono font-bold ${
                  formData.approvedQty + formData.rejectedQty + formData.reworkQty === formData.inspectedQty
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {formData.approvedQty + formData.rejectedQty + formData.reworkQty} / {formData.inspectedQty}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Defect Category</label>
              <input
                type="text"
                value={formData.defectCategory}
                onChange={(e) => setFormData({ ...formData, defectCategory: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Inspection Date *</label>
              <input
                type="date"
                required
                value={formData.inspectionDate}
                onChange={(e) => setFormData({ ...formData, inspectionDate: e.target.value })}
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
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Submit QC Verification
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
