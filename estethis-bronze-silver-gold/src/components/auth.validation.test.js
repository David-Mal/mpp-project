// ─────────────────────────────────────────────────────────────
// AUTH FORM VALIDATION TESTS
// Tests the client-side validation rules for the Register form
// and the login form (email / password presence checks).
// Runs in node environment — no DOM required.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';

// ── Validation logic mirrored from RegisterPage ───────────────
// These rules are the canonical client-side checks; if RegisterPage
// changes them these tests should be updated in tandem.

function validateRegister({ phone, email, password, confirm }) {
  const errs = {};
  if (!phone || !phone.trim())         errs.phone    = 'Phone required.';
  if (!email || !email.includes('@'))   errs.email    = 'Valid email required.';
  if (!password || password.length < 6) errs.password = 'Min 6 characters.';
  if (password !== confirm)             errs.confirm  = "Passwords don't match.";
  return errs;
}

function validateLogin({ email, password }) {
  const errs = {};
  if (!email || !email.trim())    errs.email    = 'Email required.';
  if (!password || !password.trim()) errs.password = 'Password required.';
  return errs;
}

// ─────────────────────────────────────────────────────────────

const VALID_REGISTER = {
  phone:    '+40700000000',
  email:    'user@example.com',
  password: 'secret123',
  confirm:  'secret123',
};

// ── Register validation ───────────────────────────────────────

describe('validateRegister', () => {
  it('returns no errors for a fully valid form', () => {
    expect(Object.keys(validateRegister(VALID_REGISTER))).toHaveLength(0);
  });

  it('requires phone', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '' });
    expect(errs.phone).toBeTruthy();
  });

  it('requires phone — whitespace-only is rejected', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '   ' });
    expect(errs.phone).toBeTruthy();
  });

  it('requires @ in email', () => {
    const errs = validateRegister({ ...VALID_REGISTER, email: 'notanemail' });
    expect(errs.email).toBeTruthy();
  });

  it('accepts email with @', () => {
    const errs = validateRegister({ ...VALID_REGISTER, email: 'a@b.com' });
    expect(errs.email).toBeUndefined();
  });

  it('rejects password shorter than 6 characters', () => {
    const errs = validateRegister({ ...VALID_REGISTER, password: '12345', confirm: '12345' });
    expect(errs.password).toBeTruthy();
  });

  it('accepts password of exactly 6 characters', () => {
    const errs = validateRegister({ ...VALID_REGISTER, password: '123456', confirm: '123456' });
    expect(errs.password).toBeUndefined();
  });

  it('rejects empty password', () => {
    const errs = validateRegister({ ...VALID_REGISTER, password: '', confirm: '' });
    expect(errs.password).toBeTruthy();
  });

  it('rejects mismatched confirm password', () => {
    const errs = validateRegister({ ...VALID_REGISTER, confirm: 'different' });
    expect(errs.confirm).toBeTruthy();
  });

  it('accepts matching passwords', () => {
    const errs = validateRegister({ ...VALID_REGISTER, password: 'match123', confirm: 'match123' });
    expect(errs.confirm).toBeUndefined();
  });

  it('returns multiple errors when multiple fields are invalid', () => {
    const errs = validateRegister({ phone: '', email: 'bad', password: '123', confirm: 'xyz' });
    expect(Object.keys(errs).length).toBeGreaterThanOrEqual(3);
  });

  it('missing phone does not generate email error', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '' });
    expect(errs.email).toBeUndefined();
  });

  it('valid phone does not generate phone error', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '+1234567890' });
    expect(errs.phone).toBeUndefined();
  });
});

// ── Login validation ──────────────────────────────────────────

describe('validateLogin', () => {
  it('returns no errors for valid email and password', () => {
    expect(Object.keys(validateLogin({ email: 'a@b.com', password: 'pass' }))).toHaveLength(0);
  });

  it('requires email', () => {
    const errs = validateLogin({ email: '', password: 'pass' });
    expect(errs.email).toBeTruthy();
  });

  it('requires password', () => {
    const errs = validateLogin({ email: 'a@b.com', password: '' });
    expect(errs.password).toBeTruthy();
  });

  it('requires both fields', () => {
    const errs = validateLogin({ email: '', password: '' });
    expect(errs.email).toBeTruthy();
    expect(errs.password).toBeTruthy();
  });

  it('whitespace-only email is rejected', () => {
    const errs = validateLogin({ email: '   ', password: 'pass' });
    expect(errs.email).toBeTruthy();
  });

  it('whitespace-only password is rejected', () => {
    const errs = validateLogin({ email: 'a@b.com', password: '   ' });
    expect(errs.password).toBeTruthy();
  });

  it('only one error when only email is missing', () => {
    const errs = validateLogin({ email: '', password: 'pass' });
    expect(Object.keys(errs)).toHaveLength(1);
    expect(errs.email).toBeTruthy();
    expect(errs.password).toBeUndefined();
  });

  it('only one error when only password is missing', () => {
    const errs = validateLogin({ email: 'a@b.com', password: '' });
    expect(Object.keys(errs)).toHaveLength(1);
    expect(errs.password).toBeTruthy();
    expect(errs.email).toBeUndefined();
  });
});

// ── Cross-field interaction tests ─────────────────────────────

describe('validateRegister cross-field interactions', () => {
  it('password error does not affect phone error independently', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '', password: '123', confirm: '123' });
    expect(errs.phone).toBeTruthy();
    expect(errs.password).toBeTruthy();
    expect(errs.email).toBeUndefined();
  });

  it('confirm error is independent of email error', () => {
    const errs = validateRegister({ ...VALID_REGISTER, email: 'bad', confirm: 'notmatch' });
    expect(errs.email).toBeTruthy();
    expect(errs.confirm).toBeTruthy();
    expect(errs.phone).toBeUndefined();
  });

  it('all four errors when every field is invalid', () => {
    const errs = validateRegister({ phone: '', email: 'bad', password: '12', confirm: 'xyz' });
    expect(errs.phone).toBeTruthy();
    expect(errs.email).toBeTruthy();
    expect(errs.password).toBeTruthy();
    expect(errs.confirm).toBeTruthy();
  });

  it('no errors when confirm matches a long password', () => {
    const long = 'a-very-long-secure-password-123!@#';
    const errs = validateRegister({ ...VALID_REGISTER, password: long, confirm: long });
    expect(errs.password).toBeUndefined();
    expect(errs.confirm).toBeUndefined();
  });

  it('confirm error when passwords differ by one character', () => {
    const errs = validateRegister({ ...VALID_REGISTER, password: 'secret1', confirm: 'secret2' });
    expect(errs.confirm).toBeTruthy();
  });

  it('phone with only spaces gives phone error', () => {
    const errs = validateRegister({ ...VALID_REGISTER, phone: '     ' });
    expect(errs.phone).toBeTruthy();
  });

  it('email with @ but nothing after domain still accepted by @ check', () => {
    // Our check is minimal (includes '@') — this tests the boundary behaviour.
    const errs = validateRegister({ ...VALID_REGISTER, email: 'user@' });
    expect(errs.email).toBeUndefined(); // passes the @ check
  });

  it('email with no @ gives email error regardless of other fields', () => {
    const errs = validateRegister({ ...VALID_REGISTER, email: 'notanemail.com' });
    expect(errs.email).toBeTruthy();
  });
});
