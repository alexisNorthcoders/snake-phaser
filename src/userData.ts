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
