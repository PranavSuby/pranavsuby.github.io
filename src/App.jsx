import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './HomePage';
import GymApp from './GymApp';
import NutriCoreApp from './nutricore/NutriCoreApp';
import ErrorBoundary from './ui/ErrorBoundary';
import './index.css';
import './ui/ui.css';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gym-app/*" element={<GymApp />} />
          <Route path="/nutricore/*" element={<NutriCoreApp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
