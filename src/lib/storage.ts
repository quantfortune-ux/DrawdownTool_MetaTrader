import { DEFAULT_INSTRUMENT_PROFILES } from '../data/instruments'
import type { ClientRecord, InstrumentKey, InstrumentProfile } from '../types'

const CLIENT_STORAGE_KEY = 'riskdesk.clients.v1'
const PROFILE_STORAGE_KEY = 'riskdesk.instrumentProfiles.v2'

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export function loadClients(): ClientRecord[] {
  if (typeof window === 'undefined') {
    return []
  }

  return parseJson<ClientRecord[]>(
    window.localStorage.getItem(CLIENT_STORAGE_KEY),
    [],
  )
}

export function saveClients(clients: ClientRecord[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(clients))
}

export function loadInstrumentProfiles(): Record<InstrumentKey, InstrumentProfile> {
  if (typeof window === 'undefined') {
    return DEFAULT_INSTRUMENT_PROFILES
  }

  return {
    ...DEFAULT_INSTRUMENT_PROFILES,
    ...parseJson<Record<InstrumentKey, InstrumentProfile>>(
      window.localStorage.getItem(PROFILE_STORAGE_KEY),
      DEFAULT_INSTRUMENT_PROFILES,
    ),
  }
}

export function saveInstrumentProfiles(
  profiles: Record<InstrumentKey, InstrumentProfile>,
): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles))
}
