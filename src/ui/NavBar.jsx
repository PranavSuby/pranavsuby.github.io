export default function NavBar({ tabs, activeId, onSelect, iconSize = 20 }) {
  return (
    <nav className="app-nav">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`app-nav-btn${activeId === id ? ' active' : ''}`}
          aria-current={activeId === id ? 'page' : undefined}
          onClick={() => onSelect(id)}
        >
          <Icon size={iconSize} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
