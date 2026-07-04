import { useId } from 'react';

export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  suffix,
  className = '',
  ...props
}) {
  const autoId = useId();
  const inputId = props.id ?? (label ? autoId : undefined);
  return (
    <div className="ui-field">
      {label && <label className="ui-label" htmlFor={inputId}>{label}</label>}
      <div className="ui-input-wrap">
        <input
          id={inputId}
          className={`ui-input${suffix ? ' ui-input--has-suffix' : ''}${className ? ' ' + className : ''}`}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          {...props}
        />
        {suffix && <span className="ui-input-suffix">{suffix}</span>}
      </div>
    </div>
  );
}
