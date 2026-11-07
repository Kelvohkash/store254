import type { Env } from "../config/env";

export interface TenantContext {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  businessType: string;
  currency: string;
  status: "ACTIVE" | "SUSPENDED" | "PENDING";
  settings: Record<string, unknown>;
}

export interface UserContext {
  id: string;
  tenantId: string;
  email: string;
  role: "OWNER" | "ADMIN" | "STAFF" | "CUSTOMER";
}

export type AppVariables = {
  requestId: string;
  tenant?: TenantContext;
  user?: UserContext;
  subdomain?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
