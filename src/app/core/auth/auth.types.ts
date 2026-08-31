export interface PersonIdentity {
  id: number;
  first_name: string;
  last_name: string;
  primary_email: string | null;
}

export interface AuthenticatedUser {
  id: number;
  email: string;
  person: PersonIdentity;
  staff_roles: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  uid: string;
  token: string;
  new_password: string;
  confirm_password: string;
}

export interface DetailResponse {
  detail: string;
}

export interface CsrfBootstrapResponse {
  detail: string;
}
