import { get, set, del } from 'idb-keyval';

const STORE_PREFIX = 'causalchain_v1_';

export async function saveToIndexedDb<T>(key: string, value: T): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await set(`${STORE_PREFIX}${key}`, value);
    } else if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(value));
    }
  } catch {
    // Fallback to localStorage if IndexedDB is blocked in headless context
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`${STORE_PREFIX}${key}`, JSON.stringify(value));
      }
    } catch {
      // Ignore storage quota errors
    }
  }
}

export async function loadFromIndexedDb<T>(key: string): Promise<T | null> {
  try {
    if (typeof indexedDB !== 'undefined') {
      const val = await get<T>(`${STORE_PREFIX}${key}`);
      if (val !== undefined) return val;
    }
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(`${STORE_PREFIX}${key}`);
      if (raw) return JSON.parse(raw) as T;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearIndexedDbKey(key: string): Promise<void> {
  try {
    if (typeof indexedDB !== 'undefined') {
      await del(`${STORE_PREFIX}${key}`);
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORE_PREFIX}${key}`);
    }
  } catch {
    // Ignore
  }
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const csvLines = [
    headers.join(','),
    ...rows.map((r) =>
      r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
