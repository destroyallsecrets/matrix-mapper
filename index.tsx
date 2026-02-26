import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

window.onerror = (msg, url, line, col, err) => {
  document.body.innerHTML = `<div style="color:#f00;background:#000;padding:40px;font-family:monospace;font-size:20px;">ERROR: ${msg}<br>Line: ${line}</div>`;
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
