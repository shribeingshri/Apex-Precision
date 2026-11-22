import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Project, Client } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Plus, Search, Filter, Factory, ShieldCheck, Truck, RefreshCw } from 'lucide-react';

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Add Project Form
  const [formData, setFormData] = useState({
    clientId: '',
    name: '',
    productName: '',
    productDescription: '',
    specifications: '',
    orderedQty: 5000,
    uom: 'PCS',
    unitSellingPrice: 150,
    startDate: new Date().toISOString().split('T')[0],
    expectedCompletionDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    priority: 'MEDIUM' as const,
  });

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      let query = '';
      if (statusFilter) query += `status=${statusFilter}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      const data = await apiRequest<Project[]>(`/api/projects?${query}`);
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const data = await apiRequest<Client[]>('/api/clients');
      setClients(data);
      if (data.length > 0 && !formData.clientId) {
        setFormData((prev) => ({ ...prev, clientId: data[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, [statusFilter]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/projects', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsAddModalOpen(false);
      setFormData({
        clientId: clients[0]?.id || '',
        name: '',
        productName: '',
        productDescription: '',
        specifications: '',
        orderedQty: 5000,
        uom: 'PCS',
        unitSellingPrice: 150,
        startDate: new Date().toISOString().split('T')[0],
        expectedCompletionDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        priority: 'MEDIUM',
      });
      fetchProjects();
    } catch (err: any) {
      alert(err.message || 'Failed to create project');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Manufacturing Orders & Projects</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Production batches, engineering specifications, unit order metrics, and progress tracking
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> New Manufacturing Project
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by project code, product or client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchProjects()}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="">All Statuses</option>
          <option value="PLANNING">Planning</option>
          <option value="APPROVED">Approved</option>
          <option value="IN_PRODUCTION">In Production</option>
          <option value="QUALITY_INSPECTION">Quality Inspection</option>
          <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
          <option value="PARTIALLY_DELIVERED">Partially Delivered</option>
          <option value="COMPLETED">Completed</option>
        </select>
        <button
          onClick={fetchProjects}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-sm transition"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" />
        </button>
      </div>

      {/* Projects List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            Loading manufacturing projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl">
            No manufacturing projects found.
          </div>
        ) : (
          projects.map((proj) => {
            const stats = proj.stats || {
              producedQty: 0,
              approvedQty: 0,
              deliveredQty: 0,
              remainingDeliveryQty: proj.orderedQty,
              productionProgress: 0,
              deliveryProgress: 0,
            };

            return (
              <div
                key={proj.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-sky-400">{proj.projectCode}</span>
                      <Badge variant={getStatusBadgeVariant(proj.status)}>{proj.status}</Badge>
                      <Badge variant={proj.priority === 'URGENT' || proj.priority === 'HIGH' ? 'danger' : 'default'}>
                        {proj.priority}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-bold text-white mt-1">{proj.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Client: <span className="text-slate-200 font-medium">{proj.client.companyName}</span> &bull; Product: <span className="text-slate-200 font-medium">{proj.productName}</span>
                    </div>
                  </div>
                  <div className="text-right sm:self-center">
                    <div className="text-sm font-semibold text-emerald-400">
                      {formatCurrency(proj.estimatedValue)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {proj.orderedQty.toLocaleString()} {proj.uom} @ {formatCurrency(proj.unitSellingPrice)}/ea
                    </div>
                  </div>
                </div>

                {/* Progress Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Production Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Factory className="w-3.5 h-3.5 text-sky-400" /> Production Progress
                      </span>
                      <span className="font-semibold text-sky-400">
                        {stats.producedQty.toLocaleString()} / {proj.orderedQty.toLocaleString()} ({stats.productionProgress}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(stats.productionProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Delivery Progress */}
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-emerald-400" /> Delivery Fulfillment
                      </span>
                      <span className="font-semibold text-emerald-400">
                        {stats.deliveredQty.toLocaleString()} / {proj.orderedQty.toLocaleString()} ({stats.deliveryProgress}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(stats.deliveryProgress, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Key Metrics Footnote */}
                <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      QC Approved: <strong className="text-white">{stats.approvedQty.toLocaleString()}</strong>
                    </span>
                    <span>
                      Pending Delivery: <strong className="text-amber-400">{stats.remainingDeliveryQty.toLocaleString()}</strong>
                    </span>
                  </div>
                  <div>
                    Target Delivery: <span className="text-slate-300">{formatDate(proj.expectedCompletionDate)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* New Project Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Manufacturing Project"
        subtitle="Initialize production specifications & order volume"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Select Client *</label>
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Project Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Batch 2026-Q1 Titan Flanges"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Product Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Milled Flange X-20"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Unit of Measure (UOM)</label>
              <input
                type="text"
                value={formData.uom}
                onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Ordered Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.orderedQty}
                onChange={(e) => setFormData({ ...formData, orderedQty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Selling Price (₹) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={formData.unitSellingPrice}
                onChange={(e) => setFormData({ ...formData, unitSellingPrice: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Target Completion Date *</label>
              <input
                type="date"
                required
                value={formData.expectedCompletionDate}
                onChange={(e) => setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
              <select
                value={formData.priority}
                onChange={(e: any) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Initialize Project
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

