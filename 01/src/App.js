import { useEffect, useRef, useState } from 'react';
import './App.css';
import content from './content.json';

const STORAGE_KEY = 'research-process-map-v1';
const DATASET_KEY = 'research-process-selected-dataset-v1';
const STUDENT_NAMES_KEY = 'research-process-student-names-v1';

const datasets = Array.isArray(content) ? content : [content];

const createCards = (datasetIndex = 0) => (
  (datasets[datasetIndex]?.prompts || []).map((prompt, index) => ({
    id: index,
    prompt,
    commentary: '',
    position: null,
  }))
);

const getSpectrumColor = (position) => {
  const y = Number.isFinite(position?.y) ? position.y : 0.5;
  const hue = 199 + (59 - 199) * Math.max(0, Math.min(1, y));
  return `hsl(${hue} 100% 50%)`;
};

const loadDatasetIndex = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.has('proj')) {
    const urlIndex = Number(params.get('proj'));
    if (Number.isInteger(urlIndex) && datasets[urlIndex]) return urlIndex;
  }

  const savedIndex = Number(localStorage.getItem(DATASET_KEY));
  return Number.isInteger(savedIndex) && datasets[savedIndex] ? savedIndex : 0;
};

const loadCards = (datasetIndex = 0) => {
  const defaults = createCards(datasetIndex);

  try {
    const projectStorage = localStorage.getItem(`${STORAGE_KEY}-${datasetIndex}`);
    const legacyStorage = datasetIndex === 0 ? localStorage.getItem(STORAGE_KEY) : null;
    const saved = JSON.parse(projectStorage || legacyStorage);
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
  const [selectedDataset, setSelectedDataset] = useState(loadDatasetIndex);
  const [cards, setCards] = useState(() => loadCards(selectedDataset));
  const [dragging, setDragging] = useState(null);
  const [studentNames, setStudentNames] = useState(() => (
    localStorage.getItem(STUDENT_NAMES_KEY) || 'Student names'
  ));

  useEffect(() => {
    try {
      localStorage.setItem(`${STORAGE_KEY}-${selectedDataset}`, JSON.stringify(cards));
    } catch {
      // The map still works when browser storage is unavailable.
    }
  }, [cards, selectedDataset]);

  useEffect(() => {
    localStorage.setItem(DATASET_KEY, selectedDataset);
    const url = new URL(window.location.href);
    url.searchParams.set('proj', selectedDataset);
    window.history.replaceState({}, '', url);
  }, [selectedDataset]);

  useEffect(() => {
    localStorage.setItem(STUDENT_NAMES_KEY, studentNames);
  }, [studentNames]);

  const startCardDrag = (event, card) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging({
      id: card.id,
      x: event.clientX,
      y: event.clientY,
      mapY: card.position?.y ?? 0.5,
      origin: card.position,
    });
  };

  const moveCard = (event) => {
    if (!dragging) return;
    const timeline = timelineRef.current?.getBoundingClientRect();
    const mapY = timeline
      ? Math.max(0, Math.min(1, (event.clientY - timeline.top) / timeline.height))
      : 0.5;

    setDragging((current) => current ? {
      ...current,
      x: event.clientX,
      y: event.clientY,
      mapY,
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

  const selectDataset = (event) => {
    const datasetIndex = Number(event.target.value);
    setSelectedDataset(datasetIndex);
    setCards(loadCards(datasetIndex));
    setDragging(null);
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

  const cardOrder = [...cards].sort((a, b) => {
    if (a.position && b.position) {
      return a.position.x - b.position.x || a.id - b.id;
    }
    if (a.position) return -1;
    if (b.position) return 1;
    return a.id - b.id;
  });

  const getCardNumber = (id) => (
    String(cardOrder.findIndex((card) => card.id === id) + 1).padStart(2, '0')
  );

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="topbar-left">
          <p className="instruction"><span>Drag</span> prompts onto the timeline</p>
          <label className="data-picker">
            <span>Get data</span>
            <select value={selectedDataset} onChange={selectDataset}>
              {datasets.map((dataset, index) => (
                <option value={index} key={`${index}-${dataset.projectDescription}`}>
                  {String(index + 1).padStart(2, '0')} — {dataset.projectDescription}
                </option>
              ))}
            </select>
          </label>
        </div>
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
        {datasets[selectedDataset]?.projectDescription}
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
                  backgroundColor: getSpectrumColor({ y: dragging.mapY }),
                } : {
                  left: stackIndex * 3,
                  top: stackIndex * 22,
                  zIndex: 40 + stackIndex,
                }}
              >
                <span className="prompt-number">{getCardNumber(card.id)}</span>
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
                backgroundColor: getSpectrumColor({ y: dragging.mapY }),
              } : {
                left: `${card.position.x * 100}%`,
                top: `${card.position.y * 100}%`,
                backgroundColor: getSpectrumColor(card.position),
              }}
            >
              <span className="prompt-number">{getCardNumber(card.id)}</span>
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
