import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Project } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatDate } from '../utils/format';
import { Truck, Plus, CheckCircle2, Clock, MapPin, AlertCircle, RefreshCw } from 'lucide-react';

export const Delivery: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    projectId: '',
    deliveryQty: 500,
    deliveryAddress: 'Sector 62, Industrial Area, Noida, UP',
    dispatchDate: new Date().toISOString().split('T')[0],
    expectedArrivalDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    transportReference: 'TRK-IND-99201',
    vehicleDetails: 'Eicher Pro 3019 (DL-1AA-8902)',
    notes: 'Fragile precision components - keep dry',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [delList, projs] = await Promise.all([
        apiRequest<any[]>('/api/delivery'),
        apiRequest<Project[]>('/api/projects'),
      ]);
      setDeliveries(delList);
      setProjects(projs);
      if (projs.length > 0 && !formData.projectId) {
        setFormData((prev) => ({
          ...prev,
          projectId: projs[0].id,
          deliveryAddress: projs[0].client?.companyName ? `${projs[0].client.companyName} Receiving Warehouse` : prev.deliveryAddress,
        }));
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

  const handleCreateDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/delivery', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Delivery manifest successfully created & dispatched!');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch delivery');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await apiRequest(`/api/delivery/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          deliveryStatus: newStatus,
          actualDeliveryDate: newStatus === 'DELIVERED' ? new Date().toISOString() : undefined,
          proofOfDelivery: newStatus === 'DELIVERED' ? 'Signed Delivery Challan #POD-7712' : undefined,
        }),
      });
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Failed to update delivery status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Delivery & Logistics Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Strict dispatch validation: Deliveries cannot exceed quality-approved inventory
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
        >
          <Plus className="w-4 h-4" /> Dispatch Shipment
        </button>
      </div>

      {/* Deliveries Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Delivery ID / Tracking</th>
                <th className="px-6 py-3.5">Client / Project</th>
                <th className="px-6 py-3.5 text-right">Quantity</th>
                <th className="px-6 py-3.5">Destination</th>
                <th className="px-6 py-3.5">Dates</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading delivery manifests...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No delivery shipments logged yet.
                  </td>
                </tr>
              ) : (
                deliveries.map((del) => (
                  <tr key={del.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sky-400 font-semibold">{del.deliveryCode}</div>
                      <div className="text-xs text-slate-400">{del.transportReference || 'No AWB'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{del.client?.companyName}</div>
                      <div className="text-xs text-slate-400">{del.project?.productName}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {del.deliveryQty.toLocaleString()} units
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs max-w-xs truncate text-slate-300 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        {del.deliveryAddress}
                      </div>
                      <div className="text-[11px] text-slate-500">{del.vehicleDetails}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div>Dispatch: {formatDate(del.dispatchDate)}</div>
                      <div className="text-slate-500">ETA: {formatDate(del.expectedArrivalDate)}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(del.deliveryStatus)}>{del.deliveryStatus}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {del.deliveryStatus !== 'DELIVERED' && del.deliveryStatus !== 'CANCELLED' && (
                        <select
                          value={del.deliveryStatus}
                          onChange={(e) => handleUpdateStatus(del.id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-xs text-slate-300 rounded px-2 py-1 focus:outline-none"
                        >
                          <option value="READY_FOR_DISPATCH">Ready</option>
                          <option value="DISPATCHED">Dispatched</option>
                          <option value="IN_TRANSIT">In Transit</option>
                          <option value="DELIVERED">Mark Delivered</option>
                          <option value="DELAYED">Delayed</option>
                        </select>
                      )}
                      {del.deliveryStatus === 'DELIVERED' && (
                        <span className="text-xs text-emerald-400 flex items-center justify-end gap-1 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
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

      {/* Dispatch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Dispatch Delivery Shipment"
        subtitle="Validate available quality-approved inventory before carrier handover"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateDelivery} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Project *</label>
            <select
              required
              value={formData.projectId}
              onChange={(e) => {
                const p = projects.find((proj) => proj.id === e.target.value);
                setFormData({
                  ...formData,
                  projectId: e.target.value,
                  deliveryAddress: p?.client ? `${p.client.companyName} Receiving Warehouse` : formData.deliveryAddress,
                });
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.projectCode} &bull; {p.name} (Approved Qty: {p.stats?.approvedQty || 0})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dispatch Quantity *</label>
              <input
                type="number"
                min="1"
                required
                value={formData.deliveryQty}
                onChange={(e) => setFormData({ ...formData, deliveryQty: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Dispatch Date *</label>
              <input
                type="date"
                required
                value={formData.dispatchDate}
                onChange={(e) => setFormData({ ...formData, dispatchDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Delivery Destination Address *</label>
            <textarea
              required
              rows={2}
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Transport / AWB Reference *</label>
              <input
                type="text"
                required
                value={formData.transportReference}
                onChange={(e) => setFormData({ ...formData, transportReference: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Vehicle / Carrier Details</label>
              <input
                type="text"
                value={formData.vehicleDetails}
                onChange={(e) => setFormData({ ...formData, vehicleDetails: e.target.value })}
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
              Generate Dispatch Manifest
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
