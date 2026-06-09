# DeutschQuest

[English](#english) | [Español](#español)

## English

A React application for converting German learning materials into flashcards
organized by folder, level, and topic. The interface follows KanaQuest's visual
and study structure.

### Run

```bash
npm install
npm run dev
```

The application uses React with TypeScript and Webpack. To generate the
production build:

```bash
npm run build
```

### Import Structure

Each PDF is processed in this order:

1. Identify the level, unit, and topic.
2. Separate vocabulary, verbs, expressions, and grammar rules.
3. Preserve the article and plural form of nouns.
4. Add relevant verb conjugations.
5. Create an example sentence when one is included in the material.
6. Assign each card to a topic-based folder.

Final format:

```ts
{
  folderId: "a1-home",
  german: "das Haus",
  spanish: "la casa",
  example: "Das Haus ist sehr alt.",
  kind: "Noun",
  note: "Plural: die Häuser"
}
```

The application currently includes initial demo content. German-language PDFs
must be added to the repository to extract and classify their actual content.

## Español

Aplicación React para convertir material de alemán en flashcards organizadas por
carpetas, nivel y tema. La interfaz sigue la estructura visual y de estudio de
KanaQuest.

### Ejecutar

```bash
npm install
npm run dev
```

La aplicación usa React con TypeScript y Webpack. Para generar la versión de
producción:

```bash
npm run build
```

### Estructura de importación

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
