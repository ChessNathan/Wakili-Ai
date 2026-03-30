const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export function startKeepAlive() {
  const ping = () => fetch(`${API}/health`).catch(() => {});
  ping();
  setInterval(ping, 10 * 60 * 1000);
}
