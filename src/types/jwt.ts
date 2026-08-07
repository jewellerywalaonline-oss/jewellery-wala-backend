export interface JwtPayload {
  _id: string;
  // No PII — role is re-read from DB on every request
}

export interface PasswordResetJwtPayload {
  email: string;
  otpHash: string;
  type: "password_reset";
}