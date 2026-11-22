// Sicherer Zugriff auf localStorage (funktioniert auch, wenn der
// Browser den Speicher blockiert – dann nur bis zum Neuladen).
const memory = new Map();

export const ls = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch {
      return memory.has(key) ? memory.get(key) : fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      memory.set(key, value);
    }
  },
  del(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignorieren */
    }
    memory.delete(key);
  },
};
