/**
 * AppScreen — standard scrollable tab layout.
 * Usage:
 *   <AppScreen header={<StickyHeader />}>
 *     scrollable content
 *   </AppScreen>
 *
 * The header slot is sticky (flex-shrink: 0).
 * The body scrolls independently.
 */
export default function AppScreen({ header, children, noPadding = false, className = '' }) {
  return (
    <div className={`app-screen${className ? ' ' + className : ''}`}>
      {header && <div className="app-screen-header">{header}</div>}
      <div className={`app-screen-body${noPadding ? ' app-screen-body--bare' : ''}`}>
        {children}
      </div>
    </div>
  );
}
