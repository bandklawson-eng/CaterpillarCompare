import { render } from 'preact';
import { App } from './ui/App';
import './styles.css';

render(<App />, document.getElementById('app')!);

// Offline support once built and served (not in the dev server).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline mode unavailable */ });
  });
}
