import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from './HomePage';
import GymApp from './GymApp';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/gym-app/*" element={<GymApp />} />
      </Routes>
    </BrowserRouter>
  );
}
