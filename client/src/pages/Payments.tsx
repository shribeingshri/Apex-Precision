import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Payment, Invoice } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { CreditCard, Plus, Download, CheckCircle2, ShieldCheck, RefreshCw } from 'lucide-react';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    invoiceId: '',
    amount: 100000,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'NEFT-AXIS-99120',
    notes: 'Direct client payment clearance',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [payList, invList] = await Promise.all([
        apiRequest<Payment[]>('/api/payments'),
        apiRequest<Invoice[]>('/api/invoices'),
      ]);
      setPayments(payList);
      // Filter unpaid or partially paid invoices for the dropdown
      const pendingInvoices = invList.filter((inv) => Number(inv.outstandingBalance) > 0);
      setInvoices(pendingInvoices);
      if (pendingInvoices.length > 0 && !formData.invoiceId) {
        setFormData((prev) => ({
          ...prev,
          invoiceId: pendingInvoices[0].id,
          amount: Number(pendingInvoices[0].outstandingBalance),
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

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const idempotencyKey = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          idempotencyKey,
        }),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Payment successfully reconciled against invoice balance!');
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/export/payments', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Payments & Financial Reconciliation</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Atomic ledger allocation, duplicate prevention, and real-time receivables clearance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2"
          >
            <Download className="w-4 h-4 text-emerald-400" /> Export CSV
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" /> Record Inward Payment
          </button>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Payment ID / Date</th>
                <th className="px-6 py-3.5">Client & Invoice #</th>
                <th className="px-6 py-3.5">Method & Reference</th>
                <th className="px-6 py-3.5 text-right">Amount Credited</th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    Loading payments ledger...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-mono text-emerald-400 font-semibold">{pay.paymentCode}</div>
                      <div className="text-xs text-slate-500">{formatDate(pay.paymentDate)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{pay.client?.companyName}</div>
                      <div className="text-xs font-mono text-sky-400">{pay.invoice?.invoiceNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium text-slate-200">{pay.paymentMethod.replace('_', ' ')}</div>
                      <div className="text-xs font-mono text-slate-400">{pay.transactionReference}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400 text-base">
                      {formatCurrency(pay.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="success">CLEARED</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Inward Client Payment"
        subtitle="Credits client ledger and automatically deducts invoice outstanding balance"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Target Tax Invoice *</label>
            <select
              required
              value={formData.invoiceId}
              onChange={(e) => {
                const inv = invoices.find((i) => i.id === e.target.value);
                setFormData({
                  ...formData,
                  invoiceId: e.target.value,
                  amount: inv ? Number(inv.outstandingBalance) : formData.amount,
                });
              }}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            >
              {invoices.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.invoiceNumber} &bull; {inv.client?.companyName} (Outstanding: {formatCurrency(inv.outstandingBalance)})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Amount (₹) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Date *</label>
              <input
                type="date"
                required
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payment Mode</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
                <option value="UPI">UPI Transfer</option>
                <option value="CHEQUE">Cheque Clearance</option>
                <option value="CASH">Cash Deposit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Transaction Ref / UTR *</label>
              <input
                type="text"
                required
                value={formData.transactionReference}
                onChange={(e) => setFormData({ ...formData, transactionReference: e.target.value })}
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
              Post Payment Entry
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
