import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { Settings as SettingsIcon, Save, Building, ShieldCheck, DollarSign } from 'lucide-react';

export const Settings: React.FC = () => {
  const [formData, setFormData] = useState({
    companyName: 'Apex Precision Engineering Ltd.',
    companyAddress: 'Plot 45-B, Sector 58 Industrial Area, Faridabad, Haryana - 121004',
    gstin: '06AAACA9981K1Z2',
    cin: 'U29253HR2015PLC055102',
    companyEmail: 'accounts@apexprecision.com',
    companyPhone: '+91 129 4589000',
    baseCurrency: 'INR (₹)',
    defaultTaxRate: 18,
    defaultPaymentTerms: 'Net 15 Days',
  });
  const [isSaved, setIsSaved] = useState(false);

  const fetchSettings = async () => {
    try {
      const data = await apiRequest<any>('/api/settings');
      if (data && data.companyName) {
        setFormData(data);
      }
    } catch (err) {
      // use default state
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/settings', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      alert('System configuration successfully updated!');
    } catch (err: any) {
      alert(err.message || 'Failed to update settings');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">System Settings & Configuration</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          Enterprise company identity, tax compliance specifications, and regional financial defaults
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Identity */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Building className="w-4 h-4 text-sky-400" /> Manufacturing Company Identity
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Company Registered Name</label>
              <input
                type="text"
                required
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-400 mb-1">Registered Factory / Office Address</label>
              <textarea
                rows={2}
                required
                value={formData.companyAddress}
                onChange={(e) => setFormData({ ...formData, companyAddress: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Corporate GSTIN</label>
              <input
                type="text"
                required
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Corporate Identification (CIN)</label>
              <input
                type="text"
                value={formData.cin}
                onChange={(e) => setFormData({ ...formData, cin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm font-mono focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Accounts Email</label>
              <input
                type="email"
                required
                value={formData.companyEmail}
                onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Phone Line</label>
              <input
                type="text"
                required
                value={formData.companyPhone}
                onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Financial & Tax Defaults */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" /> Accounting & Currency Conventions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Display & Base Currency</label>
              <input
                type="text"
                disabled
                value={formData.baseCurrency}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-400 text-sm font-mono cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Default GST Rate (%)</label>
              <input
                type="number"
                min="0"
                value={formData.defaultTaxRate}
                onChange={(e) => setFormData({ ...formData, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Default Terms</label>
              <input
                type="text"
                value={formData.defaultPaymentTerms}
                onChange={(e) => setFormData({ ...formData, defaultPaymentTerms: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white text-sm focus:border-sky-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end gap-4 items-center">
          {isSaved && <span className="text-xs text-emerald-400 font-medium">Settings saved successfully!</span>}
          <button
            type="submit"
            className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-sky-500/20"
          >
            <Save className="w-4 h-4" /> Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

