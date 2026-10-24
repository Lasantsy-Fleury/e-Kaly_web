import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConfirmProvider } from './components/common/ConfirmModal.tsx';

createRoot(document.getElementById('root')!).render(
  <ConfirmProvider>
    <App />
  </ConfirmProvider>
);
