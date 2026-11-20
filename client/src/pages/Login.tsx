import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE, parseJsonSafe } from '../services/api';
import {
  Factory,
  Shield,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  UserPlus,
  KeyRound,
  Server,
  ShieldCheck,
  Clock,
  User as UserIcon,
} from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [email, setEmail] = useState('admin@apexprecision.com');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [serverHealth, setServerHealth] = useState<'CHECKING' | 'ONLINE' | 'OFFLINE'>('CHECKING');

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Offline');
        const data = await parseJsonSafe(res);
        setServerHealth(data?.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE');
      })
      .catch(() => setServerHealth('OFFLINE'));
  }, []);

  // Live Password Strength Evaluation
  const passwordChecks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const strengthScore = Object.values(passwordChecks).filter(Boolean).length;
  const strengthLabel =
    strengthScore <= 2 ? 'Weak' : strengthScore <= 4 ? 'Moderate' : 'Strong Enterprise';
  const strengthColor =
    strengthScore <= 2 ? 'bg-rose-500' : strengthScore <= 4 ? 'bg-amber-500' : 'bg-emerald-500';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'REGISTER') {
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
      if (strengthScore < 5) {
        setError('Please meet all 5 strong password requirements before registering.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const endpoint = mode === 'LOGIN' ? `${API_BASE}/api/auth/login` : `${API_BASE}/api/auth/register`;
      const payload =
        mode === 'LOGIN'
          ? { email, password, rememberMe }
          : { fullName, email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.message || 'Authentication failed');
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const backendAccounts = [
    { role: 'Super Admin', email: 'admin@apexprecision.com', scope: 'Full System, RBAC & Settings' },
    { role: 'Project Manager', email: 'pm@apexprecision.com', scope: 'Projects, Production & Delivery' },
    { role: 'Finance Manager', email: 'finance@apexprecision.com', scope: 'Invoices, Payments & Payroll' },
    { role: 'Operations Staff', email: 'ops@apexprecision.com', scope: 'Batch Output & QC Inspections' },
    { role: 'Sales Manager', email: 'sales@apexprecision.com', scope: 'Leads, Clients & Comms' },
    { role: 'Employee', email: 'employee@apexprecision.com', scope: 'Assigned Tasks & Personal Logs' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 lg:p-8">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Panel: Enterprise Security & Architecture Overview */}
        <div className="lg:col-span-6 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-white">APEX PRECISION ERP</h1>
                  <p className="text-xs text-slate-400">Enterprise Manufacturing &amp; Finance Suite</p>
                </div>
              </div>

              <div
                className={`px-3 py-1 rounded-full border text-[11px] font-semibold flex items-center gap-1.5 ${
                  serverHealth === 'ONLINE'
                    ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-400'
                    : serverHealth === 'OFFLINE'
                    ? 'bg-rose-950/70 border-rose-700/60 text-rose-400'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverHealth === 'ONLINE' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                  }`}
                />
                Backend {serverHealth}
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white leading-snug">
                Unified Plant Operations, Quality Control &amp; Financial Ledger
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Every user account, role permission, manufacturing batch, and payment transaction is persisted and verified against the PostgreSQL backend server.
              </p>
            </div>

            {/* Security Safeguards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                  <Server className="w-4 h-4" /> PostgreSQL User Store
                </div>
                <p className="text-[11px] text-slate-400">
                  All admins, managers, and staff accounts are stored securely in the backend database with Bcrypt hashing.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <ShieldCheck className="w-4 h-4" /> Brute-Force Lockout
                </div>
                <p className="text-[11px] text-slate-400">
                  Accounts automatically lock for 5 minutes after 5 consecutive failed login attempts and log security events.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-purple-400">
                  <KeyRound className="w-4 h-4" /> Server-Side RBAC
                </div>
                <p className="text-[11px] text-slate-400">
                  Every API route enforces role permissions server-side before returning payroll, invoices, or project data.
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/80 space-y-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                  <Clock className="w-4 h-4" /> Immutable Audit Trail
                </div>
                <p className="text-[11px] text-slate-400">
                  Sign-ins, failed attempts, password changes, and financial posts are recorded in the activity stream.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Facility: Plant #1 &bull; Faridabad Industrial Zone</span>
            <span className="font-mono">v1.0.0-ENT</span>
          </div>
        </div>

        {/* Right Panel: Detailed Authentication Form */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col justify-between">
          <div>
            {/* Mode Switcher */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 border border-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setError(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                  mode === 'LOGIN'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" /> Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('REGISTER');
                  setError(null);
                  setEmail('');
                  setPassword('');
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 ${
                  mode === 'REGISTER'
                    ? 'bg-sky-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Register Account
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 flex items-start gap-2.5 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'REGISTER' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
                      placeholder="e.g. Arjun Verma"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Work Email Address *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
                    placeholder="name@apexprecision.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Password *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'REGISTER' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Confirm Password *
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500 text-sm"
                      placeholder="Re-enter strong password"
                    />
                  </div>

                  {/* Live Password Strength Meter */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">Password Strength:</span>
                      <span className="font-semibold text-white">{strengthLabel}</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strengthColor}`}
                        style={{ width: `${(strengthScore / 5) * 100}%` }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-400 pt-1">
                      <span className={passwordChecks.length ? 'text-emerald-400' : ''}>
                        {passwordChecks.length ? '✓' : '○'} 8+ characters
                      </span>
                      <span className={passwordChecks.upper ? 'text-emerald-400' : ''}>
                        {passwordChecks.upper ? '✓' : '○'} Uppercase (A-Z)
                      </span>
                      <span className={passwordChecks.lower ? 'text-emerald-400' : ''}>
                        {passwordChecks.lower ? '✓' : '○'} Lowercase (a-z)
                      </span>
                      <span className={passwordChecks.number ? 'text-emerald-400' : ''}>
                        {passwordChecks.number ? '✓' : '○'} Number (0-9)
                      </span>
                      <span className={passwordChecks.special ? 'text-emerald-400' : ''}>
                        {passwordChecks.special ? '✓' : '○'} Special (!@#$%)
                      </span>
                    </div>
                  </div>
                </>
              )}

              {mode === 'LOGIN' && (
                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0"
                    />
                    Keep session active for 7 days
                  </label>
                  <span className="text-slate-500 font-mono">JWT + Bcrypt</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20 disabled:opacity-50"
              >
                {isLoading
                  ? 'Verifying with Backend Server...'
                  : mode === 'LOGIN'
                  ? 'Authenticate & Enter ERP'
                  : 'Create Backend Account'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Backend-Stored Accounts Directory */}
          {mode === 'LOGIN' && (
            <div className="mt-6 pt-5 border-t border-slate-800">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  Backend-Stored Role Accounts (Quick Fill)
                </span>
                <span className="text-[11px] font-mono text-slate-500">pass: password123</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {backendAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('password123');
                      setError(null);
                    }}
                    className={`p-2 rounded-xl border text-left transition ${
                      email === acc.email
                        ? 'border-sky-500/70 bg-sky-500/10 text-white'
                        : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{acc.role}</div>
                    <div className="text-[10px] text-slate-400 truncate">{acc.scope}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
