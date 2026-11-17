// A seeded generator (mulberry32) wrapped in an object: the same seed always gives
// the same stream, so screenshot scenes and balance tests are deterministic while
// live games seed from Math.random.

export function createRandom(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return {
    next() {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    },
    /** A float in [min, max). */
    range(min, max) {
      return min + this.next() * (max - min);
    },
    /** An integer in [min, max], both ends included. */
    int(min, max) {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    /** True with the given probability. */
    chance(probability) {
      return this.next() < probability;
    },
    /** One element of an array, uniformly. */
    pick(items) {
      return items[Math.floor(this.next() * items.length)];
    },
  };
}
