/* Datos legales y de contacto usados por las páginas públicas. */
window.LEGAL_CONFIG = {
  tradeName: 'Mundo de las Tenis',
  legalResponsibleName: 'Santiago Bastidas Cerón',
  contactEmail: 'santiago.bastidas2001@gmail.com',
  whatsappNumber: '573217430829',
  whatsappDisplay: '+57 321 743 0829',
  domain: 'https://mundodelastenis.online',
  lastUpdated: '1 de noviembre de 2026'
};

/* Mantiene centralizados los datos repetidos en las páginas legales. */
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
  document.querySelectorAll('[data-legal-responsible]').forEach((node) => {
    node.textContent = config.legalResponsibleName;
  });
  document.querySelectorAll('[data-legal-email]').forEach((node) => {
    node.textContent = config.contactEmail;
    if (node.tagName === 'A') node.href = `mailto:${config.contactEmail}`;
  });
});
