import type { Flashcard, Folder, Section } from "../types";
import { supabase } from "../lib/supabase";

export type DeutschQuestData = {
  sections: Section[];
  folders: Folder[];
  cards: Flashcard[];
};

export type DeutschQuestSyncState = "none" | "local-only" | "remote-only" | "out-of-sync" | "synced";

const SECTIONS_KEY = "dq-sections";
const FOLDERS_KEY = "dq-folders";
const CARDS_KEY = "dq-cards";

type DbSection = {
  id: string;
  name: string;
  created_at: string;
};

type DbFolder = {
  id: string;
  level: string;
  name: string;
  description: string;
  color: string;
  created_at: string;
};

type DbFlashcard = {
  id: string;
  folder_id: string;
  german: string;
  spanish: string;
  example: string;
  example_spanish: string | null;
  kind: Flashcard["kind"];
  note: string | null;
  created_at: string;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;

  if (error && typeof error === "object") {
    const supabaseError = error as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [
      supabaseError.message,
      supabaseError.details,
      supabaseError.hint,
      supabaseError.code ? `Codigo: ${supabaseError.code}` : undefined,
    ].filter(Boolean);

    if (parts.length) return parts.join(" ");
  }

  return fallback;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function getLocalDeutschQuestData(fallback: DeutschQuestData): DeutschQuestData {
  const sections = readLocal<Section[]>(SECTIONS_KEY, fallback.sections);
  const folders = readLocal<Folder[]>(FOLDERS_KEY, fallback.folders);
  const cards = readLocal<Flashcard[]>(CARDS_KEY, fallback.cards);
  const folderIds = new Set(folders.map((folder) => folder.id));

  return {
    sections,
    folders,
    cards: cards.filter((card) => folderIds.has(card.folderId)),
  };
}

export function saveLocalDeutschQuestData(data: DeutschQuestData) {
  localStorage.setItem(SECTIONS_KEY, JSON.stringify(data.sections));
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(data.folders));
  localStorage.setItem(CARDS_KEY, JSON.stringify(data.cards));
}

function hasData(data: DeutschQuestData) {
  return data.sections.length > 0 || data.folders.length > 0 || data.cards.length > 0;
}

function normalizeData(data: DeutschQuestData) {
  return JSON.stringify({
    sections: [...data.sections].sort((a, b) => a.id.localeCompare(b.id)),
    folders: [...data.folders].sort((a, b) => a.id.localeCompare(b.id)),
    cards: [...data.cards].sort((a, b) => a.id.localeCompare(b.id)),
  });
}

function mergeData(localData: DeutschQuestData, remoteData: DeutschQuestData): DeutschQuestData {
  const sections = new Map(remoteData.sections.map((section) => [section.id, section]));
  const folders = new Map(remoteData.folders.map((folder) => [folder.id, folder]));
  const cards = new Map(remoteData.cards.map((card) => [card.id, card]));

  localData.sections.forEach((section) => sections.set(section.id, section));
  localData.folders.forEach((folder) => folders.set(folder.id, folder));
  localData.cards.forEach((card) => cards.set(card.id, card));

  const mergedFolders = Array.from(folders.values());
  const folderIds = new Set(mergedFolders.map((folder) => folder.id));

  return {
    sections: Array.from(sections.values()),
    folders: mergedFolders,
    cards: Array.from(cards.values()).filter((card) => folderIds.has(card.folderId)),
  };
}

function getSyncState(localData: DeutschQuestData, remoteData: DeutschQuestData): DeutschQuestSyncState {
  const hasLocal = hasData(localData);
  const hasRemote = hasData(remoteData);

  if (!hasLocal && !hasRemote) return "none";
  if (hasLocal && !hasRemote) return "local-only";
  if (!hasLocal && hasRemote) return "remote-only";
  if (normalizeData(localData) === normalizeData(remoteData)) return "synced";

  return "out-of-sync";
}

async function getCurrentUserId() {
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || null;
}

function mapSectionFromDb(section: DbSection): Section {
  return { id: section.id, name: section.name };
}

function mapFolderFromDb(folder: DbFolder): Folder {
  return {
    id: folder.id,
    name: folder.name,
    level: folder.level,
    description: folder.description,
    color: folder.color,
  };
}

function mapCardFromDb(card: DbFlashcard): Flashcard {
  return {
    id: card.id,
    folderId: card.folder_id,
    german: card.german,
    spanish: card.spanish,
    example: card.example,
    exampleSpanish: card.example_spanish || undefined,
    kind: card.kind,
    note: card.note || undefined,
  };
}

export async function fetchRemoteDeutschQuestData(): Promise<DeutschQuestData> {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return { sections: [], folders: [], cards: [] };

  const [{ data: sections, error: sectionsError }, { data: folders, error: foldersError }, { data: cards, error: cardsError }] =
    await Promise.all([
      supabase.from("deutschquest_sections").select("id,name,created_at").order("created_at", { ascending: true }),
      supabase.from("deutschquest_folders").select("id,level,name,description,color,created_at").order("created_at", { ascending: true }),
      supabase
        .from("deutschquest_flashcards")
        .select("id,folder_id,german,spanish,example,example_spanish,kind,note,created_at")
        .order("created_at", { ascending: true }),
    ]);

  if (sectionsError) throw sectionsError;
  if (foldersError) throw foldersError;
  if (cardsError) throw cardsError;

  return {
    sections: (sections || []).map(mapSectionFromDb),
    folders: (folders || []).map(mapFolderFromDb),
    cards: (cards || []).map(mapCardFromDb),
  };
}

export async function uploadDeutschQuestData(data: DeutschQuestData) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const sectionRows = data.sections.map((section) => ({
    id: section.id,
    user_id: userId,
    name: section.name,
  }));
  const folderRows = data.folders.map((folder) => ({
    id: folder.id,
    user_id: userId,
    level: folder.level,
    name: folder.name,
    description: folder.description,
    color: folder.color,
  }));
  const folderIds = new Set(data.folders.map((folder) => folder.id));
  const cardRows = data.cards
    .filter((card) => folderIds.has(card.folderId))
    .map((card) => ({
      id: card.id,
      user_id: userId,
      folder_id: card.folderId,
      german: card.german,
      spanish: card.spanish,
      example: card.example,
      example_spanish: card.exampleSpanish || null,
      kind: card.kind,
      note: card.note || null,
    }));

  if (sectionRows.length) {
    const { error } = await supabase.from("deutschquest_sections").upsert(sectionRows, { onConflict: "id,user_id" });
    if (error) throw error;
  }

  if (folderRows.length) {
    const { error } = await supabase.from("deutschquest_folders").upsert(folderRows, { onConflict: "id,user_id" });
    if (error) throw error;
  }

  if (cardRows.length) {
    const { error } = await supabase.from("deutschquest_flashcards").upsert(cardRows, { onConflict: "id,user_id" });
    if (error) throw error;
  }
}

export async function replaceRemoteDeutschQuestData(data: DeutschQuestData) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error: cardsDeleteError } = await supabase.from("deutschquest_flashcards").delete().eq("user_id", userId);
  if (cardsDeleteError) throw cardsDeleteError;

  const { error: foldersDeleteError } = await supabase.from("deutschquest_folders").delete().eq("user_id", userId);
  if (foldersDeleteError) throw foldersDeleteError;

  const { error: sectionsDeleteError } = await supabase.from("deutschquest_sections").delete().eq("user_id", userId);
  if (sectionsDeleteError) throw sectionsDeleteError;

  await uploadDeutschQuestData(data);
}

export async function loadDeutschQuestData(fallback: DeutschQuestData) {
  const localData = getLocalDeutschQuestData(fallback);
  const userId = await getCurrentUserId();

  if (!supabase || !userId) {
    return {
      ...localData,
      isRemote: false,
      syncState: hasData(localData) ? ("local-only" as DeutschQuestSyncState) : ("none" as DeutschQuestSyncState),
    };
  }

  const remoteData = await fetchRemoteDeutschQuestData();
  const syncState = getSyncState(localData, remoteData);

  if (syncState === "remote-only") {
    saveLocalDeutschQuestData(remoteData);
    return { ...remoteData, isRemote: true, syncState: "synced" as DeutschQuestSyncState };
  }

  if (syncState === "local-only" || syncState === "out-of-sync") {
    const mergedData = mergeData(localData, remoteData);
    await replaceRemoteDeutschQuestData(mergedData);
    saveLocalDeutschQuestData(mergedData);
    return { ...mergedData, isRemote: true, syncState: "synced" as DeutschQuestSyncState };
  }

  saveLocalDeutschQuestData(remoteData);
  return { ...remoteData, isRemote: true, syncState };
}

export async function createRemoteSection(section: Section) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase.from("deutschquest_sections").insert({
    id: section.id,
    user_id: userId,
    name: section.name,
  });

  if (error) throw error;
}

export async function updateRemoteSection(section: Section, previousId?: string) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  if (previousId && previousId !== section.id) {
    const { error } = await supabase.from("deutschquest_sections").insert({
      id: section.id,
      user_id: userId,
      name: section.name,
    });
    if (error) throw error;

    const { error: foldersError } = await supabase.from("deutschquest_folders").update({ level: section.id }).eq("level", previousId).eq("user_id", userId);
    if (foldersError) throw foldersError;

    const { error: deleteError } = await supabase.from("deutschquest_sections").delete().eq("id", previousId).eq("user_id", userId);
    if (deleteError) throw deleteError;
    return;
  }

  const { error } = await supabase.from("deutschquest_sections").upsert({
    id: section.id,
    user_id: userId,
    name: section.name,
  }, {
    onConflict: "id,user_id",
  });

  if (error) throw error;
}

export async function deleteRemoteSection(id: string) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error: foldersError } = await supabase.from("deutschquest_folders").delete().eq("level", id).eq("user_id", userId);
  if (foldersError) throw foldersError;

  const { error } = await supabase.from("deutschquest_sections").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function createRemoteFolder(folder: Folder) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase.from("deutschquest_folders").insert({
    id: folder.id,
    user_id: userId,
    level: folder.level,
    name: folder.name,
    description: folder.description,
    color: folder.color,
  });

  if (error) throw error;
}

export async function updateRemoteFolder(folder: Folder) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase
    .from("deutschquest_folders")
    .update({
      level: folder.level,
      name: folder.name,
      description: folder.description,
      color: folder.color,
    })
    .eq("id", folder.id)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteRemoteFolder(id: string) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase.from("deutschquest_folders").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function createRemoteFlashcard(card: Flashcard) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase.from("deutschquest_flashcards").insert({
    id: card.id,
    user_id: userId,
    folder_id: card.folderId,
    german: card.german,
    spanish: card.spanish,
    example: card.example,
    example_spanish: card.exampleSpanish || null,
    kind: card.kind,
    note: card.note || null,
  });

  if (error) throw error;
}

export async function deleteRemoteFlashcard(id: string) {
  const userId = await getCurrentUserId();
  if (!supabase || !userId) return;

  const { error } = await supabase.from("deutschquest_flashcards").delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}
