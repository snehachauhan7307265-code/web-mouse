import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Safely handle benign media play interruptions during view unmounting / modal closing
const originalPlay = HTMLMediaElement.prototype.play;
if (originalPlay) {
  HTMLMediaElement.prototype.play = function (...args) {
    try {
      const result = originalPlay.apply(this, args);
      if (result && typeof result.catch === 'function') {
        return result.catch((err: any) => {
          if (
            err?.name === 'AbortError' ||
            err?.message?.includes('interrupted') ||
            err?.message?.includes('removed from the document')
          ) {
            return; // Benign interruption during camera/modal closing
          }
          throw err;
        });
      }
      return result;
    } catch (err: any) {
      if (
        err?.name === 'AbortError' ||
        err?.message?.includes('interrupted')
      ) {
        return Promise.resolve();
      }
      throw err;
    }
  };
}

// Global safety handler for unhandled promise rejections in sandboxed preview iframe
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');
  if (
    msg.includes('interrupted because the media was removed') ||
    msg.includes('play() request was interrupted') ||
    msg.includes('Write permission denied') ||
    reason?.name === 'AbortError'
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
