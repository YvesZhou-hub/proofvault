import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import HealthApp from './health/HealthApp.jsx';
import './index.css';

// The hospital product is the default. The earlier multi-sector workspace and the teammate's
// hand-off review flows stay reachable with ?classic or ?review=… .
const params = new URLSearchParams(window.location.search);
const Root = HealthApp;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
