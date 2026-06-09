export type Level = "A1" | "A2" | "B1" | "B2";
export type CardKind = "Sustantivo" | "Verbo" | "Expresion";

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
  kind: CardKind;
  note?: string;
};
