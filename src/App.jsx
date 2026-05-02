// App.jsx
import { useState } from 'react';
import { LayoutDashboard, Dumbbell, BookOpen, Search } from 'lucide-react';
import Home from './components/Home';
import WorkoutBuilder from './components/WorkoutBuilder';
import ExerciseLibrary from './components/ExerciseLibrary';
import ActiveSession from './components/ActiveSession';
import './index.css';

const TABS = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'exercises', label: 'Library', icon: BookOpen },
];

export default function App() {
  const [tab, setTab] = useState('home');
  const [activeWorkout, setActiveWorkout] = useState(null); // null or workout object

  const handleStartWorkout = (workout) => {
    setActiveWorkout(workout);
  };

  const handleFinishSession = () => {
    setActiveWorkout(null);
    setTab('home');
  };

  return (
    <div className="app">
      {/* Active session takes over the full screen */}
      {activeWorkout ? (
        <ActiveSession
          workout={activeWorkout}
          onFinish={handleFinishSession}
          onCancel={() => setActiveWorkout(null)}
        />
      ) : (
        <>
          {tab === 'home' && <Home onStartWorkout={handleStartWorkout} />}
          {tab === 'workouts' && <WorkoutBuilder />}
          {tab === 'exercises' && <ExerciseLibrary />}
        </>
      )}

      {/* Bottom nav — always visible */}
      <nav className="bottom-nav">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-btn ${tab === id && !activeWorkout ? 'active' : ''}`}
            onClick={() => { setActiveWorkout(null); setTab(id); }}
          >
            <Icon />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}
