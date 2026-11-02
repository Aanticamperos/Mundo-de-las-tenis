/* Completa los campos vacíos antes de publicar las políticas como versión definitiva. */
window.LEGAL_CONFIG = {
  tradeName: 'Mundo de las Tenis',
  legalResponsibleName: '',
  contactEmail: '',
  whatsappNumber: '573217430829',
  whatsappDisplay: '+57 321 743 0829',
  domain: 'https://mundodelastenis.online',
  lastUpdated: '1 de noviembre de 2026'
};

window.legalContact = function () {
  const config = window.LEGAL_CONFIG;
  const whatsapp = `<a href="https://wa.me/${config.whatsappNumber}" target="_blank" rel="noreferrer">WhatsApp ${config.whatsappDisplay}</a>`;
  const email = config.contactEmail ? ` o <a href="mailto:${config.contactEmail}">${config.contactEmail}</a>` : '';
  return `${whatsapp}${email}`;
};

/* Mantiene centralizados los datos de contacto repetidos en las páginas legales. */
document.addEventListener('DOMContentLoaded', () => {
  const config = window.LEGAL_CONFIG;
  document.querySelectorAll('[data-legal-updated]').forEach((node) => {
    node.textContent = `Última actualización: ${config.lastUpdated}`;
  });
  document.querySelectorAll('a[href^="https://wa.me/573217430829"]').forEach((link) => {
    link.href = link.href.replace('https://wa.me/573217430829', `https://wa.me/${config.whatsappNumber}`);
  });
  document.querySelectorAll('[data-legal-whatsapp]').forEach((node) => {
    node.textContent = config.whatsappDisplay;
  });
});
