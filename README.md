# Simple AI Chat

Chat simple en React + Vite + TypeScript + Tailwind que permite conversar con una IA local usando la API de LM Studio.

## Características
- Muestra el modelo cargado desde LM Studio.
- Animación "Thinking..." mientras responde.
- Interfaz moderna y responsiva.

## Instalación y uso

1. Clona este repositorio:
   ```sh
   git clone https://github.com/javert-galicia/simple-chat-ai
   cd simple-chat-ai
   ```
2. Instala las dependencias:
   ```sh
   npm install
   ```
3. Inicia tu instancia local de LM Studio y carga un modelo compatible.
4. Inicia la app:
   ```sh
   npm run dev
   ```
5. Accede a [http://localhost:5173](http://localhost:5173) en tu navegador.

## Despliegue en GitHub Pages

El sitio está preparado para ser desplegado en GitHub Pages desde la carpeta `docs/`.

Para construir la versión de producción y copiar los archivos a `docs/`:

```sh
npm run build
cp -r dist/* docs/
```

Luego configura GitHub Pages para servir desde la carpeta `/docs` en la rama principal.

---

Desarrollado por Javert Galicia · 2025
