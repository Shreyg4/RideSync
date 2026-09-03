import { PASSWORD_MIN_LENGTH, USERNAME_MIN_LENGTH, USERNAME_PATTERN } from '@/src/domain/rules';

export type SignUpForm = {
  firstName: string;
  lastName: string;
  username: string;
  email: string;
};

export type SignUpFieldErrors = Partial<
  Record<'firstName' | 'lastName' | 'username' | 'email' | 'password' | 'confirmPassword', string>
>;

export type LoginFieldErrors = Partial<Record<'email' | 'password', string>>;

export const normalizeSignUpForm = (raw: SignUpForm): SignUpForm => ({
  firstName: raw.firstName.trim(),
  lastName: raw.lastName.trim(),
  username: raw.username.trim(),
  email: raw.email.trim().toLowerCase(),
});

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const validateSignUpForm = (
  form: SignUpForm,
  password: string,
  confirmPassword: string
): SignUpFieldErrors => {
  const next: SignUpFieldErrors = {};
  if (!form.firstName) next.firstName = 'Required';
  if (!form.lastName) next.lastName = 'Required';

  if (form.username.length < USERNAME_MIN_LENGTH)
    next.username = `At least ${USERNAME_MIN_LENGTH} characters`;
  else if (!USERNAME_PATTERN.test(form.username))
    next.username = 'Letters, numbers and underscores only';

  if (!form.email.includes('@')) next.email = 'Enter a valid email';
  if (password.length < PASSWORD_MIN_LENGTH) next.password = 'Password is not long enough';
  if (password !== confirmPassword) next.confirmPassword = 'Passwords do not match';
  return next;
};

export const validateLoginForm = (email: string, password: string): LoginFieldErrors => {
  const next: LoginFieldErrors = {};
  if (!email.includes('@')) next.email = 'Enter valid email';
  if (!password) next.password = 'Required';
  return next;
};

export const isUsernameCandidate = (candidate: string) =>
  candidate.length >= USERNAME_MIN_LENGTH && USERNAME_PATTERN.test(candidate);
