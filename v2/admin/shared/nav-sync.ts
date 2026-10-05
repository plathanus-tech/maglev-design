/** Avisa o Navegador de Protótipo qual página/variante está aberta (só dentro de iframe). */
function post() {
  if (window.parent === window) return;
  window.parent.postMessage({ source: 'maglev-proto-nav', href: location.href }, '*');
}
post();
window.addEventListener('hashchange', post);
