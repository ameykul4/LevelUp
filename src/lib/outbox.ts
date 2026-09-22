// Persistent local outbox for meal photos/voice notes snapped offline (§8.5B).
// IndexedDB, not memory, so a queued capture survives an app kill.

import type { MealSlot } from './types'

export interface PendingMeal {
  id: string
  userId: string
  date: string
  mealSlot: MealSlot
  kind: 'photo' | 'voice'
  base64: string
  mimeType: string
  note?: string
  grams?: number
  createdAt: number
}

const DB_NAME = 'levelup-outbox'
const STORE = 'pending-meals'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function addPendingMeal(item: PendingMeal): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getPendingMeals(): Promise<PendingMeal[]> {
  const db = await openDb()
  const items = await new Promise<PendingMeal[]>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as PendingMeal[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items
}

export async function removePendingMeal(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
