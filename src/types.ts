export type Level = string;
export type CardKind = "Sustantivo" | "Verbo" | "Expresion";

export type Section = {
  id: string;
  name: string;
};

export type Folder = {
  id: string;
  name: string;
  level: Level;
  description: string;
  color: string;
};

export type Flashcard = {
  id: string;
  folderId: string;
  german: string;
  spanish: string;
  example: string;
  exampleSpanish?: string;
  kind: CardKind;
  note?: string;
};
