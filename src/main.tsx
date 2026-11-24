import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { registerServiceWorker } from './registerServiceWorker';
import { registerDeploymentRecovery } from './lib/deployment-recovery';
import { applyWorkspaceTheme, readWorkspacePreferences } from './lib/workspace';
// 水墨设计基座：纯增量层（--paper-* / --ink-* / .ink-*），必须最后引入
// 结果页三栏工作台（排盘│解读│AI），在最末层覆盖 split 布局

applyWorkspaceTheme(readWorkspacePreferences().theme);
registerDeploymentRecovery();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

registerServiceWorker();

import './tailwind.css';
import './styles.css';
import './workspace.css';
import './workspace-ui.css';
import './traditional-charts.css';
import './styles/ink-tokens.css';
import './styles/result-workbench.css';
