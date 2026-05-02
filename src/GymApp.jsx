import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, BookOpen, BarChart2, Home } from 'lucide-react';
import HomeScreen from './components/Home';
import WorkoutBuilder from './components/WorkoutBuilder';
import ExerciseLibrary from './components/ExerciseLibrary';
import ActiveSession from './components/ActiveSession';
import Metrics from './components/Metrics';
import './index.css';

const TABS = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'workouts', label: 'Workouts', icon: Dumbbell },
  { id: 'exercises', label: 'Library', icon: BookOpen },
  { id: 'metrics', label: 'Metrics', icon: BarChart2 },
];

export default function App() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('home');
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [newWorkoutPending, setNewWorkoutPending] = useState(false);

  const handleStartWorkout = (workout) => setActiveWorkout(workout);

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
          {tab === 'home' && <HomeScreen onStartWorkout={handleStartWorkout} onNewWorkout={handleNewWorkout} />}
          {tab === 'workouts' && (
            <WorkoutBuilder
              autoCreate={newWorkoutPending}
              onAutoCreateDone={() => setNewWorkoutPending(false)}
            />
          )}
          {tab === 'exercises' && <ExerciseLibrary />}
          {tab === 'metrics' && <Metrics />}
        </>
      )}

      <nav className="bottom-nav">
        <button className="nav-btn" onClick={() => navigate('/')} title="Back to home">
          <Home />
          <span style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Apps</span>
        </button>
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
