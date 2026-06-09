# DeutschQuest

Aplicación React para convertir material de alemán en flashcards organizadas por
carpetas, nivel y tema. La interfaz sigue la estructura visual y de estudio de
KanaQuest.

## Ejecutar

```bash
npm install
npm run dev
```

La aplicación usa React con TypeScript y Webpack. Para generar la versión de
producción:

```bash
npm run build
```

## Estructura de importación

Cada PDF se procesa en este orden:

1. Identificar nivel, unidad y tema.
2. Separar vocabulario, verbos, expresiones y reglas gramaticales.
3. Conservar artículo y plural en sustantivos.
4. Añadir conjugación relevante en verbos.
5. Crear una oración de ejemplo cuando el material la incluya.
6. Asignar cada tarjeta a una carpeta temática.

Formato final:

```ts
{
  folderId: "a1-home",
  german: "das Haus",
  spanish: "la casa",
  example: "Das Haus ist sehr alt.",
  kind: "Sustantivo",
  note: "Plural: die Häuser"
}
```

Actualmente incluye contenido inicial de demostración. Los PDFs de alemán
deben agregarse al repositorio para extraer y clasificar su contenido real.
