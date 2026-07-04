import { Component } from 'react';

// Last-resort catch for render errors so a crash shows a recoverable screen
// instead of a blank white page (there is no server to report to — data lives
// in IndexedDB and survives a reload).
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
        background: '#0C0C18', color: '#E5E7EB', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</div>
        <div style={{ fontSize: 14, color: '#9CA3AF', maxWidth: 420 }}>
          The app hit an unexpected error. Your data is safe — reloading usually fixes it.
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', maxWidth: 420, wordBreak: 'break-word' }}>
          {String(this.state.error?.message || this.state.error)}
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 8, padding: '12px 28px', borderRadius: 12, border: 'none',
            background: '#6366F1', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Reload App
        </button>
      </div>
    );
  }
}
