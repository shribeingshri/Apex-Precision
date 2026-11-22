import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Payment, Invoice, Client } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import {
  CreditCard,
  Plus,
  Download,
  Printer,
  RotateCcw,
  Receipt,
  Building2,
  Percent,
  Landmark,
} from 'lucide-react';

export const Payments: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Payment | null>(null);
  const [reversingPayment, setReversingPayment] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    paymentType: 'INVOICE_PAYMENT' as 'INVOICE_PAYMENT' | 'ADVANCE_PAYMENT',
    invoiceId: '',
    clientId: '',
    amount: 100000,
    tdsAmount: 0,
    bankCharges: 0,
    lateFee: 0,
    earlyDiscount: 0,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'BANK_TRANSFER',
    transactionReference: 'NEFT-AXIS-99120',
    bankName: 'HDFC Corporate Bank',
    instrumentDate: new Date().toISOString().split('T')[0],
    notes: 'Direct client payment clearance',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [payList, invList, clientList] = await Promise.all([
        apiRequest<Payment[]>('/api/payments'),
        apiRequest<Invoice[]>('/api/invoices'),
        apiRequest<Client[]>('/api/clients'),
      ]);
      setPayments(payList);
      setClients(clientList);
      const pendingInvoices = invList.filter((inv) => Number(inv.outstandingBalance) > 0);
      setInvoices(pendingInvoices);
      if (pendingInvoices.length > 0 && !formData.invoiceId) {
        setFormData((prev) => ({
          ...prev,
          invoiceId: pendingInvoices[0].id,
          clientId: pendingInvoices[0].clientId,
          amount: Number(pendingInvoices[0].outstandingBalance),
        }));
      } else if (clientList.length > 0 && !formData.clientId) {
        setFormData((prev) => ({ ...prev, clientId: clientList[0].id }));
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

  // Live Add-On Net Cash Reconciliation
  const netCashRealized = Math.max(
    0,
    formData.amount -
      formData.tdsAmount -
      formData.earlyDiscount +
      formData.lateFee -
      formData.bankCharges
  );

  // Summary KPIs
  const completedPayments = payments.filter((p) => p.status !== 'REVERSED');
  const totalSettled = completedPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalNetCash = completedPayments.reduce(
    (s, p) => s + Number(p.netCashReceived ?? p.amount ?? 0),
    0
  );
  const totalTds = completedPayments.reduce((s, p) => s + Number(p.tdsAmount || 0), 0);
  const advanceCount = completedPayments.filter((p) => p.paymentType === 'ADVANCE_PAYMENT').length;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const idempotencyKey = 'PAY-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
      const payload = {
        ...formData,
        invoiceId: formData.paymentType === 'INVOICE_PAYMENT' ? formData.invoiceId : undefined,
        idempotencyKey,
      };
      await apiRequest('/api/payments', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Payment and add-ons successfully reconciled!');
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingPayment) return;
    try {
      await apiRequest(`/api/payments/${reversingPayment.id}/reverse`, {
        method: 'POST',
        body: JSON.stringify({ reason: reversalReason }),
      });
      setReversingPayment(null);
      setReversalReason('');
      fetchData();
      alert('Payment reversed and invoice balance restored.');
    } catch (err: any) {
      alert(err.message || 'Failed to reverse payment');
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
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Payments, Add-Ons &amp; Financial Reconciliation
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Atomic invoice allocations, TDS deductions, bank charges, late fees, advances &amp; reversals
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
            <Plus className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-slate-400">Gross Invoice Settled</div>
          <div className="text-xl font-bold text-white mt-1">{formatCurrency(totalSettled)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{completedPayments.length} completed entries</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-emerald-400">Net Bank Cash Realized</div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{formatCurrency(totalNetCash)}</div>
          <div className="text-[11px] text-slate-500 mt-1">After TDS, discounts &amp; bank fees</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-amber-400">Total TDS Deducted</div>
          <div className="text-xl font-bold text-amber-400 mt-1">{formatCurrency(totalTds)}</div>
          <div className="text-[11px] text-slate-500 mt-1">Statutory tax withheld by clients</div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="text-xs text-sky-400">Advance Payments</div>
          <div className="text-xl font-bold text-sky-400 mt-1">{advanceCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">Unallocated client retainers/advances</div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Payment # / Date</th>
                <th className="px-5 py-3.5">Client &amp; Allocation</th>
                <th className="px-5 py-3.5">Method &amp; Bank Ref</th>
                <th className="px-5 py-3.5 text-right">Applied / Add-Ons</th>
                <th className="px-5 py-3.5 text-right">Net Cash</th>
                <th className="px-5 py-3.5 text-center">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    Loading payments ledger...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No payments recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((pay) => {
                  const tds = Number(pay.tdsAmount || 0);
                  const bankFee = Number(pay.bankCharges || 0);
                  const late = Number(pay.lateFee || 0);
                  const disc = Number(pay.earlyDiscount || 0);
                  const hasAddons = tds > 0 || bankFee > 0 || late > 0 || disc > 0;

                  return (
                    <tr key={pay.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4">
                        <div className="font-mono text-emerald-400 font-semibold">
                          {pay.paymentNumber || pay.paymentCode}
                        </div>
                        <div className="text-xs text-slate-500">{formatDate(pay.paymentDate)}</div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{pay.client?.companyName}</div>
                        <div className="text-xs font-mono text-sky-400">
                          {pay.invoice?.invoiceNumber || 'ADVANCE / UNALLOCATED'}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-slate-200">
                          {pay.paymentMethod.replace('_', ' ')}
                          {pay.bankName ? ` (${pay.bankName})` : ''}
                        </div>
                        <div className="text-xs font-mono text-slate-400">{pay.transactionReference}</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="font-semibold text-white">{formatCurrency(pay.amount)}</div>
                        {hasAddons && (
                          <div className="text-[11px] text-slate-400 space-x-1.5 mt-0.5">
                            {tds > 0 && <span className="text-amber-400">TDS:-{formatCurrency(tds)}</span>}
                            {late > 0 && <span className="text-sky-400">Late:+{formatCurrency(late)}</span>}
                            {disc > 0 && <span className="text-purple-400">Disc:-{formatCurrency(disc)}</span>}
                            {bankFee > 0 && <span className="text-rose-400">Fee:-{formatCurrency(bankFee)}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-400">
                        {formatCurrency(pay.netCashReceived ?? pay.amount)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Badge variant={getStatusBadgeVariant(pay.status || 'COMPLETED')}>
                          {pay.status || 'COMPLETED'}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedReceipt(pay)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs flex items-center gap-1"
                            title="Printable Payment Voucher"
                          >
                            <Receipt className="w-3.5 h-3.5 text-sky-400" /> Voucher
                          </button>
                          {pay.status !== 'REVERSED' && (
                            <button
                              onClick={() => setReversingPayment(pay)}
                              className="p-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 rounded-lg text-xs"
                              title="Reverse / Refund Payment"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Payment Modal with Well-Defined Add-Ons */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Payment & Settlement Add-Ons"
        subtitle="Supports partial/full invoice settlement, advances, TDS, bank fees, and late surcharges"
        maxWidth="2xl"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          {/* Payment Type Selector */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentType: 'INVOICE_PAYMENT' })}
              className={`py-2 rounded-lg text-xs font-semibold transition ${
                formData.paymentType === 'INVOICE_PAYMENT'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Invoice Settlement
            </button>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, paymentType: 'ADVANCE_PAYMENT' })}
              className={`py-2 rounded-lg text-xs font-semibold transition ${
                formData.paymentType === 'ADVANCE_PAYMENT'
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Client Advance / Retainer
            </button>
          </div>

          {formData.paymentType === 'INVOICE_PAYMENT' ? (
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
                    clientId: inv?.clientId || formData.clientId,
                    amount: inv ? Number(inv.outstandingBalance) : formData.amount,
                  });
                }}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              >
                {invoices.length === 0 ? (
                  <option value="">No pending invoices available</option>
                ) : (
                  invoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} &bull; {inv.client?.companyName} (Outstanding:{' '}
                      {formatCurrency(inv.outstandingBalance)})
                    </option>
                  ))
                )}
              </select>
            </div>
          ) : (
            <div>
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
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Base Applied Amount (₹) *
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm font-semibold focus:border-sky-500 focus:outline-none"
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

          {/* Payment Add-Ons Section */}
          <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Payment Add-Ons &amp; Statutory Adjustments
              </span>
              <span className="text-[11px] text-slate-500">Decimal-Safe Reconciliation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-amber-400 mb-1">TDS Deducted (-₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tdsAmount}
                  onChange={(e) => setFormData({ ...formData, tdsAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-rose-400 mb-1">Bank Charges (-₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.bankCharges}
                  onChange={(e) => setFormData({ ...formData, bankCharges: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-sky-400 mb-1">Late Fee (+₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.lateFee}
                  onChange={(e) => setFormData({ ...formData, lateFee: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-purple-400 mb-1">Early Discount (-₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.earlyDiscount}
                  onChange={(e) => setFormData({ ...formData, earlyDiscount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-white"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Net Cash Realized in Bank:</span>
              <span className="text-base font-bold font-mono text-emerald-400">
                {formatCurrency(netCashRealized)}
              </span>
            </div>
          </div>

          {/* Method & Bank Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Bank / Gateway Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">UTR / Cheque Ref *</label>
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
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-sm font-semibold transition"
            >
              Post Payment &amp; Reconcile
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Payment Voucher Modal */}
      <Modal
        isOpen={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        title="Official Payment Receipt Voucher"
        subtitle="Audit-verified settlement breakdown"
        maxWidth="lg"
      >
        {selectedReceipt && (
          <div className="bg-white text-slate-900 p-6 rounded-xl space-y-4 text-xs">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="font-bold text-base">APEX PRECISION ENGINEERING LTD.</h3>
                <p className="text-slate-600">Official Inward Payment Receipt</p>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-sm">{selectedReceipt.paymentNumber}</div>
                <div className="text-slate-600">Date: {formatDate(selectedReceipt.paymentDate)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
              <div>
                <span className="text-slate-500">Received From:</span>{' '}
                <strong>{selectedReceipt.client?.companyName}</strong>
              </div>
              <div>
                <span className="text-slate-500">Allocation:</span>{' '}
                <strong className="font-mono">
                  {selectedReceipt.invoice?.invoiceNumber || 'Advance Credit'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">Payment Mode:</span>{' '}
                <span>{selectedReceipt.paymentMethod}</span>
              </div>
              <div>
                <span className="text-slate-500">Reference / Bank:</span>{' '}
                <span className="font-mono">
                  {selectedReceipt.transactionReference}{' '}
                  {selectedReceipt.bankName ? `(${selectedReceipt.bankName})` : ''}
                </span>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between">
                <span>Gross Applied Settlement:</span>
                <span className="font-mono font-semibold">{formatCurrency(selectedReceipt.amount)}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>Less: TDS Deducted:</span>
                <span className="font-mono">-{formatCurrency(selectedReceipt.tdsAmount || 0)}</span>
              </div>
              <div className="flex justify-between text-purple-700">
                <span>Less: Early Settlement Discount:</span>
                <span className="font-mono">-{formatCurrency(selectedReceipt.earlyDiscount || 0)}</span>
              </div>
              <div className="flex justify-between text-sky-700">
                <span>Add: Late Payment Surcharge:</span>
                <span className="font-mono">+{formatCurrency(selectedReceipt.lateFee || 0)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Less: Bank / Gateway Charges:</span>
                <span className="font-mono">-{formatCurrency(selectedReceipt.bankCharges || 0)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-700 pt-2 border-t">
                <span>Net Cash Realized:</span>
                <span className="font-mono">
                  {formatCurrency(selectedReceipt.netCashReceived ?? selectedReceipt.amount)}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Receipt
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Reverse Payment Modal */}
      <Modal
        isOpen={!!reversingPayment}
        onClose={() => setReversingPayment(null)}
        title="Reverse / Refund Payment"
        subtitle="Atomically reverses payment and restores invoice outstanding balance"
      >
        {reversingPayment && (
          <form onSubmit={handleReversePayment} className="space-y-4">
            <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-200">
              Reversing <strong>{reversingPayment.paymentNumber}</strong> for{' '}
              <strong>{formatCurrency(reversingPayment.amount)}</strong> will restore the invoice balance.
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Reversal / Cheque Bounce Reason *
              </label>
              <textarea
                required
                minLength={5}
                rows={2}
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="e.g. Cheque dishonored / duplicate client transfer"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReversingPayment(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm"
              >
                Confirm Reversal
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
