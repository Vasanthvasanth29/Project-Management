import React, { useState } from 'react';
import {
  ShieldCheck,
  Building,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Globe,
  Users,
  Save,
  Check,
  X,
  ExternalLink,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';
import { useSSOStore } from '../../../store/ssoStore';
import { useAuthStore } from '../../../store/authStore';
import type { SSOProviderType, SSOProviderConfig } from '../../../types/sso';
import type { Role } from '../../../types';
import { toast } from 'sonner';

export const SSOSettingsTab: React.FC = () => {
  const { currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'ADMIN';

  const {
    settings,
    updateProviderConfig,
    toggleProvider,
    setEnforceSSO,
    addEnforcedDomain,
    removeEnforcedDomain,
    setJitProvisioning,
    runDiagnosticTest,
    diagnosticResult,
    isTesting,
    clearDiagnostic,
  } = useSSOStore();

  const [activeProviderTab, setActiveProviderTab] = useState<SSOProviderType>('google');
  const [newDomainInput, setNewDomainInput] = useState('');
  const [showEnforceConfirm, setShowEnforceConfirm] = useState(false);
  const [testingProvider, setTestingProvider] = useState<SSOProviderType | null>(null);

  const activeProvider = settings.providers[activeProviderTab];

  const handleToggleEnforce = () => {
    if (!isAdmin) return;
    if (!settings.enforceSSO) {
      setShowEnforceConfirm(true);
    } else {
      setEnforceSSO(false);
      toast.info('SSO enforcement disabled. Password logins are now permitted.');
    }
  };

  const confirmEnforceSSO = () => {
    setEnforceSSO(true);
    setShowEnforceConfirm(false);
    toast.success('SSO enforcement active. All corporate domain logins must use SSO.');
  };

  const handleAddDomain = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !newDomainInput.trim()) return;
    addEnforcedDomain(newDomainInput);
    setNewDomainInput('');
    toast.success('Corporate domain registered for SSO.');
  };

  const handleRunDiagnostic = async (providerId: SSOProviderType) => {
    setTestingProvider(providerId);
    try {
      await runDiagnosticTest(providerId);
      toast.success(`${settings.providers[providerId].name} connection test passed!`);
    } catch {
      toast.error('Diagnostic test failed to reach identity provider.');
    } finally {
      setTestingProvider(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Summary */}
      <div className="card p-6 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-3xl overflow-hidden relative border-0 shadow-lg">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-200">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-300" />
            Enterprise Security & Federation
          </div>
          <h2 className="text-2xl font-bold font-display tracking-tight text-white">
            Single Sign-On (SSO) Management
          </h2>
          <p className="text-xs sm:text-sm text-blue-100 max-w-2xl leading-relaxed">
            Configure OpenID Connect (OIDC) and SAML 2.0 Identity Providers. Enforce company-wide domain authentication policies and manage Just-In-Time (JIT) provisioning.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-[11px] text-blue-200 uppercase font-semibold">SSO Status</div>
              <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    settings.enforceSSO ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {settings.enforceSSO ? 'Enforced' : 'Optional (Fallback)'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-[11px] text-blue-200 uppercase font-semibold">Active IdPs</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {Object.values(settings.providers).filter((p) => p.enabled).length} Configured
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-[11px] text-blue-200 uppercase font-semibold">JIT Provisioning</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {settings.jitProvisioningEnabled ? 'Enabled' : 'Disabled'}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
              <div className="text-[11px] text-blue-200 uppercase font-semibold">Managed Domains</div>
              <div className="text-sm font-bold text-white mt-0.5">
                {settings.enforcedDomains.length} Verified
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Non-admin view indicator */}
      {!isAdmin && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-3">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>
            SSO configuration is managed by System Administrators. As a standard user, you can review active authentication federations.
          </span>
        </div>
      )}

      {/* Main Grid: Policy & Domains on Left, Provider Config on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column: Policies & Domains */}
        <div className="lg:col-span-4 space-y-6">
          {/* SSO Enforcement Policy */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-brand-600" />
                <h3 className="text-sm font-bold text-slate-900 font-display">SSO Policy</h3>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleToggleEnforce}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.enforceSSO ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.enforceSSO ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              When enforced, users with registered corporate domains cannot authenticate using passwords and must use SSO.
            </p>

            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                settings.enforceSSO
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                {settings.enforceSSO ? 'Enforced for managed domains' : 'Password logins permitted'}
              </span>
            </div>
          </div>

          {/* JIT Provisioning Policy */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 font-display">JIT Provisioning</h3>
              </div>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setJitProvisioning(!settings.jitProvisioningEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.jitProvisioningEnabled ? 'bg-brand-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.jitProvisioningEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Automatically create local user profiles for new enterprise team members on their first successful SSO login.
            </p>

            {isAdmin && settings.jitProvisioningEnabled && (
              <div>
                <label className="input-label">Default Role for Provisioned Users</label>
                <select
                  value={settings.defaultRole}
                  onChange={(e) => setJitProvisioning(true, e.target.value as Role)}
                  className="select text-xs"
                >
                  <option value="MEMBER">Member (Developer / Staff)</option>
                  <option value="TEAM_LEADER">Team Leader</option>
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="ADMIN">Super Admin</option>
                </select>
              </div>
            )}
          </div>

          {/* Managed Domains */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900 font-display">Managed Domains</h3>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Users with these email domains are governed by SSO policies.
            </p>

            <div className="flex flex-wrap gap-2">
              {settings.enforcedDomains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700"
                >
                  <span>@{domain}</span>
                  {isAdmin && settings.enforcedDomains.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEnforcedDomain(domain)}
                      className="text-blue-400 hover:text-blue-700"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>

            {isAdmin && (
              <form onSubmit={handleAddDomain} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  placeholder="e.g. invictustec.com"
                  className="input text-xs flex-1"
                />
                <button type="submit" className="btn-secondary btn-sm flex-shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Right column: Identity Provider Tabs & Config */}
        <div className="lg:col-span-8 space-y-6">
          <div className="card p-6 space-y-6">
            {/* Provider Selector Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-4 overflow-x-auto scrollbar-none">
              {(['google', 'microsoft', 'okta', 'saml'] as SSOProviderType[]).map((provKey) => {
                const prov = settings.providers[provKey];
                const isActive = activeProviderTab === provKey;
                return (
                  <button
                    key={provKey}
                    type="button"
                    onClick={() => {
                      setActiveProviderTab(provKey);
                      clearDiagnostic();
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                    }`}
                  >
                    <span>{prov.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        prov.enabled ? 'bg-emerald-400' : 'bg-slate-300'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Selected Provider Details Header */}
            <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 font-display">
                    {activeProvider.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-[11px] font-bold text-blue-700">
                    {activeProvider.protocol}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {activeProvider.protocol === 'OIDC'
                    ? 'OpenID Connect 1.0 protocol with RSA token signature verification'
                    : 'Security Assertion Markup Language 2.0 Web Browser SSO profile'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => toggleProvider(activeProvider.id)}
                    className={`btn-sm ${activeProvider.enabled ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {activeProvider.enabled ? 'Disable Provider' : 'Enable Provider'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleRunDiagnostic(activeProvider.id)}
                  disabled={isTesting}
                  className="btn-secondary btn-sm"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-brand-600 ${
                      testingProvider === activeProvider.id ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Test Connection</span>
                </button>
              </div>
            </div>

            {/* Provider Configuration Form Fields */}
            <div className="space-y-4">
              {activeProvider.protocol === 'OIDC' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeProvider.clientId !== undefined && (
                    <div className="sm:col-span-2">
                      <label className="input-label">Client ID (Audience)</label>
                      <input
                        type="text"
                        value={activeProvider.clientId}
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateProviderConfig(activeProvider.id, { clientId: e.target.value })
                        }
                        className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                      />
                    </div>
                  )}

                  {activeProvider.clientSecret !== undefined && (
                    <div className="sm:col-span-2">
                      <label className="input-label">Client Secret</label>
                      <input
                        type="password"
                        value={activeProvider.clientSecret}
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateProviderConfig(activeProvider.id, { clientSecret: e.target.value })
                        }
                        className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                      />
                    </div>
                  )}

                  {activeProvider.tenantId !== undefined && (
                    <div>
                      <label className="input-label">Directory (Tenant) ID</label>
                      <input
                        type="text"
                        value={activeProvider.tenantId}
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateProviderConfig(activeProvider.id, { tenantId: e.target.value })
                        }
                        className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                      />
                    </div>
                  )}

                  {activeProvider.issuerUrl !== undefined && (
                    <div>
                      <label className="input-label">Issuer URL</label>
                      <input
                        type="text"
                        value={activeProvider.issuerUrl}
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateProviderConfig(activeProvider.id, { issuerUrl: e.target.value })
                        }
                        className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="input-label">Redirect Callback URI</label>
                    <input
                      type="text"
                      value={activeProvider.redirectUri}
                      readOnly
                      className="input text-xs font-mono bg-slate-50 text-slate-600"
                    />
                  </div>
                </div>
              ) : (
                /* SAML 2.0 Fields */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="input-label">SP Entity ID (Audience URI)</label>
                    <input
                      type="text"
                      value={activeProvider.entityId || ''}
                      readOnly={!isAdmin}
                      onChange={(e) =>
                        updateProviderConfig(activeProvider.id, { entityId: e.target.value })
                      }
                      className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="input-label">Single Sign-On ACS URL</label>
                    <input
                      type="text"
                      value={activeProvider.acsUrl || ''}
                      readOnly
                      className="input text-xs font-mono bg-slate-50 text-slate-600"
                    />
                  </div>

                  {activeProvider.metadataUrl && (
                    <div className="sm:col-span-2">
                      <label className="input-label">IdP Metadata XML Endpoint</label>
                      <input
                        type="text"
                        value={activeProvider.metadataUrl}
                        readOnly={!isAdmin}
                        onChange={(e) =>
                          updateProviderConfig(activeProvider.id, { metadataUrl: e.target.value })
                        }
                        className={`input text-xs font-mono ${!isAdmin ? 'bg-slate-50' : ''}`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="input-label">Signing Certificate Status</label>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Valid (SHA-256)
                      </span>
                      <span className="text-[11px] text-slate-400">Expires Dec 2027</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Diagnostic Results Card */}
            {diagnosticResult && diagnosticResult.providerId === activeProvider.id && (
              <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3.5 animate-scale-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-900 font-display">
                      SSO Federation Handshake Passed ({diagnosticResult.latencyMs}ms)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={clearDiagnostic}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    Dismiss
                  </button>
                </div>

                <div className="space-y-2">
                  {diagnosticResult.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs p-2 rounded-xl bg-white border border-slate-200/60"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-slate-800">{step.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {step.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {diagnosticResult.claimsReceived && (
                  <div className="p-3 rounded-2xl bg-white border border-slate-200/60">
                    <div className="text-[11px] font-bold text-slate-700 mb-1">
                      Simulated Identity Assertion Claims:
                    </div>
                    <pre className="text-[10px] font-mono text-slate-600 overflow-x-auto">
                      {JSON.stringify(diagnosticResult.claimsReceived, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal for Enforcing SSO */}
      {showEnforceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900">Enforce Enterprise SSO?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Enforcing SSO will require all users with email domains (
              <span className="font-semibold text-slate-800">
                {settings.enforcedDomains.map((d) => `@${d}`).join(', ')}
              </span>
              ) to authenticate through your Identity Provider. Password login will be disabled for these domains.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => setShowEnforceConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-sm bg-amber-600 hover:bg-amber-700 text-white"
                onClick={confirmEnforceSSO}
              >
                Confirm & Enforce SSO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
