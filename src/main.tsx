import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// El enlace de confirmación de Supabase vuelve con tokens en el hash: se lleva al usuario a Ajustes para iniciar sesión.
if (/(^#|&)(access_token|error_description|type=signup)/.test(location.hash)) {
  history.replaceState(null, '', `${location.pathname}#/ajustes`);
}

// Solicita almacenamiento persistente para que el navegador no borre los datos.
navigator.storage?.persist?.().catch(() => undefined);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
