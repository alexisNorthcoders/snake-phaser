export interface StoredUser {
  token?: string
  username?: string
  userId?: string | number
  expiresIn?: number
  /** Set by the guest login. Sessions stored before this flag existed don't have it. */
  isGuest?: boolean
}

/** Before the flag existed, guests were stored with this fixed name. */
const LEGACY_GUEST_NAME = 'anonymous'

/** An explicit flag wins; only a session stored without one falls back to the legacy guest name. */
export function isGuest(user: Pick<StoredUser, 'isGuest' | 'username'>): boolean {
  return user.isGuest ?? user.username === LEGACY_GUEST_NAME
}

/**
 * The name a session plays under. Guests use their remembered name; logged-in players use their
 * account username. Read-only: the remembered guest name is never written or cleared here.
 */
export function sessionName(user: StoredUser, store: { load(): string }): string {
  return isGuest(user) ? store.load() : (user.username ?? LEGACY_GUEST_NAME);
}
