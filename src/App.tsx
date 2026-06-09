import { useEffect, useMemo, useState } from "react";
import { starterCards, starterFolders } from "./data";
import type { CardKind, Flashcard, Folder, Level } from "./types";

const levels: Array<Level | "Todos"> = ["Todos", "A1", "A2", "B1", "B2"];
const kinds: CardKind[] = ["Sustantivo", "Verbo", "Expresion"];
type StudyMode = "flashcard" | "multiple" | "write";
type AnswerState = "idle" | "correct" | "incorrect";
type StudyDirection = "de-es" | "es-de";

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

function loadFolders() {
  return load<Folder[]>("dq-folders", starterFolders).filter((folder) => !isGrammarFolder(folder));
}

function loadCards(validFolders: Folder[]) {
  const folderIds = new Set(validFolders.map((folder) => folder.id));
  return load<Flashcard[]>("dq-cards", starterCards).filter(
    (card) => folderIds.has(card.folderId) && (card.kind as string) !== "Gramatica",
  );
}

function shuffled<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

export default function App() {
  const [folders, setFolders] = useState<Folder[]>(loadFolders);
  const [cards, setCards] = useState<Flashcard[]>(() => loadCards(loadFolders()));
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

  useEffect(() => localStorage.setItem("dq-folders", JSON.stringify(folders)), [folders]);
  useEffect(() => localStorage.setItem("dq-cards", JSON.stringify(cards)), [cards]);

  const visibleFolders = folders.filter((folder) => activeLevel === "Todos" || folder.level === activeLevel);
  const folder = folders.find((item) => item.id === selectedFolder);
  const folderCards = cards.filter((card) => card.folderId === selectedFolder);
  const searchCards = query.trim()
    ? cards.filter((card) => `${card.german} ${card.spanish} ${card.example}`.toLowerCase().includes(query.toLowerCase()))
    : [];
  const totalStudied = Math.min(cards.length, 18);
  const progress = cards.length ? Math.round((totalStudied / cards.length) * 100) : 0;

  const shuffledFolderCards = useMemo(() => shuffled(folderCards), [selectedFolder, mode]);
  const currentStudyCards = studyMode === "flashcard"
    ? shuffledFolderCards
    : shuffledFolderCards.slice(0, Math.min(studyCount, shuffledFolderCards.length));
  const currentCard = currentStudyCards[studyIndex];
  const promptText = currentCard ? (studyDirection === "de-es" ? currentCard.german : currentCard.spanish) : "";
  const correctAnswer = currentCard ? (studyDirection === "de-es" ? currentCard.spanish : currentCard.german) : "";
  const multipleOptions = useMemo(() => {
    if (!currentCard) return [];
    const alternatives = cards.filter((card) => card.id !== currentCard.id);
    return shuffled([currentCard, ...shuffled(alternatives).slice(0, 3)]);
  }, [currentCard, cards, studyDirection]);

  function resetQuestion(nextMode = studyMode) {
    setStudyMode(nextMode);
    setShowAnswer(false);
    setWrittenAnswer("");
    setAnswerState("idle");
    setSessionComplete(false);
    setStudyIndex(0);
  }

  function openFolder(id: string) {
    setSelectedFolder(id);
    setMode("library");
    resetQuestion("flashcard");
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
          <button className={!selectedFolder ? "active" : ""} onClick={() => setSelectedFolder(null)}><span>⌂</span> Inicio</button>
          <button onClick={() => { setSelectedFolder(null); setAdding("folder"); }}><span>□</span> Carpetas</button>
          <button onClick={() => setQuery("der")}><span>◇</span> Vocabulario</button>
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
          <button className="avatar">AH</button>
          {searchCards.length > 0 && (
            <div className="search-popover">
              {searchCards.slice(0, 6).map((card) => <button key={card.id} onClick={() => { openFolder(card.folderId); setQuery(""); }}><strong>{card.german}</strong><span>{card.spanish}</span></button>)}
            </div>
          )}
        </header>

        {!folder ? (
          <div className="page">
            <section className="hero">
              <div><span className="eyebrow">GUTEN TAG</span><h1>Continúa tu camino<br />hacia el alemán.</h1><p>Organiza, repasa y domina cada lección a tu ritmo.</p></div>
              <div className="hero-card"><span>Palabra del día</span><strong>die Gelegenheit</strong><em>la oportunidad</em><p>Das ist eine gute Gelegenheit.</p></div>
            </section>

            <section className="stats">
              <article><span>Tarjetas</span><strong>{cards.length}</strong><small>en tu biblioteca</small></article>
              <article><span>Carpetas</span><strong>{folders.length}</strong><small>por tema y nivel</small></article>
              <article><span>Repasadas</span><strong>{totalStudied}</strong><small>esta semana</small></article>
              <article><span>Racha actual</span><strong>7 días</strong><small>mejor: 12 días</small></article>
            </section>

            <section className="section-heading">
              <div><span className="eyebrow dark">BIBLIOTECA</span><h2>Tus carpetas</h2></div>
              <button className="primary" onClick={() => setAdding("folder")}>+ Nueva carpeta</button>
            </section>
            <div className="level-tabs">{levels.map((level) => <button key={level} className={activeLevel === level ? "active" : ""} onClick={() => setActiveLevel(level)}>{level}</button>)}</div>
            <section className="folder-grid">
              {visibleFolders.map((item) => {
                const count = cards.filter((card) => card.folderId === item.id).length;
                return <button className="folder-card" key={item.id} onClick={() => openFolder(item.id)} style={{ "--accent": item.color } as React.CSSProperties}>
                  <span className="folder-level">{item.level}</span><i>▰</i><h3>{item.name}</h3><p>{item.description}</p><small>{count} tarjetas <b>→</b></small>
                </button>;
              })}
            </section>
          </div>
        ) : (
          <div className="page">
            <button className="back-link" onClick={() => setSelectedFolder(null)}>← Volver a carpetas</button>
            <section className="folder-hero" style={{ "--accent": folder.color } as React.CSSProperties}>
              <div><span className="folder-level">{folder.level}</span><h1>{folder.name}</h1><p>{folder.description} · {folderCards.length} tarjetas</p></div>
              <div className="folder-actions">
                <button className={mode === "library" ? "active" : ""} onClick={() => setMode("library")}>Biblioteca</button>
                <button className={mode === "study" ? "active" : ""} onClick={startPractice}>Practicar</button>
                <button className="primary" onClick={() => setAdding("card")}>+ Tarjeta</button>
              </div>
            </section>

            {mode === "library" ? (
              <section className="card-grid">{folderCards.map((card) => <article className="word-card" key={card.id}><span>{card.kind}</span><h2>{card.german}</h2><strong>{card.spanish}</strong><p>{card.example}</p>{card.note && <small>{card.note}</small>}<button onClick={() => setCards(cards.filter((item) => item.id !== card.id))}>Eliminar</button></article>)}</section>
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
                    {!showAnswer ? <><span>{currentCard.kind}</span><h2>{currentCard.german}</h2><small>Toca para mostrar la respuesta</small></> : <><span>Significado</span><h2>{currentCard.spanish}</h2><p>{currentCard.example}</p><small>{currentCard.note}</small></>}
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

      {adding === "folder" && <FolderModal onClose={() => setAdding(null)} onSave={(newFolder) => { setFolders([...folders, newFolder]); setAdding(null); }} />}
      {adding === "card" && folder && <CardModal folderId={folder.id} onClose={() => setAdding(null)} onSave={(card) => { setCards([...cards, card]); setAdding(null); }} />}
    </div>
  );
}

function FolderModal({ onClose, onSave }: { onClose: () => void; onSave: (folder: Folder) => void }) {
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("A1");
  const [description, setDescription] = useState("");
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} /><form className="modal" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onSave({ id: crypto.randomUUID(), name, level, description, color: "#6366f1" }); }}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow dark">NUEVA COLECCIÓN</span><h2>Crear carpeta</h2><label>Nombre<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Comida y restaurante" autoFocus /></label><label>Nivel<select value={level} onChange={(e) => setLevel(e.target.value as Level)}>{levels.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label>Descripción<input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contenido de la carpeta" /></label><button className="primary">Crear carpeta</button></form></div>;
}

function CardModal({ folderId, onClose, onSave }: { folderId: string; onClose: () => void; onSave: (card: Flashcard) => void }) {
  const [german, setGerman] = useState("");
  const [spanish, setSpanish] = useState("");
  const [example, setExample] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<CardKind>("Sustantivo");
  return <div className="modal-layer"><button className="modal-backdrop" onClick={onClose} /><form className="modal" onSubmit={(event) => { event.preventDefault(); if (german.trim() && spanish.trim()) onSave({ id: crypto.randomUUID(), folderId, german, spanish, example, note, kind }); }}><button type="button" className="close" onClick={onClose}>×</button><span className="eyebrow dark">NUEVO CONTENIDO</span><h2>Agregar flashcard</h2><label>Alemán<input value={german} onChange={(e) => setGerman(e.target.value)} placeholder="die Sprache" autoFocus /></label><label>Español<input value={spanish} onChange={(e) => setSpanish(e.target.value)} placeholder="el idioma" /></label><label>Tipo<select value={kind} onChange={(e) => setKind(e.target.value as CardKind)}>{kinds.map((item) => <option key={item}>{item}</option>)}</select></label><label>Ejemplo<input value={example} onChange={(e) => setExample(e.target.value)} placeholder="Deutsch ist eine schöne Sprache." /></label><label>Nota<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Plural o conjugación" /></label><button className="primary">Guardar tarjeta</button></form></div>;
}
