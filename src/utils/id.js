// Single source for client-side unique id generation.
// Time-prefixed so ids sort roughly chronologically; random suffix avoids
// collisions within the same millisecond.
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
