const DB_NAME = 'baatkart-tiles'
const DB_VERSION = 1
const STORE = 'tiles'

let db: IDBDatabase | null = null

function openDb(): Promise<IDBDatabase> {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const d = req.result
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => { db = req.result; resolve(db) }
    req.onerror = () => reject(req.error)
  })
}

export async function saveTile(key: string, blob: Blob): Promise<void> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function getTile(key: string): Promise<Blob | null> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function hasTile(key: string): Promise<boolean> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).getKey(key)
    req.onsuccess = () => resolve(req.result !== undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function countExistingTiles(keys: string[]): Promise<number> {
  const d = await openDb()
  return new Promise((resolve) => {
    const tx = d.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    let found = 0
    let pending = keys.length
    if (pending === 0) { resolve(0); return }
    keys.forEach((k) => {
      const req = store.getKey(k)
      req.onsuccess = () => {
        if (req.result !== undefined) found++
        if (--pending === 0) resolve(found)
      }
      req.onerror = () => { if (--pending === 0) resolve(found) }
    })
  })
}

export async function countTiles(): Promise<number> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE, 'readonly').objectStore(STORE).count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function deleteTiles(keys: string[]): Promise<void> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    keys.forEach((k) => store.delete(k))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function clearAllTiles(): Promise<void> {
  const d = await openDb()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).clear()
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function estimateStorageMB(): Promise<number> {
  if (!navigator.storage?.estimate) return 0
  const { usage } = await navigator.storage.estimate()
  return Math.round((usage ?? 0) / 1024 / 1024)
}
