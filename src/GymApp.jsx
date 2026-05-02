import { useState } from 'react';
import { LayoutDashboard, Dumbbell, BookOpen } from 'lucide-react';
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
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [newWorkoutPending, setNewWorkoutPending] = useState(false);

  const handleStartWorkout = (workout) => {
    setActiveWorkout(workout);
  };

  const handleFinishSession = () => {
    setActiveWorkout(null);
    setTab('home');
  };

  const handleNewWorkout = () => {
    setNewWorkoutPending(true);
    setTab('workouts');
  };

  return (
    <div className="app">
      {activeWorkout ? (
        <ActiveSession
          workout={activeWorkout}
          onFinish={handleFinishSession}
          onCancel={() => setActiveWorkout(null)}
        />
      ) : (
        <>
          {tab === 'home' && <Home onStartWorkout={handleStartWorkout} onNewWorkout={handleNewWorkout} />}
          {tab === 'workouts' && (
            <WorkoutBuilder
              autoCreate={newWorkoutPending}
              onAutoCreateDone={() => setNewWorkoutPending(false)}
            />
          )}
          {tab === 'exercises' && <ExerciseLibrary />}
        </>
      )}

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
