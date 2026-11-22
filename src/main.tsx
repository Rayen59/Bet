import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { SlipProvider } from './context/SlipContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <AuthProvider>
      <SlipProvider>
        <App />
      </SlipProvider>
    </AuthProvider>
  </ToastProvider>
);
