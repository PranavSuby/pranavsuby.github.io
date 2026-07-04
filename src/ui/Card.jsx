export default function Card({
  children,
  padded = false,
  small = false,
  inset = false,
  onClick,
  className = '',
  style,
}) {
  const cls = ['ui-card',
    padded && 'ui-card--padded',
    small && 'ui-card--sm',
    inset && 'ui-card--inset',
    onClick && 'ui-card--clickable',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cls} style={style} onClick={onClick}>
      {children}
    </div>
  );
}
