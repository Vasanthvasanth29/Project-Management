import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '../types';
import type {
  SSOProviderType,
  SSOProviderConfig,
  SSOSettings,
  SSODiagnosticResult
} from '../types/sso';

interface SSOState {
  settings: SSOSettings;
  isTesting: boolean;
  diagnosticResult: SSODiagnosticResult | null;
  updateProviderConfig: (id: SSOProviderType, updates: Partial<SSOProviderConfig>) => void;
  toggleProvider: (id: SSOProviderType, enabled?: boolean) => void;
  setEnforceSSO: (enforce: boolean) => void;
  addEnforcedDomain: (domain: string) => void;
  removeEnforcedDomain: (domain: string) => void;
  setJitProvisioning: (enabled: boolean, defaultRole?: Role) => void;
  runDiagnosticTest: (providerId: SSOProviderType) => Promise<SSODiagnosticResult>;
  clearDiagnostic: () => void;
  isDomainEnforced: (email: string) => boolean;
}

const defaultProviders: Record<SSOProviderType, SSOProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google Single Sign-On (SSO)',
    protocol: 'OIDC',
    enabled: true,
    clientId: '728194018291-flowexec.apps.googleusercontent.com',
    clientSecret: '••••••••••••••••••••••••••••••••',
    issuerUrl: 'https://accounts.google.com',
    redirectUri: window.location.origin + '/auth/callback/google',
    hostedDomains: ['invictustec.com', 'demo.com'],
    autoProvisionRole: 'MEMBER',
    icon: 'google',
  },
  microsoft: {
    id: 'microsoft',
    name: 'Microsoft Entra ID (Azure AD)',
    protocol: 'OIDC',
    enabled: true,
    tenantId: '7f91a23b-5c8e-4a11-89b6-9df38271a5bc',
    clientId: 'e8913b82-d92e-48a0-975e-88ef492c10aa',
    issuerUrl: 'https://login.microsoftonline.com/7f91a23b-5c8e-4a11-89b6-9df38271a5bc/v2.0',
    redirectUri: window.location.origin + '/auth/callback/microsoft',
    autoProvisionRole: 'MEMBER',
    icon: 'microsoft',
  },
  okta: {
    id: 'okta',
    name: 'Okta Enterprise (SAML 2.0)',
    protocol: 'SAML 2.0',
    enabled: true,
    entityId: 'urn:flowexec:sp',
    acsUrl: window.location.origin + '/saml/acs',
    metadataUrl: 'https://invictus-tec.okta.com/app/exk48291048/sso/saml/metadata',
    certificateExpiry: '2027-12-31T23:59:59Z',
    certificateStatus: 'VALID',
    autoProvisionRole: 'MEMBER',
    icon: 'shield',
  },
  saml: {
    id: 'saml',
    name: 'Generic Enterprise SAML 2.0',
    protocol: 'SAML 2.0',
    enabled: false,
    entityId: 'urn:flowexec:custom-sp',
    acsUrl: window.location.origin + '/saml/acs/custom',
    certificateStatus: 'VALID',
    autoProvisionRole: 'MEMBER',
    icon: 'key',
  },
};

export const useSSOStore = create<SSOState>()(
  persist(
    (set, get) => ({
      settings: {
        enforceSSO: false,
        enforcedDomains: ['invictustec.com'],
        jitProvisioningEnabled: true,
        defaultRole: 'MEMBER',
        allowPasswordFallback: true,
        sessionDurationHours: 12,
        providers: defaultProviders,
      },
      isTesting: false,
      diagnosticResult: null,

      updateProviderConfig: (id, updates) => {
        set((state) => ({
          settings: {
            ...state.settings,
            providers: {
              ...state.settings.providers,
              [id]: {
                ...state.settings.providers[id],
                ...updates,
              },
            },
          },
        }));
      },

      toggleProvider: (id, enabled) => {
        set((state) => {
          const current = state.settings.providers[id];
          const newStatus = enabled !== undefined ? enabled : !current.enabled;
          return {
            settings: {
              ...state.settings,
              providers: {
                ...state.settings.providers,
                [id]: {
                  ...current,
                  enabled: newStatus,
                },
              },
            },
          };
        });
      },

      setEnforceSSO: (enforce) => {
        set((state) => ({
          settings: {
            ...state.settings,
            enforceSSO: enforce,
          },
        }));
      },

      addEnforcedDomain: (domain) => {
        const clean = domain.trim().toLowerCase().replace(/^@/, '');
        if (!clean) return;
        set((state) => {
          if (state.settings.enforcedDomains.includes(clean)) return state;
          return {
            settings: {
              ...state.settings,
              enforcedDomains: [...state.settings.enforcedDomains, clean],
            },
          };
        });
      },

      removeEnforcedDomain: (domain) => {
        set((state) => ({
          settings: {
            ...state.settings,
            enforcedDomains: state.settings.enforcedDomains.filter((d) => d !== domain),
          },
        }));
      },

      setJitProvisioning: (enabled, defaultRole) => {
        set((state) => ({
          settings: {
            ...state.settings,
            jitProvisioningEnabled: enabled,
            defaultRole: defaultRole || state.settings.defaultRole,
          },
        }));
      },

      isDomainEnforced: (email: string) => {
        const { enforceSSO, enforcedDomains } = get().settings;
        if (!enforceSSO) return false;
        const domain = email.split('@')[1]?.toLowerCase().trim();
        return Boolean(domain && enforcedDomains.includes(domain));
      },

      runDiagnosticTest: async (providerId) => {
        set({ isTesting: true, diagnosticResult: null });

        // Simulate network handshake with Identity Provider
        await new Promise((r) => setTimeout(r, 1200));

        const provider = get().settings.providers[providerId];
        const isSaml = provider.protocol === 'SAML 2.0';

        const result: SSODiagnosticResult = {
          providerId,
          timestamp: new Date().toISOString(),
          success: true,
          latencyMs: Math.floor(180 + Math.random() * 80),
          steps: [
            {
              name: 'Discovery / Metadata Exchange',
              status: 'success',
              detail: isSaml
                ? `Fetched EntityDescriptor from ${provider.metadataUrl || 'IDP Metadata endpoint'}`
                : `Validated OpenID Connect discovery document at ${provider.issuerUrl}/.well-known/openid-configuration`,
            },
            {
              name: 'Cryptographic Certificate Verification',
              status: 'success',
              detail: isSaml
                ? `X.509 Signing Certificate is VALID (SHA-256 fingerprint verified, expires Dec 2027)`
                : `JWKS Key Set retrieved (2 active RSA public keys)`,
            },
            {
              name: 'Redirect / Assertion Consumer Handshake',
              status: 'success',
              detail: `ACS Endpoint verified: ${provider.acsUrl || provider.redirectUri}`,
            },
            {
              name: 'Attribute Mapping & Claims Evaluation',
              status: 'success',
              detail: `Mapped user attributes: 'email' -> EmailAddress, 'name' -> DisplayName, 'groups' -> Role Mapping`,
            },
          ],
          claimsReceived: {
            sub: 'usr_sso_test_99841',
            email: 'admin@demo.com',
            name: 'Sarah Mitchell',
            preferred_username: 'smitchell',
            tenant: provider.tenantId || 'invictus-tec.okta.com',
            auth_time: Math.floor(Date.now() / 1000).toString(),
          },
          certificateValidUntil: '2027-12-31T23:59:59Z',
        };

        set({ isTesting: false, diagnosticResult: result });
        return result;
      },

      clearDiagnostic: () => set({ diagnosticResult: null }),
    }),
    {
      name: 'flowexec-sso-settings',
    }
  )
);
