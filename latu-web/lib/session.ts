// How long a sign-in lasts on one device before the password is asked again.
export const LOGIN_DAYS = Math.max(1, Number(process.env.LOGIN_DAYS) || 14);
export const LOGIN_MS = LOGIN_DAYS * 24 * 60 * 60 * 1000;
// Cookie holding the sign-in time on this device. It outlives the window so an expired sign-in can be detected.
export const AUTH_AT = 'latu-auth-at';
export const AUTH_AT_OPTS = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: 400 * 24 * 60 * 60 };
export const SB_COOKIE_OPTS = { maxAge: LOGIN_DAYS * 24 * 60 * 60 };
