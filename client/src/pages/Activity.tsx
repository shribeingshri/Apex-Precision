import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { ActivityLog } from '../types';
import { formatDateTime } from '../utils/format';
import { History, RefreshCw, Filter, Shield, User } from 'lucide-react';

export const Activity: React.FC = () => {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState('');

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      let query = '';
      if (entityFilter) query += `entityType=${entityFilter}`;
      const data = await apiRequest<ActivityLog[]>(`/api/activity?${query}`);
      setActivities(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [entityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System-Wide Audit & Activity Stream</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Immutable chronological ledger capturing every business mutation, transaction, and state transition
          </p>
        </div>
        <button
          onClick={fetchActivities}
          className="px-3.5 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-sm transition flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-sky-400" /> Refresh Stream
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <Filter className="w-4 h-4 text-slate-500" />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 text-xs focus:outline-none focus:border-sky-500"
        >
          <option value="">All Business Entities</option>
          <option value="Lead">Lead</option>
          <option value="Client">Client</option>
          <option value="Project">Project</option>
          <option value="ProductionRecord">Production</option>
          <option value="QualityInspection">Quality Inspection</option>
          <option value="Delivery">Delivery Dispatch</option>
          <option value="Invoice">Invoice</option>
          <option value="Payment">Payment</option>
          <option value="Expense">Expense</option>
          <option value="PayrollRecord">Payroll</option>
        </select>
      </div>

      {/* Activity Timeline List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="space-y-6">
          {isLoading ? (
            <div className="py-20 text-center text-slate-500">Loading audit trail...</div>
          ) : activities.length === 0 ? (
            <div className="py-20 text-center text-slate-500">No activity entries recorded for this filter.</div>
          ) : (
            activities.map((act) => (
              <div key={act.id} className="relative flex gap-4 items-start group">
                {/* Dot */}
                <div className="w-3 h-3 rounded-full bg-sky-500 ring-4 ring-slate-900 mt-1.5 flex-shrink-0" />
                <div className="flex-1 pb-6 border-b border-slate-800/80 last:border-b-0 space-y-1">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">{act.user?.fullName || 'System Core'}</span>
                      <span className="text-slate-500">&bull;</span>
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                        {act.entityType}
                      </span>
                      <span className="text-sky-400 font-semibold">{act.action}</span>
                    </div>
                    <span className="text-slate-500 font-mono text-[11px]">{formatDateTime(act.timestamp)}</span>
                  </div>

                  <p className="text-sm text-slate-300 mt-1">{act.details}</p>

                  <div className="text-[11px] text-slate-500 font-mono">
                    Entity ID: {act.entityId} &bull; Actor: {act.user?.email || 'SYSTEM'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
