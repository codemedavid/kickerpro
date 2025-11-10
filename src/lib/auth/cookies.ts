import type { RequestCookies } from 'next/dist/server/web/spec-extension/cookies';

const AUTH_COOKIE_NAMES = ['fb-user-id', 'fb-auth-user'] as const;

type AuthCookieName = (typeof AUTH_COOKIE_NAMES)[number];

export function getUserIdFromCookies(cookieStore: RequestCookies): string | null {
  for (const name of AUTH_COOKIE_NAMES) {
    const value = cookieStore.get(name)?.value;
    if (value) {
      return value;
    }
  }
  return null;
}

export function getCookieDebugState(cookieStore: RequestCookies): Record<AuthCookieName, string> {
  return AUTH_COOKIE_NAMES.reduce<Record<AuthCookieName, string>>((acc, name) => {
    acc[name] = cookieStore.get(name)?.value ? 'Present' : 'Missing';
    return acc;
  }, {} as Record<AuthCookieName, string>);
}
