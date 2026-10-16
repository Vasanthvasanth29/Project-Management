import type { Role } from './index';

export type SSOProviderType = 'google' | 'microsoft' | 'okta' | 'saml';

export type AuthProviderType = 'PASSWORD' | 'GOOGLE' | 'MICROSOFT' | 'OKTA' | 'SAML';

export interface SSOProviderConfig {
  id: SSOProviderType;
  name: string;
  protocol: 'OIDC' | 'SAML 2.0';
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  issuerUrl?: string;
  redirectUri?: string;
  entityId?: string;
  acsUrl?: string;
  metadataUrl?: string;
  certificateExpiry?: string;
  certificateStatus?: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
  hostedDomains?: string[];
  autoProvisionRole: Role;
  icon: string;
}

export interface SSOSettings {
  enforceSSO: boolean;
  enforcedDomains: string[];
  jitProvisioningEnabled: boolean;
  defaultRole: Role;
  allowPasswordFallback: boolean;
  sessionDurationHours: number;
  providers: Record<SSOProviderType, SSOProviderConfig>;
}

export interface SSOAuthClaim {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: SSOProviderType;
  tenantId?: string;
  department?: string;
  jobTitle?: string;
  roleHint?: Role;
}

export interface SSODiagnosticResult {
  providerId: SSOProviderType;
  timestamp: string;
  success: boolean;
  latencyMs: number;
  steps: {
    name: string;
    status: 'success' | 'warning' | 'failed';
    detail: string;
  }[];
  claimsReceived?: Record<string, string>;
  certificateValidUntil?: string;
  error?: string;
}
