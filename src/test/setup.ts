/**
 * Node-environment polyfills for the browser APIs the store's persistence
 * layers touch at module scope (localStorage reads during store creation).
 * vitest setupFiles execute BEFORE the test module and its import graph, so
 * every import sees these globals.
 */
class MemoryStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const g = globalThis as typeof globalThis & { window?: unknown };

g.localStorage = new MemoryStorage() as unknown as Storage;
// `typeof window === 'undefined'` guards flip to the browser path; `window`
// points at globalThis so `window.localStorage` resolves to the same store.
g.window = g as unknown as Window & typeof globalThis;
