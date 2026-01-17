export interface AuthConfig {
  jwksUri?: string;
  secret?: string;
  issuer?: string[];
  audience?: string[];
  algorithms: string[];
  rolesClaim: string;
  scopesClaim: string;
  scopesDelimiter: string;
}
