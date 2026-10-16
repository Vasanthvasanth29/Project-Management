import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Users,
  Briefcase,
  User,
  Sparkles,
  CheckCircle2,
  Layers,
  Lock,
  Mail,
  Building,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getDashboardPath } from '../../utils/roleUtils';
import { demoCredentials } from '../../data/mockData';
import type { SSOProviderType } from '../../types/sso';
import { useSSOStore } from '../../store/ssoStore';
import { SSOModal } from './SSOModal';
import { toast } from 'sonner';

const roleMeta = {
  ADMIN: { icon: ShieldCheck, color: '#6366f1', bg: '#e0e7ff', badge: 'Super Admin', desc: 'Full administration & configuration' },
  PROJECT_MANAGER: { icon: Briefcase, color: '#0d9488', bg: '#ccfbf1', badge: 'PM Lead', desc: 'Manage projects, workflows & iterations' },
  TEAM_LEADER: { icon: Users, color: '#06b6d4', bg: '#cffafe', badge: 'Tech Lead', desc: 'Team oversight & task assignment' },
  MEMBER: { icon: User, color: '#f59e0b', bg: '#fef3c7', badge: 'Developer / Member', desc: 'Iteration tasks, code & bugs tracking' },
};

interface LoginPageProps {
  initialMode?: 'login' | 'register';
}

export const LoginPage: React.FC<LoginPageProps> = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();

  const { settings: ssoSettings, isDomainEnforced } = useSSOStore();
  const [activeSsoProvider, setActiveSsoProvider] = useState<SSOProviderType | null>(null);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const domainEnforced = email ? isDomainEnforced(email) : false;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);
    const result = await login({ email, password });
    if (result.success && result.role) {
      toast.success('Welcome back to FlowExec!');
      navigate(getDashboardPath(result.role));
    }
  };

  const handleDemoLogin = async (demo: typeof demoCredentials[0]) => {
    clearError();
    setLocalError(null);
    setEmail(demo.email);
    setPassword(demo.password);
    const result = await login({ email: demo.email, password: demo.password });
    if (result.success && result.role) {
      toast.success(`Signed in as ${demo.label}`);
      navigate(getDashboardPath(result.role));
    }
  };

  const activeError = localError || error;

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex flex-col justify-between items-center p-4 sm:p-6 lg:p-8 font-sans">
      {/* Top Header */}
      <div className="w-full max-w-5xl flex items-center justify-between py-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl shadow-sm flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg, #0d9488, #06b6d4)' }}>
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[#1a1d23] tracking-tight font-display">
            FlowExec <span className="text-[#0d9488] font-normal">Platform</span>
          </span>
        </div>

        <div className="text-xs font-medium text-[#9ca3af]">Cloud Partner Verified</div>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-[#e2e5ea] shadow-modal overflow-hidden my-auto grid grid-cols-1 lg:grid-cols-12 animate-scale-in">
        {/* Left Side: Branding & Features */}
        <div className="lg:col-span-5 p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-[#e2e5ea]" style={{ background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)' }}>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#2dd4bf] text-xs font-semibold mb-6 backdrop-blur-sm border border-white/10">
              <Sparkles className="w-3.5 h-3.5" />
              Enterprise Platform
            </div>

            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight font-display mb-3">
              Modern project workflow for agile teams
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 leading-relaxed mb-8">
              Built on modern design standards. Control execution hierarchy from Admin to Member with real-time feedback.
            </p>

            <div className="space-y-3.5">
              {[
                { title: 'Controlled Hierarchy', desc: 'Admin, PM, Tech Lead & Member roles' },
                { title: 'Live Iteration Tracking', desc: 'Kanban boards and milestone velocity' },
                { title: 'Enterprise Ready', desc: 'Fast search, quick launcher, and notifications' },
              ].map((feat, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-lg bg-[#0d9488]/20 text-[#2dd4bf] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{feat.title}</div>
                    <div className="text-[11px] text-slate-400">{feat.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 text-[11px] text-slate-500">
            FlowExec Enterprise · Single Sign-On Enabled
          </div>
        </div>

        {/* Right Side: Sign In Form */}
        <div className="lg:col-span-7 p-6 sm:p-8 lg:p-10 flex flex-col justify-center max-h-[92vh] overflow-y-auto scrollbar-thin">
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1a1d23] font-display">Sign In</h2>
              <p className="text-xs text-[#4b5563] mt-1">to continue to FlowExec Platform</p>
            </div>

            {/* Enterprise SSO Action Buttons */}
            <div className="space-y-2 mb-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#747775] flex items-center justify-between">
                <span>Fast Enterprise Single Sign-On</span>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> SSO Active
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {/* Google */}
                <button
                  type="button"
                  onClick={() => setActiveSsoProvider('google')}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-[#e0e2ec] hover:border-[#4285F4] hover:bg-[#4285F4]/5 bg-white text-xs font-bold text-[#1f1f1f] shadow-2xs transition-all group"
                >
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span className="truncate">Google</span>
                </button>

                {/* Microsoft */}
                <button
                  type="button"
                  onClick={() => setActiveSsoProvider('microsoft')}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-[#e0e2ec] hover:border-[#0078d4] hover:bg-[#0078d4]/5 bg-white text-xs font-bold text-[#1f1f1f] shadow-2xs transition-all group"
                >
                  <div className="grid grid-cols-2 gap-0.5 w-3.5 h-3.5 flex-shrink-0">
                    <span className="bg-[#f25022] rounded-[0.5px]" />
                    <span className="bg-[#7fba00] rounded-[0.5px]" />
                    <span className="bg-[#00a4ef] rounded-[0.5px]" />
                    <span className="bg-[#ffb900] rounded-[0.5px]" />
                  </div>
                  <span className="truncate">Microsoft</span>
                </button>

                {/* Okta SAML */}
                <button
                  type="button"
                  onClick={() => setActiveSsoProvider('okta')}
                  className="flex items-center justify-center gap-1.5 p-2.5 rounded-2xl border border-[#e0e2ec] hover:border-[#00297a] hover:bg-[#00297a]/5 bg-white text-xs font-bold text-[#1f1f1f] shadow-2xs transition-all group"
                >
                  <ShieldCheck className="w-4 h-4 text-[#00297a] flex-shrink-0" />
                  <span className="truncate">Okta SAML</span>
                </button>
              </div>

              {/* Domain enforcement prompt */}
              {domainEnforced && (
                <div className="p-3 rounded-2xl bg-[#e8f0fe] border border-[#d2e3fc] flex items-center justify-between text-xs text-[#0b57d0] animate-fade-in mt-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#1a73e8] flex-shrink-0" />
                    <span>Single Sign-On is required for this domain.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSsoProvider('okta')}
                    className="font-bold underline hover:text-[#174ea6] flex-shrink-0 ml-2"
                  >
                    Use SSO →
                  </button>
                </div>
              )}
            </div>

            {/* Or Divider */}
            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-[#e0e2ec] w-full" />
              <span className="bg-white px-3 text-[11px] uppercase tracking-wider text-[#747775] font-semibold flex-shrink-0">
                or sign in with password
              </span>
              <div className="border-t border-[#e0e2ec] w-full" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="input-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  className="input"
                  required
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="input-label" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="input pr-11"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#747775] hover:text-[#1f1f1f] transition-colors p-1"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0d9488] focus:ring-[#0d9488] border-[#cbd5e1]"
                  />
                  <span className="text-xs font-medium text-[#4b5563]">Keep me signed in</span>
                </label>
                <button type="button" className="text-xs font-semibold text-[#0d9488] hover:text-[#0f766e]">
                  Forgot password?
                </button>
              </div>

              {activeError && (
                <div className="p-3 rounded-xl bg-[#fce8e6] border border-[#fad2cf] text-xs font-semibold text-[#c5221f]">
                  {activeError}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary w-full justify-center py-3 text-sm mt-2 shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Switcher */}
            <div className="mt-8 pt-6 border-t border-[#f1f5f9]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9ca3af]">
                  Quick Demo Access (1-Click Login)
                </span>
                <span className="text-[10px] text-[#0d9488] font-semibold">Instant Access</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {demoCredentials.map((demo) => {
                  const meta = roleMeta[demo.role];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={demo.role}
                      type="button"
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-[#e2e8f0] hover:border-[#0d9488] hover:bg-[#f0fdfa] active:bg-[#ccfbf1] transition-all text-left group"
                      onClick={() => handleDemoLogin(demo)}
                      disabled={isLoading}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: meta.bg }}
                      >
                        <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[#1a1d23] truncate group-hover:text-[#0d9488]">
                          {demo.label}
                        </div>
                        <div className="text-[10px] text-[#9ca3af] truncate">{demo.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-5xl flex items-center justify-between text-[11px] text-[#9ca3af] py-4">
        <div className="flex items-center gap-4">
          <span className="hover:underline cursor-pointer">Help</span>
          <span className="hover:underline cursor-pointer">Privacy</span>
          <span className="hover:underline cursor-pointer">Terms</span>
        </div>
        <div>FlowExec Enterprise Edition 2026</div>
      </div>

      {/* Interactive Enterprise SSO Modal */}
      <SSOModal
        provider={activeSsoProvider}
        isOpen={!!activeSsoProvider}
        onClose={() => setActiveSsoProvider(null)}
        defaultEmail={email}
      />
    </div>
  );
};
