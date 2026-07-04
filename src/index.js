import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

// Register the service worker for offline support. Served from the site root so its
// scope covers every app. Failures are non-fatal (e.g. unsupported / private mode).
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    const url = `${process.env.PUBLIC_URL || ''}/service-worker.js`;
    navigator.serviceWorker.register(url).catch(() => {});
  });
}
