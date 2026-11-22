import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Invoice, Project, Client } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import {
  FileText,
  Plus,
  Printer,
  Download,
  CreditCard,
  Building2,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const Billing: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    clientId: '',
    projectId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    taxRate: 18,
    discountAmount: 0,
    paymentTerms: 'Net 15 Days',
    notes: 'Payment via NEFT/RTGS to Apex Precision Account',
    lineItems: [
      {
        description: 'Milled CNC Aluminum Flanges X-20',
        quantity: 1000,
        unitPrice: 150,
      },
    ],
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [invList, projs, cls] = await Promise.all([
        apiRequest<Invoice[]>('/api/invoices'),
        apiRequest<Project[]>('/api/projects'),
        apiRequest<Client[]>('/api/clients'),
      ]);
      setInvoices(invList);
      setProjects(projs);
      setClients(cls);
      if (cls.length > 0 && !formData.clientId) {
        setFormData((prev) => ({
          ...prev,
          clientId: cls[0].id,
          projectId: projs[0]?.id || '',
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

  const handleAddLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      lineItems: [
        ...prev.lineItems,
        { description: 'Component Machining / Finishing', quantity: 500, unitPrice: 50 },
      ],
    }));
  };

  const handleRemoveLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      lineItems: prev.lineItems.filter((_, i) => i !== index),
    }));
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.lineItems];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, lineItems: updated };
    });
  };

  // Live Math calculations
  const subtotal = formData.lineItems.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );
  const taxable = Math.max(0, subtotal - formData.discountAmount);
  const tax = taxable * (formData.taxRate / 100);
  const grandTotal = taxable + tax;

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.lineItems.length === 0) {
      alert('Please add at least one line item');
      return;
    }

    try {
      await apiRequest('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsCreateModalOpen(false);
      fetchData();
      alert('Tax Invoice successfully generated and issued!');
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/export/invoices', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Billing & Tax Invoices</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Decimal-safe invoicing, multi-item breakdown, GST calculation, and receivable tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-sky-400" /> Export CSV
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" /> Create Tax Invoice
          </button>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Invoice # / Date</th>
                <th className="px-6 py-3.5">Client & GSTIN</th>
                <th className="px-6 py-3.5 text-right">Total Amount</th>
                <th className="px-6 py-3.5 text-right">Received</th>
                <th className="px-6 py-3.5 text-right">Outstanding</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading invoices...
                  </td>
                </tr>
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No invoices generated yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-sky-400 font-semibold">{inv.invoiceNumber}</div>
                      <div className="text-xs text-slate-500">Due: {formatDate(inv.dueDate)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{inv.client.companyName}</div>
                      <div className="text-xs font-mono text-slate-400">{inv.client.gstin || 'No GSTIN'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-400">
                      {formatCurrency(inv.amountReceived)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-amber-400">
                      {formatCurrency(inv.outstandingBalance)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant={getStatusBadgeVariant(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        <Printer className="w-3.5 h-3.5 text-sky-400" /> Printable View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Tax Invoice"
        subtitle="Itemized bill with automated GST and decimal-safe balance"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <label className="block text-xs font-semibold text-slate-400 mb-1">Related Project</label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="">No Direct Project Link</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectCode} &bull; {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Invoice Date *</label>
              <input
                type="date"
                required
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Due Date *</label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">GST Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Line Items Section */}
          <div className="border border-slate-800 rounded-xl p-3 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Itemized Breakdown</span>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Line
              </button>
            </div>

            {formData.lineItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Item Description"
                  required
                  value={item.description}
                  onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                />
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Qty"
                  value={item.quantity}
                  onChange={(e) => handleLineItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                  className="w-20 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white text-right"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Rate"
                  value={item.unitPrice}
                  onChange={(e) => handleLineItemChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-24 px-2 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white text-right"
                />
                <div className="w-24 text-xs font-mono font-medium text-right text-slate-200">
                  {formatCurrency(item.quantity * item.unitPrice)}
                </div>
                {formData.lineItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            {/* Calculations Summary */}
            <div className="pt-2 border-t border-slate-800 space-y-1 text-xs text-right">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-white">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Applicable GST ({formData.taxRate}%):</span>
                <span className="font-mono text-white">{formatCurrency(tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-emerald-400 pt-1 border-t border-slate-800/60">
                <span>Total Invoice Value:</span>
                <span className="font-mono">{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
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
              Issue Tax Invoice
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Invoice Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Official Tax Invoice Document"
        subtitle="Ready for print & client PDF dispatch"
        maxWidth="2xl"
      >
        {selectedInvoice && (
          <div className="space-y-6 text-slate-900 bg-white p-8 rounded-xl" id="printable-area">
            {/* Corporate Header */}
            <div className="flex justify-between items-start border-b pb-6">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-900">APEX PRECISION ENGINEERING LTD.</h2>
                <p className="text-xs text-slate-600 mt-1">Plot 45-B, Sector 58 Industrial Area, Faridabad, Haryana - 121004</p>
                <p className="text-xs text-slate-600">GSTIN: 06AAACA9981K1Z2 &bull; CIN: U29253HR2015PLC055102</p>
                <p className="text-xs text-slate-600">Email: accounts@apexprecision.com &bull; Phone: +91 129 4589000</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 rounded font-bold text-xs uppercase">
                  ORIGINAL FOR RECIPIENT
                </span>
                <h3 className="text-lg font-mono font-bold text-slate-900 mt-2">{selectedInvoice.invoiceNumber}</h3>
                <div className="text-xs text-slate-600">Date: {formatDate(selectedInvoice.invoiceDate)}</div>
                <div className="text-xs text-slate-600">Due: {formatDate(selectedInvoice.dueDate)}</div>
              </div>
            </div>

            {/* Billed To */}
            <div className="border p-4 rounded-lg bg-slate-50 text-xs">
              <span className="font-bold uppercase text-slate-700">Billed To (Client Details):</span>
              <div className="text-sm font-bold text-slate-900 mt-1">{selectedInvoice.client.companyName}</div>
              <div className="text-slate-600">{selectedInvoice.client.address || 'Registered Client Office'}</div>
              <div className="text-slate-700 font-mono mt-1 font-semibold">
                Client GSTIN: {selectedInvoice.client.gstin || 'Unregistered'}
              </div>
            </div>

            {/* Line Items Table */}
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 border-y font-bold text-slate-700 uppercase">
                <tr>
                  <th className="py-2 px-3">#</th>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Rate</th>
                  <th className="py-2 px-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800">
                {selectedInvoice.lineItems?.map((item, idx) => (
                  <tr key={item.id || idx}>
                    <td className="py-2.5 px-3 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium">{item.description}</td>
                    <td className="py-2.5 px-3 text-right">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary */}
            <div className="border-t pt-4 flex justify-end">
              <div className="w-64 space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Tax ({Number(selectedInvoice.taxRate)}%):</span>
                  <span className="font-semibold">{formatCurrency(selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t">
                  <span>Grand Total:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-700 pt-1">
                  <span>Amount Received:</span>
                  <span className="font-mono font-semibold">{formatCurrency(selectedInvoice.amountReceived)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-amber-700 pt-1 border-t">
                  <span>Balance Outstanding:</span>
                  <span className="font-mono">{formatCurrency(selectedInvoice.outstandingBalance)}</span>
                </div>
              </div>
            </div>

            {/* Print Button */}
            <div className="flex justify-end gap-3 pt-4 border-t print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Document
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

