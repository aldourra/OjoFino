// Registro del service worker (uso sin internet), aviso de versión nueva
// y solicitud de almacenamiento persistente.

export function iniciarModoSinConexion({ ocupado = () => false } = {}) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  const aviso = document.getElementById('aviso-version');
  let recargando = false;

  function mostrarAviso(worker) {
    aviso.hidden = false;
    aviso.querySelector('button').onclick = () => {
      if (ocupado()) { aviso.querySelector('span').textContent = 'Termina la revisión en curso y vuelve a intentarlo.'; return; }
      worker.postMessage('actualizar');
    };
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });

  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) mostrarAviso(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo.addEventListener('statechange', () => {
        // Solo hay "versión nueva" si ya había una versión controlando la página.
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrarAviso(nuevo);
      });
    });
    // Buscar actualizaciones al volver a la app.
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => { /* sin service worker la app funciona igual, solo que no sin conexión */ });

  // Pide que el navegador no borre los ajustes por falta de espacio o de uso.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}
