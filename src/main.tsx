import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useDataStore } from './store/data';
import { startPlanSync } from './store/plan';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

startPlanSync();
void useDataStore.getState().load();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
