import { useNavigate } from 'react-router-dom';
import { Dumbbell, ArrowUpRight } from 'lucide-react';

const tools = [
  {
    id: 'gym',
    index: '01',
    title: 'Gym Tracker',
    description: 'Log workouts, track progress, and build routines.',
    icon: Dumbbell,
    path: '/gym-app',
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
          {tools.map(({ id, index, title, description, icon: Icon, path }) => (
            <button key={id} className="tool-card" onClick={() => navigate(path)}>
              <div className="tool-card-index">{index}</div>
              <div className="tool-card-icon"><Icon size={26} /></div>
              <div className="tool-card-title">{title}</div>
              <div className="tool-card-desc">{description}</div>
              <div className="tool-card-arrow"><ArrowUpRight size={18} /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
