const KEY = 'classic-solutions-found'

function readAll(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeAll(fingerprints: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(fingerprints))
}

export function getFoundCount(): number {
  return readAll().length
}

export function recordSolution(fingerprint: string): { isNew: boolean; total: number } {
  const found = readAll()
  if (found.includes(fingerprint)) {
    return { isNew: false, total: found.length }
  }
  found.push(fingerprint)
  writeAll(found)
  return { isNew: true, total: found.length }
}
