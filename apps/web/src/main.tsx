import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router';
import { App } from '@/app/app';
import { AppErrorBoundary } from '@/app/app-error-boundary';
import { createAppStore } from '@/app/store';
import { setupListeners } from '@reduxjs/toolkit/query';
import '@/styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element is missing.');

const store = createAppStore();
setupListeners(store.dispatch);
createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter useTransitions={false}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
