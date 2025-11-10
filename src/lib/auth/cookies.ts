export type CookieGetter = {
  get(name: string): { value?: string } | undefined;
};

export function getAuthenticatedUserId(cookieStore: CookieGetter) {
  return (
    cookieStore.get('fb-user-id')?.value ??
    cookieStore.get('fb-auth-user')?.value ??
    null
  );
}
