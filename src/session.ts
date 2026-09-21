import { isGuest, type StoredUser } from './userData.ts'

const STORAGE_KEY = 'userData'

export interface SessionDeps {
  fetch: typeof fetch
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined
  apiUrl?: string
}

function apiUrl(deps: SessionDeps): string {
  return deps.apiUrl ?? '/api'
}

// Storage access throws outright when site data is blocked, so every touch is guarded.
function readStored(deps: SessionDeps): StoredUser | undefined {
  try {
    const raw = deps.storage?.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : undefined
  } catch {
    return undefined
  }
}

function writeStored(deps: SessionDeps, user: StoredUser): void {
  try {
    deps.storage?.setItem(STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Blocked or full storage: the session just won't survive a reload.
  }
}

function clearStored(deps: SessionDeps): void {
  try {
    deps.storage?.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to clear if storage is blocked.
  }
}

/** Verifies a stored token. Returns the refreshed session, or undefined if there is none or it is invalid (in which case the stored session is cleared). */
export async function restoreSession(deps: SessionDeps): Promise<StoredUser | undefined> {
  const stored = readStored(deps)
  if (!stored) return undefined

  try {
    const response = await deps.fetch(`${apiUrl(deps)}/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${stored.token}`,
      },
    })

    if (response.ok) {
      const data = await response.json()

      if (data.message === 'Token is valid') {
        const user: StoredUser = {
          token: stored.token,
          username: data.user.username,
          userId: data.userId,
          expiresIn: data.expiresIn,
          // The server only knows the name, so carry the stored session's guest status over
          isGuest: isGuest(stored),
        }
        writeStored(deps, user)
        return user
      }
    }
  } catch (error) {
    console.error('Error verifying token:', error)
  }

  clearStored(deps)
  return undefined
}

/** POSTs /anonymous and stores the resulting guest session. */
export async function createGuestSession(deps: SessionDeps): Promise<StoredUser | undefined> {
  try {
    const res = await deps.fetch(`${apiUrl(deps)}/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    if (!res.ok) return undefined

    const data = await res.json()
    const user: StoredUser = {
      token: data.accessToken,
      username: 'anonymous',
      userId: data.userId,
      isGuest: true,
    }
    writeStored(deps, user)
    return user
  } catch (error) {
    console.error('Error creating guest session:', error)
    return undefined
  }
}
