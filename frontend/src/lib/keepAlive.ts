// Pings the backend every 10 minutes to prevent Render free tier spin-down
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const INTERVAL = 10 * 60 * 1000; // 10 minutes

export function startKeepAlive() {
  // Ping immediately on load
  ping();
  // Then every 10 minutes
  setInterval(ping, INTERVAL);
}

function ping() {
  fetch(`${API_URL}/health`, { method: 'GET' })
    .catch(() => {}); // silent fail — we don't care about errors here
}
