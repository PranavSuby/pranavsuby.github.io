import { createContext, useContext } from 'react';

// Lets hooks (e.g. useBackClose) know whether they're inside a hidden KeepAlive subtree.
// Nested KeepAlives AND together: a child is only "visible" if every ancestor is active.
export const KeepAliveActiveContext = createContext(true);

// Keeps children mounted (preserving their state) while visually hiding them when
// inactive, instead of unmounting on tab switch. Uses `display: contents` so the
// wrapper itself adds no box to the layout when active.
export default function KeepAlive({ active, children }) {
  const parentActive = useContext(KeepAliveActiveContext);
  return (
    <KeepAliveActiveContext.Provider value={parentActive && active}>
      <div style={{ display: active ? 'contents' : 'none' }}>
        {children}
      </div>
    </KeepAliveActiveContext.Provider>
  );
}
