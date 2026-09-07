import { useEffect, useRef, useState } from 'react';
import './App.css';

const STORAGE_KEY = 'research-process-map-v1';
const STUDENT_NAMES_KEY = 'research-process-student-names-v1';

const promptCards = [
  
  'Scanning images of old type specimens at a physical archive',
  'Sharing a beta version of the font with designer friends to test',
  'Surveying current type foundries online for similar typefaces',
  'Exploring online archives for inspiration',
  'Reading Designing Type Revivals to decide how much of the original ink-on-paper artifact to carry into the digital version',
  'Watching tutorials on specific features in Glyphs',
  'Asking Claude about the history of the original typeface, its foundry, and its designer',
  'Meeting with instructor and/or archivist to find examples of the original typeface in use',
];

const createCards = () => (
  promptCards.map((prompt, index) => ({
    id: index,
    prompt,
    commentary: '',
    position: null,
  }))
);

const loadCards = () => {
  const defaults = createCards();

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(saved)) return defaults;

    return defaults.map((card) => {
      const savedCard = saved.find((item) => item?.id === card.id);
      if (!savedCard) return card;

      return {
        ...card,
        commentary: typeof savedCard.commentary === 'string' ? savedCard.commentary : '',
        position: (
          Number.isFinite(savedCard.position?.x) &&
          Number.isFinite(savedCard.position?.y)
        ) ? {
          x: Math.max(0, Math.min(1, savedCard.position.x)),
          y: Math.max(0, Math.min(1, savedCard.position.y)),
        } : null,
      };
    });
  } catch {
    return defaults;
  }
};

function App() {
  const timelineRef = useRef(null);
  const [cards, setCards] = useState(loadCards);
  const [dragging, setDragging] = useState(null);
  const [studentNames, setStudentNames] = useState(() => (
    localStorage.getItem(STUDENT_NAMES_KEY) || 'Student names'
  ));

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
    } catch {
      // The map still works when browser storage is unavailable.
    }
  }, [cards]);

  useEffect(() => {
    localStorage.setItem(STUDENT_NAMES_KEY, studentNames);
  }, [studentNames]);

  const startCardDrag = (event, card) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({
      id: card.id,
      x: event.clientX,
      y: event.clientY,
      origin: card.position,
    });
  };

  const moveCard = (event) => {
    if (!dragging) return;
    setDragging((current) => current ? {
      ...current,
      x: event.clientX,
      y: event.clientY,
    } : null);
  };

  const endCardDrag = (event) => {
    if (!dragging) return;

    const timeline = timelineRef.current?.getBoundingClientRect();
    if (!timeline) return;
    const isInsideMap = (
      event.clientX >= timeline.left - 30 &&
      event.clientX <= timeline.right + 30 &&
      event.clientY >= timeline.top - 30 &&
      event.clientY <= timeline.bottom + 30
    );

    if (isInsideMap) {
      const position = {
        x: Math.max(0, Math.min(1, (event.clientX - timeline.left) / timeline.width)),
        y: Math.max(0, Math.min(1, (event.clientY - timeline.top) / timeline.height)),
      };
      setCards((current) => current.map((card) => (
        card.id === dragging.id ? { ...card, position } : card
      )));
    }

    setDragging(null);
  };

  const resetCards = () => {
    setCards((current) => current.map((card) => ({
      ...card,
      commentary: '',
      position: null,
    })));
    setStudentNames('Student names');
  };

  const updateCommentary = (id, commentary) => {
    setCards((current) => current.map((card) => (
      card.id === id ? { ...card, commentary } : card
    )));
  };

  const fitTextarea = (element) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <p className="instruction"><span>Drag</span> prompts onto the timeline</p>
        <div
          className="student-names"
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Student names"
          onInput={(event) => setStudentNames(event.currentTarget.textContent)}
          onFocus={(event) => {
            if (event.currentTarget.textContent === 'Student names') {
              event.currentTarget.textContent = '';
              setStudentNames('');
            }
          }}
        >
          {studentNames}
        </div>
        <div className="header-actions">
          <button className="reset-button" onClick={resetCards}>
            Reset
          </button>
          <button className="export-button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      <h1 className="project-description">
        Designing a “revival typeface” based on a previously undigitized font.
      </h1>

      <aside className="prompt-deck" aria-label="Research prompt cards">
        <div className="card-stack">
          {cards.filter((card) => card.position === null).map((card) => {
            const stackIndex = cards.findIndex((item) => item.id === card.id);
            const isDragging = dragging?.id === card.id;

            return (
              <div
                className={`prompt-card card-${card.id + 1} ${isDragging ? 'is-dragging' : ''}`}
                key={card.id}
                role="group"
                onPointerDown={(event) => startCardDrag(event, card)}
                onPointerMove={moveCard}
                onPointerUp={endCardDrag}
                onPointerCancel={() => setDragging(null)}
                style={isDragging ? {
                  position: 'fixed',
                  left: dragging.x,
                  top: dragging.y,
                  transform: 'translate(-50%, -50%) rotate(-2deg)',
                } : {
                  left: stackIndex * 3,
                  top: stackIndex * 22,
                  zIndex: 40 + stackIndex,
                }}
              >
                <strong>{card.prompt}</strong>
                <i aria-hidden="true">↗</i>
                <textarea
                  ref={fitTextarea}
                  value={card.commentary}
                  onChange={(event) => {
                    fitTextarea(event.currentTarget);
                    updateCommentary(card.id, event.target.value);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  placeholder="1–2 sentences justifying your decision"
                  aria-label={`Commentary for: ${card.prompt}`}
                />
              </div>
            );
          })}
        </div>
      </aside>

      <div
        className={`timeline ${dragging ? 'is-targeted' : ''}`}
        ref={timelineRef}
        aria-label="Research map: theory at top, practice at bottom"
      >
        <div className="timeline-base" />
        <div className="arrow-head" />
        <div className="vertical-axis" aria-hidden="true">
          <span className="axis-label theory-label">Theory</span>
          <span className="axis-label practice-label">Practice</span>
        </div>
        {cards.filter((card) => card.position !== null).map((card) => {
          const isDragging = dragging?.id === card.id;

          return (
            <div
              className={`prompt-card placed-card card-${card.id + 1} ${isDragging ? 'is-dragging' : ''}`}
              key={card.id}
              role="group"
              onPointerDown={(event) => startCardDrag(event, card)}
              onPointerMove={moveCard}
              onPointerUp={endCardDrag}
              onPointerCancel={() => setDragging(null)}
              style={isDragging ? {
                position: 'fixed',
                left: dragging.x,
                top: dragging.y,
                transform: 'translate(-50%, -50%) rotate(-2deg)',
              } : {
                left: `${card.position.x * 100}%`,
                top: `${card.position.y * 100}%`,
              }}
            >
              <strong>{card.prompt}</strong>
              <i aria-hidden="true">↗</i>
              <textarea
                ref={fitTextarea}
                value={card.commentary}
                onChange={(event) => {
                  fitTextarea(event.currentTarget);
                  updateCommentary(card.id, event.target.value);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                placeholder="1–2 sentences justifying your decision"
                aria-label={`Commentary for: ${card.prompt}`}
              />
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default App;
