import type { Flashcard, Folder, Section } from "./types";

export const importedFolderCounts: Record<string, number> = {
  "extras-verb-prepositions": 366,
  "extras-object-case-verbs": 257,
  "a1-b1-irregular-perfect": 284,
  "extras-basic-case-verbs": 109,
};

export const starterSections: Section[] = [
  { id: "A1", name: "A1" },
  { id: "A2", name: "A2" },
  { id: "B1", name: "B1" },
  { id: "B2", name: "B2" },
  { id: "Extras", name: "Extras" },
  { id: "A1-B1", name: "A1-B1" },
];

export const starterFolders: Folder[] = [
  { id: "a1-basics", name: "Primeros pasos", level: "A1", description: "Saludos y frases esenciales", color: "#f59e0b" },
  { id: "a1-home", name: "Casa y objetos", level: "A1", description: "Vocabulario cotidiano", color: "#10b981" },
  { id: "a1-verbs", name: "Verbos esenciales", level: "A1", description: "Acciones para comenzar", color: "#6366f1" },
  { id: "a2-travel", name: "Viajes", level: "A2", description: "Moverse y pedir ayuda", color: "#ec4899" },
  { id: "b1-work", name: "Trabajo", level: "B1", description: "Entorno profesional", color: "#0ea5e9" },
  { id: "extras-verb-prepositions", name: "Verbos con preposición", level: "Extras", description: "Verbos, preposiciones y casos del material", color: "#8b5cf6" },
  { id: "extras-object-case-verbs", name: "Verbos con objeto Dativ y Akkusativ", level: "Extras", description: "Verbos organizados según el objeto que requieren", color: "#0f766e" },
  { id: "a1-b1-irregular-perfect", name: "Perfekt de verbos irregulares", level: "A1-B1", description: "Infinitivo, Präsens, Perfekt y ejemplos", color: "#c2410c" },
  { id: "extras-basic-case-verbs", name: "Verbos básicos con Akkusativ y Dativ", level: "Extras", description: "Verbos básicos con casos y ejemplos traducidos", color: "#2563eb" },
];

export const starterCards: Flashcard[] = [
  { id: "1", folderId: "a1-basics", german: "Guten Morgen", spanish: "Buenos días", example: "Guten Morgen! Wie geht es Ihnen?", kind: "Expresion" },
  { id: "2", folderId: "a1-basics", german: "Wie geht's?", spanish: "¿Cómo estás?", example: "Hallo Anna, wie geht's?", kind: "Expresion" },
  { id: "3", folderId: "a1-basics", german: "Danke schön", spanish: "Muchas gracias", example: "Danke schön für deine Hilfe.", kind: "Expresion" },
  { id: "4", folderId: "a1-home", german: "das Haus", spanish: "la casa", example: "Das Haus ist sehr alt.", kind: "Sustantivo", note: "Plural: die Häuser" },
  { id: "5", folderId: "a1-home", german: "der Tisch", spanish: "la mesa", example: "Das Buch liegt auf dem Tisch.", kind: "Sustantivo", note: "Plural: die Tische" },
  { id: "6", folderId: "a1-home", german: "die Tür", spanish: "la puerta", example: "Bitte schließen Sie die Tür.", kind: "Sustantivo", note: "Plural: die Türen" },
  { id: "7", folderId: "a1-verbs", german: "lernen", spanish: "aprender", example: "Ich lerne jeden Tag Deutsch.", kind: "Verbo", note: "ich lerne · du lernst · er lernt" },
  { id: "8", folderId: "a1-verbs", german: "sprechen", spanish: "hablar", example: "Sie spricht sehr gut Deutsch.", kind: "Verbo", note: "ich spreche · du sprichst · er spricht" },
  { id: "9", folderId: "a2-travel", german: "der Bahnhof", spanish: "la estación de tren", example: "Wo ist der Bahnhof?", kind: "Sustantivo", note: "Plural: die Bahnhöfe" },
  { id: "10", folderId: "a2-travel", german: "eine Fahrkarte", spanish: "un boleto", example: "Ich möchte eine Fahrkarte nach Berlin.", kind: "Expresion" },
  { id: "12", folderId: "b1-work", german: "die Bewerbung", spanish: "la solicitud de empleo", example: "Ich schreibe eine Bewerbung.", kind: "Sustantivo", note: "Plural: die Bewerbungen" },
];
