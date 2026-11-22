import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { PayrollRecord, Employee } from '../types';
import { Badge, getStatusBadgeVariant } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { formatCurrency, formatDate } from '../utils/format';
import { Wallet, Plus, Download, Printer, User, AlertCircle, FileText } from 'lucide-react';

export const Payroll: React.FC = () => {
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    employeeId: '',
    payrollPeriod: '2026-03',
    basicSalary: 65000,
    allowances: 15000,
    bonus: 5000,
    overtime: 3500,
    deductions: 8500,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Bank Transfer (NEFT)',
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [records, emps] = await Promise.all([
        apiRequest<PayrollRecord[]>('/api/payroll'),
        apiRequest<Employee[]>('/api/employees'),
      ]);
      setPayrollRecords(records);
      setEmployees(emps);
      if (emps.length > 0 && !formData.employeeId) {
        setFormData((prev) => ({ ...prev, employeeId: emps[0].id }));
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

  const netSalary =
    formData.basicSalary +
    formData.allowances +
    formData.bonus +
    formData.overtime -
    formData.deductions;

  const handleProcessPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/payroll', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsModalOpen(false);
      fetchData();
      alert('Payroll record generated and posted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to process payroll');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/export/payroll', '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Confidential Payroll Management</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Role-protected salary disbursements, allowances, statutory deductions, and payslips
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
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <Plus className="w-4 h-4" /> Run Payroll Period
          </button>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-6 py-3.5">Employee / Code</th>
                <th className="px-6 py-3.5">Period</th>
                <th className="px-6 py-3.5 text-right">Basic</th>
                <th className="px-6 py-3.5 text-right">Allowances</th>
                <th className="px-6 py-3.5 text-right text-rose-400">Deductions</th>
                <th className="px-6 py-3.5 text-right text-emerald-400 font-bold">Net Salary</th>
                <th className="px-6 py-3.5 text-center">Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    Loading payroll records...
                  </td>
                </tr>
              ) : payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500">
                    No payroll entries processed yet.
                  </td>
                </tr>
              ) : (
                payrollRecords.map((pay) => (
                  <tr key={pay.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-white">{pay.employee?.name}</div>
                      <div className="text-xs font-mono text-sky-400">{pay.employee?.employeeCode}</div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-300">{pay.payrollPeriod}</td>
                    <td className="px-6 py-4 text-right text-slate-300">{formatCurrency(pay.basicSalary)}</td>
                    <td className="px-6 py-4 text-right text-slate-300">
                      {formatCurrency(Number(pay.allowances) + Number(pay.bonus) + Number(pay.overtime))}
                    </td>
                    <td className="px-6 py-4 text-right text-rose-400 font-medium">
                      -{formatCurrency(pay.deductions)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-400 text-base">
                      {formatCurrency(pay.netSalary)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge variant="success">PAID</Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedSlip(pay)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        <FileText className="w-3.5 h-3.5 text-sky-400" /> Payslip
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Process Payroll Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Run Employee Payroll"
        subtitle="Formula: Net = Basic + Allowances + Bonus + Overtime - Deductions"
        maxWidth="lg"
      >
        <form onSubmit={handleProcessPayroll} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Employee *</label>
            <select
              required
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employeeCode} &bull; {emp.designation})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Payroll Period (YYYY-MM) *</label>
              <input
                type="text"
                required
                placeholder="2026-03"
                value={formData.payrollPeriod}
                onChange={(e) => setFormData({ ...formData, payrollPeriod: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Disbursement Date *</label>
              <input
                type="date"
                required
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
            <div className="text-xs font-semibold text-slate-300">Salary Breakdown Breakdown (₹)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Basic Salary *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.basicSalary}
                  onChange={(e) => setFormData({ ...formData, basicSalary: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Allowances (HRA / DA)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.allowances}
                  onChange={(e) => setFormData({ ...formData, allowances: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Bonus & Incentives</label>
                <input
                  type="number"
                  min="0"
                  value={formData.bonus}
                  onChange={(e) => setFormData({ ...formData, bonus: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Overtime Pay</label>
                <input
                  type="number"
                  min="0"
                  value={formData.overtime}
                  onChange={(e) => setFormData({ ...formData, overtime: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] text-rose-400 mb-1">Statutory Deductions (PF / TDS / ESI) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.deductions}
                  onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-rose-800/80 rounded text-xs text-rose-300 font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-sm">
              <span className="text-slate-400 font-medium">Calculated Net Disbursement:</span>
              <span className="text-emerald-400 font-mono font-bold text-lg">{formatCurrency(netSalary)}</span>
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
              Post Payroll Disbursement
            </button>
          </div>
        </form>
      </Modal>

      {/* Salary Slip Modal */}
      <Modal
        isOpen={!!selectedSlip}
        onClose={() => setSelectedSlip(null)}
        title="Official Employee Payslip"
        subtitle="Confidential compensation statement"
        maxWidth="lg"
      >
        {selectedSlip && (
          <div className="space-y-6 bg-white text-slate-900 p-6 rounded-xl text-xs">
            <div className="flex justify-between items-start border-b pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">APEX PRECISION ENGINEERING LTD.</h3>
                <p className="text-slate-600">Plot 45-B, Sector 58 Industrial Area, Faridabad</p>
                <p className="font-semibold text-slate-800 mt-1">PAYSLIP FOR {selectedSlip.payrollPeriod}</p>
              </div>
              <div className="text-right">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold">PAID</span>
                <div className="text-slate-600 mt-1">Date: {formatDate(selectedSlip.paymentDate)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border p-3 rounded-lg bg-slate-50">
              <div>
                <span className="text-slate-500">Employee Name:</span>{' '}
                <strong className="text-slate-900">{selectedSlip.employee?.name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Employee Code:</span>{' '}
                <strong className="text-slate-900 font-mono">{selectedSlip.employee?.employeeCode}</strong>
              </div>
              <div>
                <span className="text-slate-500">Designation:</span>{' '}
                <span className="text-slate-800">{selectedSlip.employee?.designation}</span>
              </div>
              <div>
                <span className="text-slate-500">Payment Mode:</span>{' '}
                <span className="text-slate-800">{selectedSlip.paymentMethod}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border rounded-lg overflow-hidden">
              <div className="p-3 border-r space-y-1.5">
                <div className="font-bold uppercase text-slate-700 pb-1 border-b">Earnings (₹)</div>
                <div className="flex justify-between">
                  <span>Basic Salary:</span>
                  <span className="font-mono">{formatCurrency(selectedSlip.basicSalary)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Allowances:</span>
                  <span className="font-mono">{formatCurrency(selectedSlip.allowances)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Incentives/Bonus:</span>
                  <span className="font-mono">{formatCurrency(selectedSlip.bonus)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Overtime:</span>
                  <span className="font-mono">{formatCurrency(selectedSlip.overtime)}</span>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                <div className="font-bold uppercase text-slate-700 pb-1 border-b">Deductions (₹)</div>
                <div className="flex justify-between text-rose-600">
                  <span>PF / TDS / ESI:</span>
                  <span className="font-mono">-{formatCurrency(selectedSlip.deductions)}</span>
                </div>
              </div>
            </div>

            <div className="border-t pt-3 flex justify-between items-center text-sm font-bold text-slate-900">
              <span>NET SALARY DISBURSED:</span>
              <span className="text-emerald-700 font-mono text-base">{formatCurrency(selectedSlip.netSalary)}</span>
            </div>

            <div className="flex justify-end pt-3 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" /> Print Payslip
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

