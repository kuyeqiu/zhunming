import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerServiceWorker } from './registerServiceWorker';
import { registerDeploymentRecovery } from './lib/deployment-recovery';
import { applyWorkspaceTheme, readWorkspacePreferences } from './lib/workspace';
import { applyInkMode, readInkMode } from './lib/ink-theme';
import './styles.css';
import './workspace.css';
import './workspace-ui.css';
import './traditional-charts.css';
// 水墨设计基座：纯增量层（--paper-* / --ink-* / .ink-*），必须最后引入
import './styles/ink-tokens.css';

applyWorkspaceTheme(readWorkspacePreferences().theme);
applyInkMode(readInkMode());
registerDeploymentRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

registerServiceWorker();
