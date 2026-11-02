# Mundo de las Tenis

Tienda estática con carrito y cierre de pedido por WhatsApp.

## Administrar productos con Excel

1. Abre `catalogo.csv` usando Excel.
2. Cada fila es un producto. Conserva los nombres de las columnas.
3. Para las tallas usa el separador `|`: `38|39|40|41`.
4. En `imagen` pega una URL pública de la foto, o una ruta como `imagenes/mi-tenis.jpg` si subes la foto a una carpeta `imagenes` junto a la web.
5. Guarda como **CSV UTF-8 (delimitado por comas)** y reemplaza el archivo `catalogo.csv`.
6. Recarga la tienda: el catálogo nuevo aparecerá automáticamente.

## Abrir la tienda

Para que el navegador lea el catálogo, ábrela con un servidor local (por ejemplo, la extensión **Live Server** de VS Code) y entra en `index.html`. También puedes publicar esta carpeta en Netlify, Vercel o GitHub Pages.

El número de WhatsApp está configurado como `321 743 0829` y el Instagram como `@mundodelastenis` en `app.js` e `index.html`.

## Páginas legales

La tienda incluye estas rutas estáticas:

- `/politica-de-privacidad/`
- `/terminos-y-condiciones/`
- `/eliminacion-de-datos/`

Antes de publicarlas como versión jurídica definitiva, completa en `legal-config.js` los campos `legalResponsibleName` y `contactEmail` con la razón social o nombre completo del responsable del tratamiento y el correo para consultas de protección de datos. No se agregaron esos datos porque no estaban presentes en el proyecto. El WhatsApp comercial ya confirmado está centralizado en ese mismo archivo.

Al publicar en GitHub Pages, Netlify, Vercel u otro hosting estático, conserva las carpetas de estas rutas y sus archivos `index.html`; así funcionarán tanto desde el footer como al abrir cada URL directamente.
