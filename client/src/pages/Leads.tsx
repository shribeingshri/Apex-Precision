import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Lead } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Plus, Search, Filter, UserCheck, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';

export const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);

  // New Lead Form State
  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    industry: '',
    productRequirement: '',
    expectedQty: 1000,
    estimatedValue: 100000,
    leadSource: 'Direct Enquiry',
    notes: '',
  });

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      let query = '';
      if (statusFilter) query += `status=${statusFilter}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      const data = await apiRequest<Lead[]>(`/api/leads?${query}`);
      setLeads(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/leads', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsCreateModalOpen(false);
      setFormData({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        industry: '',
        productRequirement: '',
        expectedQty: 1000,
        estimatedValue: 100000,
        leadSource: 'Direct Enquiry',
        notes: '',
      });
      fetchLeads();
    } catch (err: any) {
      alert(err.message || 'Failed to create lead');
    }
  };

  const handleConvertLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertingLead) return;
    try {
      await apiRequest(`/api/leads/${convertingLead.id}/convert`, {
        method: 'POST',
        body: JSON.stringify({
          address: convertingLead.address || 'Industrial Area Phase 2, Sector 58',
          industry: convertingLead.industry || 'Manufacturing',
        }),
      });
      setConvertingLead(null);
      fetchLeads();
      alert('Lead successfully converted to Client!');
    } catch (err: any) {
      alert(err.message || 'Failed to convert lead');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Lead Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Capture, qualify, and convert potential manufacturing opportunities
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" /> New Lead
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search leads by company, contact or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLeads()}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-sm focus:outline-none focus:border-sky-500"
        >
          <option value="">All Statuses</option>
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="PROPOSAL_SENT">Proposal Sent</option>
          <option value="NEGOTIATION">Negotiation</option>
          <option value="CONVERTED">Converted</option>
          <option value="LOST">Lost</option>
        </select>
        <button
          onClick={fetchLeads}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-sm transition"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" />
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Lead Code / Company</th>
                <th className="px-6 py-3.5">Contact Person</th>
                <th className="px-6 py-3.5">Requirement</th>
                <th className="px-6 py-3.5 text-right">Est. Quantity</th>
                <th className="px-6 py-3.5 text-right">Est. Value</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading leads records...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No leads found matching current criteria.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{lead.companyName}</div>
                      <div className="text-xs text-sky-400 font-mono">{lead.leadCode}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div>{lead.contactPerson}</div>
                      <div className="text-xs text-slate-500">{lead.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs truncate">{lead.productRequirement}</div>
                      <div className="text-xs text-slate-500">{lead.industry || 'General'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">
                      {lead.expectedQty.toLocaleString()} units
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-400">
                      {formatCurrency(lead.estimatedValue)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(lead.status)}>{lead.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {lead.status !== 'CONVERTED' ? (
                        <button
                          onClick={() => setConvertingLead(lead)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-medium transition"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Convert to Client
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 flex items-center justify-end gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Converted
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Lead Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Manufacturing Lead"
        subtitle="Capture new sales opportunity specifications"
        maxWidth="xl"
      >
        <form onSubmit={handleCreateLead} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Company Name *</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Contact Person *</label>
              <input
                type="text"
                required
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Phone *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Product / Requirement Specifications *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 5,000 Precision CNC Milled Titanium Flanges"
                value={formData.productRequirement}
                onChange={(e) => setFormData({ ...formData, productRequirement: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Expected Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.expectedQty}
                onChange={(e) => setFormData({ ...formData, expectedQty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Estimated Deal Value (₹) *</label>
              <input
                type="number"
                min="0"
                required
                value={formData.estimatedValue}
                onChange={(e) => setFormData({ ...formData, estimatedValue: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Save Lead
            </button>
          </div>
        </form>
      </Modal>

      {/* Convert Lead Modal */}
      <Modal
        isOpen={!!convertingLead}
        onClose={() => setConvertingLead(null)}
        title="Convert Lead to Client Account"
        subtitle="Promote verified sales lead to official client directory"
      >
        {convertingLead && (
          <form onSubmit={handleConvertLead} className="space-y-4">
            <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs text-slate-400">Company: <span className="font-semibold text-white">{convertingLead.companyName}</span></div>
              <div className="text-xs text-slate-400">Contact: <span className="text-slate-200">{convertingLead.contactPerson} ({convertingLead.email})</span></div>
              <div className="text-xs text-slate-400">Est. Order: <span className="text-emerald-400 font-medium">{convertingLead.expectedQty.toLocaleString()} units ({formatCurrency(convertingLead.estimatedValue)})</span></div>
            </div>

            <p className="text-xs text-slate-400">
              Converting will create an active Client profile with an auto-generated client code (e.g. CLT-...) and link all future manufacturing projects and invoices to this account.
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConvertingLead(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-sm font-semibold transition flex items-center gap-2"
              >
                Confirm Conversion <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

