import { useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

const tools = [
  {
    id: 'gym',
    title: 'Gym Tracker',
    description: 'Log workouts, track exercises, and build routines',
    icon: Dumbbell,
    path: '/gym-app',
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="homepage">
      <header className="hp-header">
        <h1 className="hp-title">Pranav's Tools</h1>
        <p className="hp-sub">A collection of personal tools</p>
      </header>
      <div className="hp-grid">
        {tools.map(({ id, title, description, icon: Icon, path }) => (
          <button key={id} className="tool-card" onClick={() => navigate(path)}>
            <div className="tool-card-icon">
              <Icon size={24} />
            </div>
            <div className="tool-card-info">
              <div className="tool-card-title">{title}</div>
              <div className="tool-card-desc">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
