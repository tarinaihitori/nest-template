export interface JwtPayload {
  sub: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  [key: string]: unknown;
}
