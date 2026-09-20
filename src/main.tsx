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

// Guard against html5-qrcode's fatal RenderedCameraImpl onabort and onerror throws
const originalOnabortDescriptor =
  Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'onabort') ||
  Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'onabort') ||
  Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'onabort');

const abortHandlerMap = new WeakMap<HTMLVideoElement, ((ev: UIEvent) => any) | null>();

try {
  Object.defineProperty(HTMLVideoElement.prototype, 'onabort', {
    configurable: true,
    enumerable: true,
    get() {
      return abortHandlerMap.get(this) || null;
    },
    set(handler) {
      if (typeof handler === 'function') {
        const safeHandler = function (this: HTMLVideoElement, ev: UIEvent) {
          try {
            return handler.call(this, ev);
          } catch (err: any) {
            const errStr = String(err?.message || err || '');
            if (errStr.includes('RenderedCameraImpl') || errStr.includes('onabort() called')) {
              // Benign camera abort during stream restart or cleanup
              return;
            }
            throw err;
          }
        };
        abortHandlerMap.set(this, safeHandler);
        if (originalOnabortDescriptor?.set) {
          originalOnabortDescriptor.set.call(this, safeHandler);
        }
      } else {
        abortHandlerMap.set(this, handler);
        if (originalOnabortDescriptor?.set) {
          originalOnabortDescriptor.set.call(this, handler);
        }
      }
    },
  });
} catch (e) {
  console.warn('Could not wrap HTMLVideoElement.prototype.onabort', e);
}

// Global safety handler for unhandled errors (including html5-qrcode string exceptions)
window.addEventListener(
  'error',
  (event) => {
    const msg = event.message || (typeof event.error === 'string' ? event.error : event.error?.message) || '';
    if (
      typeof msg === 'string' &&
      (msg.includes('RenderedCameraImpl') || msg.includes('onabort() called') || msg.includes('onerror() called'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
  },
  true
);

// Global safety handler for unhandled promise rejections in sandboxed preview iframe
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason?.message || String(reason || '');
  if (
    msg.includes('RenderedCameraImpl') ||
    msg.includes('onabort() called') ||
    msg.includes('onerror() called') ||
    msg.includes('interrupted because the media was removed') ||
    msg.includes('play() request was interrupted') ||
    msg.includes('Write permission denied') ||
    reason?.name === 'AbortError'
  ) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
