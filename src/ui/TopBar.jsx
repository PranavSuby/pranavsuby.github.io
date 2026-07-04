import { ArrowLeft } from 'lucide-react';

export default function TopBar({
  title,
  subtitle,
  onBack,
  backLabel = 'Back',
  right,
  className = '',
}) {
  return (
    <div className={`app-topbar${className ? ' ' + className : ''}`}>
      {onBack && (
        <button
          className="ui-btn ui-btn--ghost ui-btn--sm"
          style={{ gap: 4, padding: '6px 12px 6px 9px' }}
          onClick={onBack}
        >
          <ArrowLeft size={15} />
          {backLabel}
        </button>
      )}
      {title && <span className="app-topbar-title">{title}</span>}
      {subtitle && <span className="app-topbar-subtitle">{subtitle}</span>}
      {right}
    </div>
  );
}
