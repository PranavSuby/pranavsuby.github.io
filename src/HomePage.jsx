import { useNavigate } from 'react-router-dom';
import { Dumbbell, Salad, ArrowUpRight } from 'lucide-react';

const tools = [
  {
    id: 'gym',
    index: '01',
    title: 'Gym Tracker',
    version: '1.17.0',
    description: 'Log workouts, track progress, and build routines.',
    icon: Dumbbell,
    path: '/gym-app',
  },
  {
    id: 'nutricore',
    index: '02',
    title: 'NutriCore',
    version: '0.26.0',
    description: 'Track food, macros, and calories. Offline-first food diary.',
    icon: Salad,
    path: '/nutricore',
  },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="homepage">
      <div className="hp-inner">
        <header className="hp-header">
          <div className="hp-eyebrow">pranavsuby.github.io</div>
          <h1 className="hp-title">Web Apps</h1>
          <p className="hp-sub">Web applications customized by me, for me.</p>
        </header>
        <div className="hp-grid">
          {tools.map(({ id, index, title, version, description, icon: Icon, path }) => (
            <button key={id} className="tool-card" onClick={() => navigate(path)}>
              <div className="tool-card-index">{index}</div>
              <div className="tool-card-icon"><Icon size={26} /></div>
              <div className="tool-card-title">{title}</div>
              <div className="tool-card-version">v{version}</div>
              <div className="tool-card-desc">{description}</div>
              <div className="tool-card-arrow"><ArrowUpRight size={18} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
