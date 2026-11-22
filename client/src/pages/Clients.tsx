import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Client } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Plus, Search, Archive, RotateCcw, Building2, Phone, Mail, FileText, Briefcase } from 'lucide-react';

export const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    companyName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    gstin: '',
    industry: 'Automotive & Aerospace',
  });

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      let query = `includeArchived=${includeArchived}&`;
      if (search) query += `search=${encodeURIComponent(search)}&`;
      const data = await apiRequest<Client[]>(`/api/clients?${query}`);
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [includeArchived]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/clients', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsAddModalOpen(false);
      setFormData({
        companyName: '',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        gstin: '',
        industry: 'Automotive & Aerospace',
      });
      fetchClients();
    } catch (err: any) {
      alert(err.message || 'Failed to add client');
    }
  };

  const handleToggleArchive = async (client: Client) => {
    const action = client.isArchived ? 'restore' : 'archive';
    if (!confirm(`Are you sure you want to ${action} ${client.companyName}?`)) return;

    try {
      await apiRequest(`/api/clients/${client.id}/${action}`, { method: 'POST' });
      fetchClients();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} client`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Client Directory</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Accounts, manufacturing client profiles, GSTIN details, and billing ledgers
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Add Client
        </button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by company, client code or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchClients()}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer self-start sm:self-center">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0"
          />
          Show Archived Clients
        </label>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            Loading client records...
          </div>
        ) : clients.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-500">
            No clients found.
          </div>
        ) : (
          clients.map((client) => (
            <div
              key={client.id}
              className={`p-5 rounded-2xl border transition ${
                client.isArchived
                  ? 'bg-slate-950/40 border-slate-800/50 opacity-60'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700 shadow-sm'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono text-sky-400 font-semibold">{client.clientCode}</span>
                  <h3 className="text-base font-bold text-white mt-0.5">{client.companyName}</h3>
                  <div className="text-xs text-slate-400">{client.industry || 'Manufacturing'}</div>
                </div>
                <Badge variant={client.isArchived ? 'danger' : 'success'}>
                  {client.isArchived ? 'ARCHIVED' : client.status}
                </Badge>
              </div>

              {client.gstin && (
                <div className="mt-3 inline-block px-2 py-0.5 bg-slate-800/80 rounded text-[11px] font-mono text-slate-300">
                  GSTIN: {client.gstin}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{client.contactPerson}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">{client.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{client.phone}</span>
                </div>
              </div>

              {/* Financial Balance & Projects Summary */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <div>
                  <span className="text-slate-500">Outstanding:</span>{' '}
                  <span className="font-semibold text-amber-400">
                    {formatCurrency(client.financialSummary?.outstandingBalance || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                  <span>{client._count?.projects || 0} Projects</span>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-end">
                <button
                  onClick={() => handleToggleArchive(client)}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
                >
                  {client.isArchived ? (
                    <>
                      <RotateCcw className="w-3 h-3 text-emerald-400" /> Restore Client
                    </>
                  ) : (
                    <>
                      <Archive className="w-3 h-3 text-rose-400" /> Archive
                    </>
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Manufacturing Client"
        subtitle="Onboard enterprise manufacturing account"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
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
          <div className="grid grid-cols-2 gap-3">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1">GSTIN Number</label>
              <input
                type="text"
                placeholder="29AAAAA0000A1Z5"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
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
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Registered Address *</label>
            <textarea
              required
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
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
              Save Client Profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

