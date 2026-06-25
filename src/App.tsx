import { useEffect, useMemo, useState, type FormEvent } from "react";
import Swal from "sweetalert2";
import { importedFolderCounts, starterCards, starterFolders, starterSections } from "./data";
import { useSupabaseAccount } from "./hooks/useSupabaseAccount";
import type { CardKind, Flashcard, Folder, Level, Section } from "./types";
import {
  createRemoteFlashcard,
  createRemoteFolder,
  createRemoteSection,
  deleteRemoteFlashcard,
  deleteRemoteFolder,
  deleteRemoteSection,
  getErrorMessage,
  loadDeutschQuestData,
  saveLocalDeutschQuestData,
  updateRemoteFolder,
  updateRemoteSection,
} from "./utils/deutschquestStorage";

const kinds: CardKind[] = ["Sustantivo", "Verbo", "Expresion"];
type StudyMode = "flashcard" | "multiple" | "write";
type AnswerState = "idle" | "correct" | "incorrect";
type StudyDirection = "de-es" | "es-de";
const importedFolderIds = new Set(Object.keys(importedFolderCounts));
const importVersion = "additional-pdfs-v1";
const libraryPageSize = 48;

function load<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function isGrammarFolder(folder: Folder) {
  const normalizedName = folder.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return folder.id.toLowerCase().includes("grammar") || normalizedName.includes("gramatica");
}

const fallbackData = {
  sections: starterSections,
  folders: starterFolders.filter((folder) => !isGrammarFolder(folder)),
  cards: starterCards,
};

function loadFolders() {
  const saved = load<Folder[]>("dq-folders", starterFolders);
  const additions = localStorage.getItem("dq-import-version") === importVersion
    ? []
    : starterFolders.filter((folder) => importedFolderIds.has(folder.id) && !saved.some((item) => item.id === folder.id));
  return [...saved, ...additions].filter((folder) => !isGrammarFolder(folder));
}

function loadSections() {
  const saved = load<Section[]>("dq-sections", starterSections);
  const folderLevels = loadFolders().map((folder) => folder.level);
  const importedLevels = localStorage.getItem("dq-import-version") === importVersion ? [] : ["A1-B1"];
  const missing = [...new Set([...folderLevels, ...importedLevels])].filter((level) => !saved.some((section) => section.id === level));
  return [...saved, ...missing.map((level) => ({ id: level, name: level }))];
}

function loadCards(validFolders: Folder[]) {
  const folderIds = new Set(validFolders.map((folder) => folder.id));
  const saved = load<Flashcard[]>("dq-cards", starterCards);
  return saved.filter(
    (card) => !card.id.startsWith("verb-prep-") && folderIds.has(card.folderId) && (card.kind as string) !== "Gramatica",
  );
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function showResultAlert(ok: boolean, title: string, message?: string) {
  await Swal.fire({
    icon: ok ? "success" : "error",
    title,
    text: message,
    confirmButtonText: "Entendido",
  });
}

export default function App() {
  const account = useSupabaseAccount();
  const [folders, setFolders] = useState<Folder[]>(loadFolders);
  const [sections, setSections] = useState<Section[]>(loadSections);
  const [cards, setCards] = useState<Flashcard[]>(() => loadCards(loadFolders()));
  const [importedCards, setImportedCards] = useState<Flashcard[]>([]);
  const [importedCardsLoading, setImportedCardsLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [isRemote, setIsRemote] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [visibleCardCount, setVisibleCardCount] = useState(libraryPageSize);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<Level | "Todos">("Todos");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"library" | "study">("library");
  const [studyMode, setStudyMode] = useState<StudyMode>("flashcard");
  const [studyCount, setStudyCount] = useState(10);
  const [studyDirection, setStudyDirection] = useState<StudyDirection>("es-de");
  const [studyIndex, setStudyIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [writtenAnswer, setWrittenAnswer] = useState("");
  const [answerState, setAnswerState] = useState<AnswerState>("idle");
  const [menuOpen, setMenuOpen] = useState(false);
  const [adding, setAdding] = useState<"folder" | "card" | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [currentView, setCurrentView] = useState<"home" | "account">("home");

  useEffect(() => {
    let isActive = true;

    async function loadData() {
      setDataLoading(true);
      setSyncError(null);

      try {
        const data = await loadDeutschQuestData(fallbackData);

        if (!isActive) return;

        setSections(data.sections);
        setFolders(data.folders);
        setCards(data.cards);
        setIsRemote(data.isRemote);
      } catch (err) {
        if (isActive) {
          setIsRemote(false);
          setSyncError(getErrorMessage(err, "No se pudo sincronizar Supabase."));
        }
      } finally {
        if (isActive) setDataLoading(false);
      }
    }

    void loadData();

    return () => {
      isActive = false;
    };
  }, [account.email]);

  useEffect(() => saveLocalDeutschQuestData({ sections, folders, cards }), [folders, sections, cards]);
  useEffect(() => localStorage.setItem("dq-import-version", importVersion), []);

  const activeImportedFolderIds = useMemo(() => new Set(folders.filter((item) => importedFolderIds.has(item.id)).map((item) => item.id)), [folders]);
  const allCards = useMemo(() => [...cards, ...importedCards.filter((card) => activeImportedFolderIds.has(card.folderId))], [cards, importedCards, activeImportedFolderIds]);
  const visibleFolders = folders.filter((folder) => activeLevel === "Todos" || folder.level === activeLevel);
  const activeSection = activeLevel === "Todos" ? undefined : sections.find((section) => section.id === activeLevel);
  const folder = folders.find((item) => item.id === selectedFolder);
  const folderCards = allCards.filter((card) => card.folderId === selectedFolder);
  const searchCards = query.trim()
    ? allCards.filter((card) => `${card.german} ${card.spanish} ${card.example} ${card.exampleSpanish ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    : [];
  const totalCardCount = cards.length + [...activeImportedFolderIds].reduce((total, id) => total + importedFolderCounts[id], 0);
  const totalStudied = Math.min(totalCardCount, 18);
  const progress = totalCardCount ? Math.round((totalStudied / totalCardCount) * 100) : 0;

  const shuffledFolderCards = useMemo(() => shuffled(folderCards), [selectedFolder, mode, allCards]);
  const currentStudyCards = studyMode === "flashcard"
    ? shuffledFolderCards
    : shuffledFolderCards.slice(0, Math.min(studyCount, shuffledFolderCards.length));
  const currentCard = currentStudyCards[studyIndex];
  const promptText = currentCard ? (studyDirection === "de-es" ? currentCard.german : currentCard.spanish) : "";
  const correctAnswer = currentCard ? (studyDirection === "de-es" ? currentCard.spanish : currentCard.german) : "";
  const multipleOptions = useMemo(() => {
    if (!currentCard) return [];
    const alternatives = allCards.filter((card) => card.id !== currentCard.id);
    return shuffled([currentCard, ...shuffled(alternatives).slice(0, 3)]);
  }, [currentCard, allCards, studyDirection]);

  async function loadImportedCards() {
    if (!activeImportedFolderIds.size || importedCards.length || importedCardsLoading) return;
    setImportedCardsLoading(true);
    try {
      const module = await import("./importedCards");
      setImportedCards(module.importedCards);
    } finally {
      setImportedCardsLoading(false);
    }
  }

  async function syncRemote(action: () => Promise<void>, fallbackMessage: string) {
    if (!account.isSignedIn) return;

    setSyncError(null);

    try {
      await action();
    } catch (err) {
      const message = getErrorMessage(err, fallbackMessage);
      setSyncError(message);
      await Swal.fire({
        icon: "error",
        title: "No se pudo sincronizar",
        text: message,
        confirmButtonText: "Entendido",
      });
      throw err;
    }
  }

  async function saveFolder(nextFolder: Folder, previousFolder?: Folder) {
    if (previousFolder) {
      setFolders((current) => current.map((item) => item.id === nextFolder.id ? nextFolder : item));
      await syncRemote(() => updateRemoteFolder(nextFolder), "No se pudo actualizar la carpeta.");
      return;
    }

    setFolders((current) => [...current, nextFolder]);
    await syncRemote(() => createRemoteFolder(nextFolder), "No se pudo guardar la carpeta.");
  }

  async function saveCard(card: Flashcard) {
    setCards((current) => [...current, card]);
    await syncRemote(() => createRemoteFlashcard(card), "No se pudo guardar la tarjeta.");
  }

  async function removeCard(card: Flashcard) {
    setCards((current) => current.filter((item) => item.id !== card.id));
    await syncRemote(() => deleteRemoteFlashcard(card.id), "No se pudo eliminar la tarjeta.");
  }

  useEffect(() => {
    if (query.trim()) void loadImportedCards();
  }, [query]);

  function resetQuestion(nextMode = studyMode) {
    setStudyMode(nextMode);
    setShowAnswer(false);
    setWrittenAnswer("");
    setAnswerState("idle");
    setSessionComplete(false);
    setStudyIndex(0);
  }

  function openFolder(id: string) {
    setCurrentView("home");
    setSelectedFolder(id);
    setVisibleCardCount(libraryPageSize);
    setMode("library");
    resetQuestion("flashcard");
    if (importedFolderIds.has(id)) void loadImportedCards();
  }

  async function deleteFolder(folderToDelete: Folder) {
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar carpeta",
      text: `¿Eliminar la carpeta "${folderToDelete.name}" y todas sus tarjetas?`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#9a453e",
    });

    if (!result.isConfirmed) return;

    setFolders((current) => current.filter((item) => item.id !== folderToDelete.id));
    setCards((current) => current.filter((card) => card.folderId !== folderToDelete.id));
    setSelectedFolder(null);
    await syncRemote(() => deleteRemoteFolder(folderToDelete.id), "No se pudo eliminar la carpeta.");
  }

  async function deleteSection(section: Section) {
    const folderIds = new Set(folders.filter((item) => item.level === section.id).map((item) => item.id));
    const result = await Swal.fire({
      icon: "warning",
      title: "Eliminar seccion",
      text: `¿Eliminar la seccion "${section.name}", sus carpetas y todas sus tarjetas?`,
      showCancelButton: true,
      confirmButtonText: "Eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#9a453e",
    });

    if (!result.isConfirmed) return;

    setSections((current) => current.filter((item) => item.id !== section.id));
    setFolders((current) => current.filter((item) => item.level !== section.id));
    setCards((current) => current.filter((card) => !folderIds.has(card.folderId)));
    setActiveLevel("Todos");
    setSelectedFolder(null);
    setEditingSection(null);
    await syncRemote(() => deleteRemoteSection(section.id), "No se pudo eliminar la seccion.");
  }

  async function saveSection(nextSection: Section, previousId?: string) {
    if (previousId) {
      setSections((current) => current.map((item) => item.id === previousId ? nextSection : item));
      setFolders((current) => current.map((item) => item.level === previousId ? { ...item, level: nextSection.id } : item));
      if (activeLevel === previousId) setActiveLevel(nextSection.id);
    } else {
      setSections((current) => [...current, nextSection]);
    }
    setEditingSection(null);
    setAddingSection(false);
    await syncRemote(
      () => previousId ? updateRemoteSection(nextSection, previousId) : createRemoteSection(nextSection),
      "No se pudo guardar la seccion.",
    );
  }

  function startPractice() {
    setMode("study");
    resetQuestion("flashcard");
  }

  function nextCard() {
    if (studyMode !== "flashcard" && studyIndex === currentStudyCards.length - 1) {
      setSessionComplete(true);
      return;
    }
    setStudyIndex((studyIndex + 1) % currentStudyCards.length);
    setShowAnswer(false);
    setWrittenAnswer("");
    setAnswerState("idle");
  }

  function restartSession() {
    setStudyIndex(0);
    setSessionComplete(false);
    resetQuestion();
  }

  function checkWrittenAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!currentCard || !writtenAnswer) return;
    setAnswerState(writtenAnswer.trim() === correctAnswer ? "correct" : "incorrect");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">D</span>
          <div><strong>DeutschQuest</strong><small>Tu espacio de estudio</small></div>
        </div>
        <nav>
          <button className={!selectedFolder && currentView === "home" ? "active" : ""} onClick={() => { setCurrentView("home"); setSelectedFolder(null); }}><span>⌂</span> Inicio</button>
          <button className={currentView === "account" ? "active" : ""} onClick={() => { setCurrentView("account"); setSelectedFolder(null); }}><span>◉</span> Cuenta</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-progress"><span>Progreso general</span><strong>{progress}%</strong><i><b style={{ width: `${progress}%` }} /></i></div>
          <p>Deutsch jeden Tag.</p>
        </div>
      </aside>

      {menuOpen && <button className="backdrop" onClick={() => setMenuOpen(false)} />}

      <main>
        <header>
          <button className="menu-toggle" onClick={() => setMenuOpen(true)}>☰</button>
          <label className="search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar palabra, traducción o ejemplo..." /></label>
          <div className="streak"><span>●</span><strong>7</strong><small>días</small></div>
          <AccountButton onOpen={() => { setCurrentView("account"); setSelectedFolder(null); }} />
          {searchCards.length > 0 && (
            <div className="search-popover">
              {searchCards.slice(0, 6).map((card) => <button key={card.id} onClick={() => { openFolder(card.folderId); setQuery(""); }}><strong>{card.german}</strong><span>{card.spanish}</span></button>)}
            </div>
          )}
        </header>

        {!folder && currentView === "account" ? (
          <AccountPage
            cards={cards}
            folders={folders}
            isRemote={isRemote}
          />
        ) : !folder ? (
          <div className="page">
            {(dataLoading || syncError || !account.isConfigured) && <SyncNotice loading={dataLoading} error={syncError} isConfigured={account.isConfigured} />}
            <section className="hero">
              <div><span className="eyebrow">GUTEN TAG</span><h1>Continúa tu camino<br />hacia el alemán.</h1><p>Organiza, repasa y domina cada lección a tu ritmo.</p></div>
              <div className="hero-card"><span>Palabra del día</span><strong>die Gelegenheit</strong><em>la oportunidad</em><p>Das ist eine gute Gelegenheit.</p></div>
            </section>

            <section className="stats">
              <article><span>Tarjetas</span><strong>{totalCardCount}</strong><small>en tu biblioteca</small></article>
              <article><span>Carpetas</span><strong>{folders.length}</strong><small>por tema y nivel</small></article>
              <article><span>Repasadas</span><strong>{totalStudied}</strong><small>esta semana</small></article>
              <article><span>Racha actual</span><strong>7 días</strong><small>mejor: 12 días</small></article>
            </section>

            <section className="section-heading">
              <div><span className="eyebrow dark">BIBLIOTECA</span><h2>Tus carpetas</h2></div>
              <button className="primary" onClick={() => setAdding("folder")}>+ Nueva carpeta</button>
            </section>
            <div className="level-tabs"><button className={activeLevel === "Todos" ? "active" : ""} onClick={() => setActiveLevel("Todos")}>Todos</button>{sections.map((section) => <button key={section.id} className={activeLevel === section.id ? "active" : ""} onClick={() => setActiveLevel(section.id)}>{section.name}</button>)}<button className="add-section" onClick={() => setAddingSection(true)}>+ Sección</button></div>
            {activeSection && <section className="active-section-bar"><div><span>SECCIÓN</span><h3>{activeSection.name}</h3><small>{visibleFolders.length} {visibleFolders.length === 1 ? "carpeta" : "carpetas"}</small></div><button onClick={() => setEditingSection(activeSection)}>Editar sección</button></section>}
            <section className="folder-grid">
              {visibleFolders.map((item) => {
                const count = cards.filter((card) => card.folderId === item.id).length + (importedFolderCounts[item.id] ?? 0);
                return <button className="folder-card" key={item.id} onClick={() => openFolder(item.id)} style={{ "--accent": item.color } as React.CSSProperties}>
                  <span className="folder-level">{item.level}</span><i>▰</i><h3>{item.name}</h3><p>{item.description}</p><small>{count} tarjetas <b>→</b></small>
                </button>;
              })}
            </section>
          </div>
        ) : (
          <div className="page">
            <button className="back-link" onClick={() => { setCurrentView("home"); setSelectedFolder(null); }}>← Volver a carpetas</button>
            <section className="folder-hero" style={{ "--accent": folder.color } as React.CSSProperties}>
              <div><span className="folder-level">{folder.level}</span><h1>{folder.name}</h1><p>{folder.description} · {folderCards.length} tarjetas</p></div>
              <div className="folder-actions">
                <button className={mode === "library" ? "active" : ""} onClick={() => setMode("library")}>Biblioteca</button>
                <button className={mode === "study" ? "active" : ""} onClick={startPractice}>Practicar</button>
                <button className="primary" onClick={() => setAdding("card")}>+ Tarjeta</button>
                <details className="action-menu"><summary aria-label="Más opciones de carpeta">•••</summary><div><button onClick={() => setEditingFolder(folder)}>Editar carpeta</button><button className="danger-action" onClick={() => void deleteFolder(folder)}>Eliminar carpeta</button></div></details>
              </div>
            </section>

            {mode === "library" ? (
              importedCardsLoading ? <p className="empty">Cargando tarjetas...</p> : <><section className="card-grid">{folderCards.slice(0, visibleCardCount).map((card) => <article className="word-card" key={card.id}><span>{card.kind}</span><h2>{card.german}</h2><strong>{card.spanish}</strong><p>{card.example}</p>{card.exampleSpanish && <p className="example-translation">{card.exampleSpanish}</p>}{card.note && <small>{card.note}</small>}{!card.id.startsWith("verb-prep-") && <button onClick={() => void removeCard(card)}>Eliminar</button>}</article>)}</section>{visibleCardCount < folderCards.length && <button className="load-more" onClick={() => setVisibleCardCount((count) => count + libraryPageSize)}>Mostrar más ({folderCards.length - visibleCardCount} restantes)</button>}</>
            ) : currentCard ? (
              <section className="study-area">
                <div className="study-modes">
                  <button className={studyMode === "flashcard" ? "active" : ""} onClick={() => resetQuestion("flashcard")}>Flashcard</button>
                  <button className={studyMode === "multiple" ? "active" : ""} onClick={() => resetQuestion("multiple")}>Opción múltiple</button>
                  <button className={studyMode === "write" ? "active" : ""} onClick={() => resetQuestion("write")}>Escribir</button>
                </div>
                {studyMode !== "flashcard" && (
                  <div className="study-settings">
                    <label>Número de tarjetas<input type="number" min="1" max={folderCards.length} value={Math.min(studyCount, folderCards.length)} onChange={(event) => { setStudyCount(Math.max(1, Math.min(Number(event.target.value), folderCards.length))); resetQuestion(studyMode); }} /></label>
                    <label>Dirección<select value={studyDirection} onChange={(event) => { setStudyDirection(event.target.value as StudyDirection); resetQuestion(studyMode); }}>
                      <option value="de-es">Alemán → Español</option>
                      <option value="es-de">Español → Alemán</option>
                    </select></label>
                  </div>
                )}
                {!sessionComplete && <div className="study-top"><span>Tarjeta {studyIndex + 1} de {currentStudyCards.length}</span><i><b style={{ width: `${((studyIndex + 1) / currentStudyCards.length) * 100}%` }} /></i></div>}

                {sessionComplete ? (
                  <div className="session-complete"><span>SESIÓN COMPLETADA</span><h2>Terminaste {currentStudyCards.length} tarjetas</h2><p>Puedes cambiar la cantidad o dirección antes de volver a practicar.</p><button className="primary" onClick={restartSession}>Practicar de nuevo</button></div>
                ) : studyMode === "flashcard" ? (
                  <button className="study-card" onClick={() => setShowAnswer(!showAnswer)}>
                    {!showAnswer ? <><span>{currentCard.kind}</span><h2>{currentCard.german}</h2><small>Toca para mostrar la respuesta</small></> : <><span>Significado</span><h2>{currentCard.spanish}</h2><p>{currentCard.example}</p>{currentCard.exampleSpanish && <p className="example-translation">{currentCard.exampleSpanish}</p>}<small>{currentCard.note}</small></>}
                  </button>
                ) : studyMode === "multiple" ? (
                  <div className="quiz-card">
                    <span>Elige la traducción en {studyDirection === "de-es" ? "español" : "alemán"}</span>
                    <h2>{promptText}</h2>
                    <div className="multiple-options">
                      {multipleOptions.map((option) => <button key={option.id} disabled={answerState !== "idle"} className={answerState !== "idle" ? (option.id === currentCard.id ? "correct" : "muted") : ""} onClick={() => setAnswerState(option.id === currentCard.id ? "correct" : "incorrect")}>{studyDirection === "de-es" ? option.spanish : option.german}</button>)}
                    </div>
                  </div>
                ) : (
                  <form className="quiz-card write-quiz" onSubmit={checkWrittenAnswer}>
                    <span>Escribe la traducción en {studyDirection === "de-es" ? "español" : "alemán"}</span>
                    <h2>{promptText}</h2>
                    <label>La respuesta distingue mayúsculas y minúsculas<input value={writtenAnswer} onChange={(event) => { setWrittenAnswer(event.target.value); setAnswerState("idle"); }} placeholder={studyDirection === "de-es" ? "Escribe en español" : "Ej. der Tisch"} autoFocus autoComplete="off" /></label>
                    <button className="primary">Comprobar</button>
                  </form>
                )}

                {!sessionComplete && answerState !== "idle" && <div className={`answer-feedback ${answerState}`}><strong>{answerState === "correct" ? "Correcto" : "Incorrecto"}</strong>{answerState === "incorrect" && <span>Respuesta exacta: <b>{correctAnswer}</b></span>}</div>}
                {!sessionComplete && <div className="study-actions">
                  {studyMode === "flashcard" && <button onClick={() => setShowAnswer(!showAnswer)}>Voltear</button>}
                  <button className="primary" onClick={nextCard}>Siguiente →</button>
                </div>}
              </section>
            ) : <p className="empty">Agrega tarjetas para comenzar a practicar.</p>}
          </div>
        )}
      </main>

      {adding === "folder" && <FolderModal sections={sections} onClose={() => setAdding(null)} onSave={(newFolder) => { void saveFolder(newFolder); setAdding(null); }} />}
      {editingFolder && <FolderModal sections={sections} initial={editingFolder} onClose={() => setEditingFolder(null)} onSave={(updated) => { void saveFolder(updated, editingFolder); setEditingFolder(null); }} />}
      {(addingSection || editingSection) && <SectionModal initial={editingSection ?? undefined} sections={sections} onClose={() => { setAddingSection(false); setEditingSection(null); }} onSave={saveSection} onDelete={editingSection ? deleteSection : undefined} />}
      {adding === "card" && folder && <CardModal folderId={folder.id} onClose={() => setAdding(null)} onSave={(card) => { void saveCard(card); setAdding(null); }} />}
    </div>
  );
}

function SyncNotice({ loading, error, isConfigured }: { loading: boolean; error: string | null; isConfigured: boolean }) {
  if (loading) return <p className="sync-notice">Cargando tu biblioteca...</p>;
  if (error) return <p className="sync-notice error">{error}</p>;
  if (!isConfigured) return <p className="sync-notice">Supabase no esta configurado. Tus cambios se guardan solo en este navegador.</p>;

  return null;
}

function AccountButton({ onOpen }: { onOpen: () => void }) {
  const { displayName, isConfigured, isLoading, isSignedIn, signOut } = useSupabaseAccount();

  if (!isConfigured) {
    return <button className="account-pill" onClick={onOpen}>Local</button>;
  }

  if (!isSignedIn) {
    return <button className="account-pill" onClick={onOpen} disabled={isLoading}>Iniciar sesion</button>;
  }

  return (
    <div className="account-actions">
      <button className="account-pill" onClick={onOpen}>{displayName || "Cuenta"}</button>
      <button className="account-signout" onClick={() => void signOut()} disabled={isLoading}>Salir</button>
    </div>
  );
}

function AccountPage({ cards, folders, isRemote }: { cards: Flashcard[]; folders: Folder[]; isRemote: boolean }) {
  const account = useSupabaseAccount();
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(account.displayName ?? "");
  const [newEmail, setNewEmail] = useState(account.email ?? "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDisplayName(account.displayName ?? "");
    setNewEmail(account.email ?? "");
  }, [account.displayName, account.email]);

  async function submitAuth(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const result = authMode === "signin"
        ? await account.signIn(authEmail, password)
        : await account.signUp(authEmail, password, displayName);

      if (result.ok) setPassword("");
      if (result.ok && authMode === "signup") setAuthMode("signin");

      await showResultAlert(
        result.ok,
        result.ok ? (authMode === "signin" ? "Sesion iniciada" : "Cuenta creada") : (authMode === "signin" ? "No se pudo iniciar sesion" : "No se pudo crear la cuenta"),
        result.message,
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDisplayName(event: FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) return;

    setSubmitting(true);
    const result = await account.updateDisplayName(displayName);
    await showResultAlert(
      result.ok,
      result.ok ? "Nombre actualizado" : "No se pudo actualizar",
      result.message,
    );
    setSubmitting(false);
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (!newEmail.trim() || newEmail === account.email) return;

    setSubmitting(true);
    const result = await account.updateEmail(newEmail);
    await showResultAlert(
      result.ok,
      result.ok ? "Revisa tu correo" : "No se pudo cambiar el email",
      result.message,
    );
    setSubmitting(false);
  }

  if (!account.isConfigured) {
    return (
      <div className="page account-page">
        <section className="account-panel">
          <h1>Cuenta</h1>
          <p>Supabase no esta configurado. Revisa las variables de entorno de DeutschQuest.</p>
        </section>
      </div>
    );
  }

  if (!account.isSignedIn) {
    return (
      <div className="page account-page">
        <section className="account-panel account-auth-panel">
          <span className="account-kicker">Panel personal</span>
          <h1>{authMode === "signin" ? "Iniciar sesion" : "Crear cuenta"}</h1>
          <p>{authMode === "signin" ? "Entra para sincronizar tus tarjetas." : "Crea tu cuenta para guardar tus tarjetas en Supabase."}</p>

          <form className="account-form" onSubmit={submitAuth}>
            {authMode === "signup" && (
              <label>Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu nombre" /></label>
            )}
            <label>Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="tu@email.com" autoFocus /></label>
            <label>Contrasena<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimo 6 caracteres" /></label>
            <div className="account-page-actions">
              <button className="primary" disabled={submitting}>{submitting ? "Procesando..." : authMode === "signin" ? "Entrar" : "Crear cuenta"}</button>
              <button type="button" className="secondary-inline" onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")} disabled={submitting}>
                {authMode === "signin" ? "Crear cuenta" : "Ya tengo cuenta"}
              </button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="page account-page">
      <section className="account-overview">
        <div>
          <span className="account-kicker">Panel personal</span>
          <h1>Tu cuenta</h1>
          <p>Administra tu perfil y revisa como se guardan tus materiales.</p>
        </div>
        <button type="button" className="secondary-button" onClick={() => void account.signOut()}>Cerrar sesion</button>
      </section>

      <section className="account-stats" aria-label="Resumen de cuenta">
        <article><span>Tarjetas</span><strong>{cards.length}</strong><small>Guardadas para practicar</small></article>
        <article><span>Carpetas</span><strong>{folders.length}</strong><small>Colecciones organizadas</small></article>
        <article><span>Sincronizacion</span><strong>{isRemote ? "Activa" : "Local"}</strong><small>{isRemote ? "Supabase conectado" : "Solo en este dispositivo"}</small></article>
        <article><span>Seguridad</span><strong>30 min</strong><small>Cierre por inactividad</small></article>
      </section>

      <section className="account-settings-grid">
        <div className="account-panel">
          <h2>Perfil</h2>
          <p>Este nombre se muestra en el boton de cuenta de la cabecera.</p>
          <form className="account-form" onSubmit={submitDisplayName}>
            <label>Nombre visible<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Tu nombre" /></label>
            <button className="primary" disabled={submitting}>Guardar nombre</button>
          </form>
        </div>

        <div className="account-panel">
          <h2>Correo de acceso</h2>
          <p>Supabase enviara una confirmacion antes de aplicar el cambio.</p>
          <form className="account-form" onSubmit={submitEmail}>
            <label>Correo<input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nuevo@email.com" /></label>
            <button className="primary" disabled={submitting || newEmail === account.email}>Cambiar email</button>
          </form>
        </div>
      </section>

      <section className="account-panel account-security-note">
        <div>
          <h2>Proteccion de tus datos</h2>
          <p>Tus tarjetas se sincronizan automaticamente al iniciar sesion. La sesion se cierra tras 30 minutos sin actividad.</p>
        </div>
        <span>Sesion protegida</span>
      </section>
    </div>
  );
}

function FolderModal({ sections, initial, onClose, onSave }: { sections: Section[]; initial?: Folder; onClose: () => void; onSave: (folder: Folder) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [level, setLevel] = useState<Level>(initial?.level ?? sections[0]?.id ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} /><form className="modal" onSubmit={(event) => { event.preventDefault(); if (name.trim() && level) onSave({ id: initial?.id ?? crypto.randomUUID(), name: name.trim(), level, description: description.trim(), color: initial?.color ?? "#6366f1" }); }}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow dark">{initial ? "EDITAR COLECCIÓN" : "NUEVA COLECCIÓN"}</span><h2>{initial ? "Editar carpeta" : "Crear carpeta"}</h2><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Comida y restaurante" autoFocus /></label><label>Sección<select value={level} onChange={(e) => setLevel(e.target.value)}>{sections.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contenido de la carpeta" /></label><button className="primary">{initial ? "Guardar cambios" : "Crear carpeta"}</button></form></div>;
}

function SectionModal({ initial, sections, onClose, onSave, onDelete }: { initial?: Section; sections: Section[]; onClose: () => void; onSave: (section: Section, previousId?: string) => void; onDelete?: (section: Section) => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const normalizedId = name.trim();
  const duplicate = sections.some((section) => section.id.toLowerCase() === normalizedId.toLowerCase() && section.id !== initial?.id);
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} /><form className="modal" onSubmit={(event) => { event.preventDefault(); if (normalizedId && !duplicate) onSave({ id: normalizedId, name: normalizedId }, initial?.id); }}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow dark">{initial ? "EDITAR SECCIÓN" : "NUEVA SECCIÓN"}</span><h2>{initial ? "Editar sección" : "Crear sección"}</h2><label>Nombre<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. C1 o Verbos" autoFocus /></label>{duplicate && <p className="form-error">Ya existe una sección con ese nombre.</p>}<button className="primary" disabled={!normalizedId || duplicate}>{initial ? "Guardar cambios" : "Crear sección"}</button>{initial && onDelete && <button type="button" className="danger-button" onClick={() => onDelete(initial)}>Eliminar sección</button>}</form></div>;
}

function CardModal({ folderId, onClose, onSave }: { folderId: string; onClose: () => void; onSave: (card: Flashcard) => void }) {
  const [german, setGerman] = useState("");
  const [spanish, setSpanish] = useState("");
  const [example, setExample] = useState("");
  const [exampleSpanish, setExampleSpanish] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<CardKind>("Sustantivo");
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} /><form className="modal" onSubmit={(event) => { event.preventDefault(); if (german.trim() && spanish.trim()) onSave({ id: crypto.randomUUID(), folderId, german, spanish, example, exampleSpanish, note, kind }); }}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow dark">NUEVO CONTENIDO</span><h2>Agregar flashcard</h2><label>Alemán<input value={german} onChange={(e) => setGerman(e.target.value)} placeholder="die Sprache" autoFocus /></label><label>Español<input value={spanish} onChange={(e) => setSpanish(e.target.value)} placeholder="el idioma" /></label><label>Tipo<select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>{kinds.map((item) => <option key={item}>{item}</option>)}</select></label><label>Ejemplo en alemán<input value={example} onChange={(e) => setExample(e.target.value)} placeholder="Deutsch ist eine schöne Sprache." /></label><label>Traducción del ejemplo<input value={exampleSpanish} onChange={(e) => setExampleSpanish(e.target.value)} placeholder="El alemán es un idioma bonito." /></label><label>Nota<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Plural, conjugación o caso" /></label><button className="primary">Guardar tarjeta</button></form></div>;
}
