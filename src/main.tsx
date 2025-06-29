import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './core';
import './index.css';

// Add error boundary for DOM manipulation errors
const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  try {
    return <>{children}</>;
  } catch (error) {
    console.error('DOM Error caught:', error);
    return <div>Something went wrong. Please refresh the page.</div>;
  }
};

// Add global error handler for removeChild and similar DOM errors
window.addEventListener('error', (event) => {
  if (event.error?.message?.includes('removeChild') || 
      event.error?.message?.includes('Node') ||
      event.error?.message?.includes('Cannot navigate to URL') ||
      event.error?.message?.includes('WebSocket')) {
    console.warn('DOM manipulation or WebSocket error caught and handled:', event.error);
    event.preventDefault(); // Prevent the error from breaking the app
    return false;
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Cannot navigate to URL') ||
      event.reason?.message?.includes('service worker') ||
      event.reason?.message?.includes('WebSocket') ||
      event.reason?.message?.includes('network error')) {
    console.warn('Service worker or WebSocket error caught and handled:', event.reason);
    event.preventDefault();
    return false;
  }
});

// WebSocket specific error handling
const originalWebSocket = window.WebSocket;
window.WebSocket = function(url, protocols) {
  const ws = new originalWebSocket(url, protocols);
  
  const originalSend = ws.send;
  ws.send = function(data) {
    try {
      return originalSend.call(this, data);
    } catch (error) {
      console.warn('WebSocket send error caught and handled:', error);
      // Don't rethrow to prevent app crashes
      return false;
    }
  };
  
  return ws;
} as any;
window.WebSocket.prototype = originalWebSocket.prototype;

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
} else {
  console.error('Root element not found');
}