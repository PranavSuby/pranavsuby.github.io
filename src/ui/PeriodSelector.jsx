export default function PeriodSelector({ options, value, onChange }) {
  return (
    <div className="ui-period-sel">
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          className={`ui-period-btn${value === o.id ? ' active' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
