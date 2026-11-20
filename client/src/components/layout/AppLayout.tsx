import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Target,
  Users,
  Briefcase,
  Truck,
  MessageSquare,
  FileText,
  CreditCard,
  Receipt,
  Wallet,
  Clock,
  Factory,
  ShieldCheck,
  CheckSquare,
  Mail,
  History,
  BarChart3,
  UserCheck,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  PlusCircle,
  Menu,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    navigate(`/projects?search=${encodeURIComponent(searchQuery)}`);
  };

  const navSections = [
    {
      group: 'WORKSPACE',
      items: [
        { label: 'Overview', path: '/', icon: LayoutDashboard },
        { label: 'Leads', path: '/leads', icon: Target },
        { label: 'Clients', path: '/clients', icon: Users },
        { label: 'Projects', path: '/projects', icon: Briefcase },
      ],
    },
    {
      group: 'DELIVERY',
      items: [
        { label: 'Delivery Management', path: '/delivery', icon: Truck },
        { label: 'Messages', path: '/messages', icon: MessageSquare },
      ],
    },
    {
      group: 'FINANCE',
      items: [
        { label: 'Billing & Invoices', path: '/billing', icon: FileText },
        { label: 'Payments', path: '/payments', icon: CreditCard },
        { label: 'Expenses', path: '/expenses', icon: Receipt },
        { label: 'Payroll', path: '/payroll', icon: Wallet, restricted: !['SUPER_ADMIN', 'MANAGEMENT', 'FINANCE_MANAGER'].includes(user?.role || '') },
        { label: 'Retainers', path: '/retainers', icon: Clock },
      ],
    },
    {
      group: 'OPERATIONS',
      items: [
        { label: 'Manufacturing', path: '/manufacturing', icon: Factory },
        { label: 'Quality Control', path: '/quality', icon: ShieldCheck },
        { label: 'Employees & Tasks', path: '/tasks', icon: CheckSquare },
        { label: 'Email Logs', path: '/email-logs', icon: Mail },
        { label: 'Activity Stream', path: '/activity', icon: History },
        { label: 'Reports & Analytics', path: '/reports', icon: BarChart3 },
      ],
    },
    {
      group: 'ADMINISTRATION',
      items: [
        { label: 'Team & RBAC', path: '/employees', icon: UserCheck },
        { label: 'System Settings', path: '/settings', icon: Settings, restricted: !['SUPER_ADMIN', 'MANAGEMENT'].includes(user?.role || '') },
      ],
    },
  ];

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Desktop */}
      <aside
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 z-30 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center font-bold text-white shadow-lg shadow-sky-500/20 flex-shrink-0">
              AP
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight text-white leading-tight">
                  Apex Precision
                </span>
                <span className="text-[10px] text-sky-400 uppercase tracking-widest font-semibold">
                  Manufacturing ERP
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition"
            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((sec) => (
            <div key={sec.group}>
              {!collapsed && (
                <div className="px-3 mb-2 text-[11px] font-bold text-slate-400 tracking-wider">
                  {sec.group}
                </div>
              )}
              <div className="space-y-1">
                {sec.items
                  .filter((item) => !item.restricted)
                  .map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.path === '/'}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          isActive
                            ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                        }`
                      }
                      title={collapsed ? item.label : undefined}
                    >
                      <item.icon size={18} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </NavLink>
                  ))}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-sky-400 flex-shrink-0">
                {user?.fullName.charAt(0)}
              </div>
              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-white truncate">{user?.fullName}</span>
                  <span className="text-[10px] text-slate-400 truncate">{user?.role.replace('_', ' ')}</span>
                </div>
              )}
            </div>
            <button
              onClick={logout}
              className="text-slate-400 hover:text-rose-400 p-1.5 rounded hover:bg-slate-800 transition"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 sm:px-6 z-20">
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-slate-300 hover:text-white p-1"
            >
              <Menu size={20} />
            </button>

            {/* Global Search */}
            <form onSubmit={handleSearch} className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, clients, leads, invoices..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 transition"
              />
            </form>
          </div>

          <div className="flex items-center gap-3">
            {/* Environment Badge */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Enterprise ERP
            </span>

            {/* Quick Action Button */}
            <button
              onClick={() => navigate('/projects')}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-sky-600/20 transition"
            >
              <PlusCircle size={14} />
              <span>New Order</span>
            </button>

            {/* Role Badge */}
            <span className="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase bg-slate-800 text-sky-400 border border-slate-700">
              {user?.role.replace('_', ' ')}
            </span>
          </div>
        </header>

        {/* Dynamic Page View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

