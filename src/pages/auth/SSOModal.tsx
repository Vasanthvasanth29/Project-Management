import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  Building,
  KeyRound,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  UserCheck,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSSOStore } from '../../store/ssoStore';
import type { SSOProviderType, SSOAuthClaim } from '../../types/sso';
import type { Role } from '../../types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getDashboardPath } from '../../utils/roleUtils';

interface SSOModalProps {
  provider: SSOProviderType | null;
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export const SSOModal: React.FC<SSOModalProps> = ({
  provider,
  isOpen,
  onClose,
  defaultEmail = '',
}) => {
  const navigate = useNavigate();
  const { loginWithSSO, isLoading } = useAuthStore();
  const { settings } = useSSOStore();

  const [selectedAccountEmail, setSelectedAccountEmail] = useState<string | null>(null);
  const [customEmail, setCustomEmail] = useState(defaultEmail);
  const [customName, setCustomName] = useState('');
  const [customRole, setCustomRole] = useState<Role>(settings.defaultRole || 'MEMBER');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [authStep, setAuthStep] = useState<'SELECT' | 'AUTHENTICATING' | 'SUCCESS' | 'ERROR'>('SELECT');
  const [stepMessage, setStepMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !provider) return null;

  const currentProviderConfig = settings.providers[provider];

  // Pre-configured identity profiles for instant testing
  const enterpriseIdentities: Record<SSOProviderType, { name: string; email: string; role: Role; department: string; avatarUrl?: string }[]> = {
    google: [
      {
        name: 'Sarah Mitchell',
        email: 'admin@demo.com',
        role: 'ADMIN',
        department: 'Engineering & DevOps',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      },
      {
        name: 'Rahul Kumar',
        email: 'manager@demo.com',
        role: 'PROJECT_MANAGER',
        department: 'Product Delivery',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
      },
      {
        name: 'Elena Rostova',
        email: 'elena.rostova@invictustec.com',
        role: 'MEMBER',
        department: 'Cloud Architecture',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
      },
    ],
    microsoft: [
      {
        name: 'Arun Kumar',
        email: 'leader@demo.com',
        role: 'TEAM_LEADER',
        department: 'Frontend Engineering',
        avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
      },
      {
        name: 'Priya Patel',
        email: 'member@demo.com',
        role: 'MEMBER',
        department: 'Quality Assurance',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
      },
      {
        name: 'Marcus Vance',
        email: 'marcus.v@invictustec.com',
        role: 'PROJECT_MANAGER',
        department: 'Enterprise Programs',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      },
    ],
    okta: [
      {
        name: 'Sarah Mitchell',
        email: 'admin@demo.com',
        role: 'ADMIN',
        department: 'SecOps & IT Administration',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
      },
      {
        name: 'David Chen',
        email: 'david.chen@invictustec.com',
        role: 'TEAM_LEADER',
        department: 'Systems Engineering',
        avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      },
      {
        name: 'Corporate Identity User',
        email: 'employee@invictustec.com',
        role: 'MEMBER',
        department: 'Operations',
      },
    ],
    saml: [
      {
        name: 'Enterprise SAML User',
        email: 'user@invictustec.com',
        role: 'MEMBER',
        department: 'Corporate Staff',
      },
    ],
  };

  const handleAuthenticate = async (claim: SSOAuthClaim) => {
    setAuthStep('AUTHENTICATING');
    setErrorMessage(null);

    try {
      setStepMessage(`Contacting ${currentProviderConfig.name}...`);
      await new Promise((r) => setTimeout(r, 450));

      setStepMessage(`Exchanging ${currentProviderConfig.protocol} assertion & cryptographic tokens...`);
      await new Promise((r) => setTimeout(r, 550));

      setStepMessage('Verifying corporate domain policy & JIT claims...');
      await new Promise((r) => setTimeout(r, 400));

      const result = await loginWithSSO(claim);

      if (result.success && result.role) {
        setAuthStep('SUCCESS');
        setStepMessage('Single Sign-On authentication verified.');
        toast.success(
          result.isNewUser
            ? `Welcome to FlowExec! Provisioned new account via ${currentProviderConfig.name} SSO.`
            : `Welcome back, ${claim.name}! Authenticated via ${currentProviderConfig.name} SSO.`
        );

        setTimeout(() => {
          onClose();
          navigate(getDashboardPath(result.role!));
        }, 600);
      } else {
        setAuthStep('ERROR');
        setErrorMessage(result.error || 'SSO authentication failed. Please check provider status.');
      }
    } catch (err: any) {
      setAuthStep('ERROR');
      setErrorMessage(err?.message || 'Identity provider error occurred.');
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail.trim()) return;

    const claim: SSOAuthClaim = {
      id: `sso-${provider}-${Date.now()}`,
      email: customEmail.trim().toLowerCase(),
      name: customName.trim() || customEmail.split('@')[0],
      provider,
      roleHint: customRole,
      department: 'Enterprise Operations',
    };

    handleAuthenticate(claim);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header branded per provider */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-b from-slate-50/80 to-white">
          <div className="flex items-center gap-3">
            {provider === 'google' && (
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              </div>
            )}

            {provider === 'microsoft' && (
              <div className="w-10 h-10 rounded-2xl bg-[#0078d4]/10 border border-[#0078d4]/20 flex items-center justify-center">
                <div className="grid grid-cols-2 gap-0.5 w-5 h-5">
                  <span className="bg-[#f25022] rounded-[1px]" />
                  <span className="bg-[#7fba00] rounded-[1px]" />
                  <span className="bg-[#00a4ef] rounded-[1px]" />
                  <span className="bg-[#ffb900] rounded-[1px]" />
                </div>
              </div>
            )}

            {(provider === 'okta' || provider === 'saml') && (
              <div className="w-10 h-10 rounded-2xl bg-[#00297a]/10 border border-[#00297a]/20 flex items-center justify-center text-[#00297a]">
                <ShieldCheck className="w-5 h-5 text-[#00297a]" />
              </div>
            )}

            <div>
              <div className="text-base font-bold text-slate-900 leading-tight">
                {currentProviderConfig.name}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Verified Enterprise Identity Provider ({currentProviderConfig.protocol})</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={authStep === 'AUTHENTICATING'}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto">
          {authStep === 'AUTHENTICATING' && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-blue-600 animate-pulse">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="absolute -inset-1 rounded-3xl border-2 border-blue-600 border-t-transparent animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Authenticating with Enterprise IdP</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">{stepMessage}</p>
              </div>
              <div className="px-3 py-1.5 rounded-full bg-slate-100 text-[11px] font-mono text-slate-600">
                Protocol: {currentProviderConfig.protocol} · TLS 1.3
              </div>
            </div>
          )}

          {authStep === 'SUCCESS' && (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">SSO Assertion Verified</h3>
              <p className="text-xs text-slate-500">Redirecting to your dashboard...</p>
            </div>
          )}

          {authStep === 'ERROR' && (
            <div className="py-6 space-y-4">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800">
                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <div className="font-bold">Authentication Refused</div>
                  <div className="text-rose-700">{errorMessage}</div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setAuthStep('SELECT')}
                >
                  Try Another Identity
                </button>
                <button type="button" className="btn-primary btn-sm" onClick={onClose}>
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          {authStep === 'SELECT' && (
            <div className="space-y-5">
              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                Choose an existing corporate identity below for 1-click single sign-on, or enter your company work email to simulate dynamic JIT provisioning.
              </div>

              {/* Mode switch */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display">
                  {isCustomMode ? 'Custom Work Account' : 'Available Enterprise Identities'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCustomMode(!isCustomMode)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
                >
                  {isCustomMode ? '← Pick from list' : 'Use other work email →'}
                </button>
              </div>

              {!isCustomMode ? (
                <div className="space-y-2.5">
                  {enterpriseIdentities[provider]?.map((identity) => (
                    <button
                      key={identity.email}
                      type="button"
                      onClick={() => {
                        setSelectedAccountEmail(identity.email);
                        handleAuthenticate({
                          id: `sso-${provider}-${identity.email}`,
                          email: identity.email,
                          name: identity.name,
                          roleHint: identity.role,
                          avatarUrl: identity.avatarUrl,
                          provider,
                          department: identity.department,
                        });
                      }}
                      className="w-full p-3 rounded-2xl border border-slate-200 hover:border-brand-500 hover:bg-brand-50/40 transition-all flex items-center justify-between text-left group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {identity.avatarUrl ? (
                          <img
                            src={identity.avatarUrl}
                            alt={identity.name}
                            className="w-10 h-10 rounded-xl object-cover ring-1 ring-slate-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm flex-shrink-0">
                            {identity.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate group-hover:text-brand-600">
                            {identity.name}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{identity.email}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {identity.department} · <span className="font-semibold text-slate-600">{identity.role}</span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                <form onSubmit={handleCustomSubmit} className="space-y-3.5">
                  <div>
                    <label className="input-label" htmlFor="sso-custom-email">
                      Corporate Work Email
                    </label>
                    <input
                      id="sso-custom-email"
                      type="email"
                      value={customEmail}
                      onChange={(e) => setCustomEmail(e.target.value)}
                      placeholder="e.g. employee@invictustec.com"
                      className="input text-xs"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="input-label" htmlFor="sso-custom-name">
                      Full Name
                    </label>
                    <input
                      id="sso-custom-name"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="e.g. Taylor Jenkins"
                      className="input text-xs"
                    />
                  </div>

                  <div>
                    <label className="input-label">Requested JIT Role (if new user)</label>
                    <select
                      value={customRole}
                      onChange={(e) => setCustomRole(e.target.value as Role)}
                      className="select text-xs"
                    >
                      <option value="MEMBER">Member (Developer / Staff)</option>
                      <option value="TEAM_LEADER">Team Leader</option>
                      <option value="PROJECT_MANAGER">Project Manager</option>
                      <option value="ADMIN">Super Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="btn-primary w-full justify-center py-2.5 text-xs shadow-sm mt-2"
                  >
                    <span>Authenticate via {currentProviderConfig.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* IdP Protocol details */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>SAML 2.0 / OIDC 1.0 Compliant</span>
                </div>
                <div>Tenant: {currentProviderConfig.tenantId || 'Invictus-Tec'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
