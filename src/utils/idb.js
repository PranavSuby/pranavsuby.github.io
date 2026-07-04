// Open an IndexedDB database once and reuse the connection for the page lifetime
// instead of issuing a fresh openDB() on every read/write. The cached promise is
// cleared if the connection closes (e.g. a version change in another tab) so the
// next call transparently re-opens.
export function memoizeOpen(open) {
  let conn = null;
  return () => {
    if (!conn) {
      conn = Promise.resolve(open()).then(
        db => {
          db.addEventListener?.('close', () => { conn = null; });
          return db;
        },
        err => {
          // Don't cache a rejected open (transient quota/private-mode failures would
          // otherwise poison every future DB call for the page lifetime).
          conn = null;
          throw err;
        }
      );
    }
    return conn;
  };
}
