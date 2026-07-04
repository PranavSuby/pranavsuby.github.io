export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon: Icon,
  iconSize,
  disabled,
  onClick,
  type = 'button',
  className = '',
  ...props
}) {
  const sz = iconSize ?? (size === 'sm' ? 13 : size === 'lg' ? 18 : 15);
  const cls = ['ui-btn', `ui-btn--${variant}`, `ui-btn--${size}`,
    fullWidth && 'ui-btn--full', className].filter(Boolean).join(' ');

  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} {...props}>
      {Icon && <Icon size={sz} />}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, size = 17, onClick, className = '', title, ...props }) {
  return (
    <button
      type="button"
      className={`ui-btn ui-btn--icon ${className}`}
      onClick={onClick}
      title={title}
      aria-label={props['aria-label'] ?? title}
      {...props}
    >
      <Icon size={size} />
    </button>
  );
}
