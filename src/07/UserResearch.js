import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './UserResearch.css';

const STORAGE_KEY = 'user-research-v1';
const STUDIO_YELLOW = `${process.env.PUBLIC_URL}/images/07/open-studio-yellow.jpg`;
const STUDIO_WHITE = `${process.env.PUBLIC_URL}/images/07/open-studio-white.jpg`;

const FORMAT_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P']);

const escapeHTML = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const sanitizeFormat = (value) => {
  if (!value || typeof document === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = value;
  const clean = (parent) => {
    [...parent.childNodes].forEach((node) => {
      if (node.nodeType === 8) {
        node.remove();
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || node.tagName === 'NOSCRIPT') {
        node.remove();
        return;
      }
      if (!FORMAT_TAGS.has(node.tagName)) {
        clean(node);
        node.replaceWith(...node.childNodes);
        return;
      }
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
      clean(node);
    });
  };
  clean(template.content);
  return template.innerHTML;
};

const BINS = [
  {
    id: 'activities',
    title: 'Activities',
    description: 'What students will use the space for',
  },
  {
    id: 'qualities',
    title: 'Qualities',
    description: 'The atmosphere and sensory character of the space',
  },
  {
    id: 'features',
    title: 'Features',
    description: 'Physical characteristics and components of the space itself',
  },
  {
    id: 'amenities',
    title: 'Amenities',
    description: 'Added conveniences that make the space more comfortable to use',
  },
];

const BIN_IDS = new Set(BINS.map((bin) => bin.id));

let cardIdCounter = 0;
const createCardId = () => {
  cardIdCounter += 1;
  return `card-${Date.now().toString(36)}-${cardIdCounter}`;
};

const clampUnit = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(1, number));
};

const defaultSpot = (bin, index) => {
  const column = bin === 'qualities' || bin === 'amenities' ? 0.52 : 0.04;
  const row = bin === 'features' || bin === 'amenities' ? 0.54 : 0.06;
  return {
    x: Math.min(0.78, column + (index % 3) * 0.1),
    y: Math.min(0.82, row + Math.floor(index / 3) * 0.14),
  };
};

const readCards = (value) => {
  if (!Array.isArray(value)) return [];
  const counts = {};
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => {
      const bin = BIN_IDS.has(entry.bin) ? entry.bin : '';
      let x = clampUnit(entry.x);
      let y = clampUnit(entry.y);
      if ((x == null || y == null) && bin) {
        const index = counts[bin] || 0;
        counts[bin] = index + 1;
        const spot = defaultSpot(bin, index);
        x = x ?? spot.x;
        y = y ?? spot.y;
      }
      return {
        id: typeof entry.id === 'string' ? entry.id : createCardId(),
        text: typeof entry.text === 'string' ? entry.text : '',
        bin,
        x,
        y,
      };
    });
};

let phaseIdCounter = 0;
const createPhaseId = () => {
  phaseIdCounter += 1;
  return `phase-${Date.now().toString(36)}-${phaseIdCounter}`;
};

const readPhases = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : createPhaseId(),
      title: typeof entry.title === 'string' ? entry.title : '',
      doing: typeof entry.doing === 'string' ? entry.doing : '',
      thinking: typeof entry.thinking === 'string' ? entry.thinking : '',
      pain: typeof entry.pain === 'string' ? entry.pain : '',
    }));
};

const blankAnswers = () => ({
  names: '',
  observation: '',
  phases: [],
  cards: [],
});

const loadAnswers = () => {
  const blank = blankAnswers();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return blank;
    return {
      names: typeof saved.names === 'string' ? saved.names : '',
      observation: typeof saved.observation === 'string' ? sanitizeFormat(saved.observation) : '',
      phases: readPhases(saved.phases),
      cards: readCards(saved.cards),
    };
  } catch {
    return blank;
  }
};

const fitTextarea = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

function JourneyMap({ phases, onChange }) {
  const [focusId, setFocusId] = useState(null);

  useEffect(() => {
    if (!focusId) return undefined;
    document.getElementById(`phase-${focusId}-title`)?.focus();
    setFocusId(null);
    return undefined;
  }, [focusId]);

  const updatePhase = (id, patch) => {
    onChange(phases.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)));
  };

  const addPhase = () => {
    const id = createPhaseId();
    onChange([...phases, { id, title: '', doing: '', thinking: '', pain: '' }]);
    setFocusId(id);
  };

  const movePhase = (index, delta) => {
    const nextIndex = index + delta;
    if (nextIndex < 0 || nextIndex >= phases.length) return;
    const next = [...phases];
    const [phase] = next.splice(index, 1);
    next.splice(nextIndex, 0, phase);
    onChange(next);
  };

  const removePhase = (id) => {
    onChange(phases.filter((phase) => phase.id !== id));
  };

  return (
    <div className="user-research-journey">
      {phases.length > 0 && (
        <ol className="user-research-phases">
          {phases.map((phase, index) => {
            const number = String(index + 1).padStart(2, '0');
            return (
              <li className="user-research-phase" key={phase.id}>
                <div className="user-research-phase-tools">
                  <p className="user-research-phase-number">{number}</p>
                  <button
                    type="button"
                    aria-label={`Move phase ${number} earlier`}
                    disabled={index === 0}
                    onClick={() => movePhase(index, -1)}
                  >
                    {'\u2190'}
                  </button>
                  <button
                    type="button"
                    aria-label={`Move phase ${number} later`}
                    disabled={index === phases.length - 1}
                    onClick={() => movePhase(index, 1)}
                  >
                    {'\u2192'}
                  </button>
                  <button
                    type="button"
                    className="user-research-phase-delete"
                    aria-label={`Delete phase ${number}`}
                    onClick={() => removePhase(phase.id)}
                  >
                    {'\u00D7'}
                  </button>
                </div>
                <input
                  id={`phase-${phase.id}-title`}
                  value={phase.title}
                  placeholder="Title"
                  aria-label={`Phase ${number} title`}
                  onChange={(event) => updatePhase(phase.id, { title: event.target.value })}
                />
                {[
                  ['doing', 'Doing', phase.doing],
                  ['thinking', 'Thinking', phase.thinking],
                  ['pain', 'Pain points', phase.pain],
                ].map(([key, label, value]) => (
                  <label className="user-research-phase-field" key={key}>
                    <span>{label}</span>
                    <textarea
                      value={value}
                      rows={4}
                      aria-label={`Phase ${number} ${label}`}
                      onChange={(event) => {
                        fitTextarea(event.currentTarget);
                        updatePhase(phase.id, { [key]: event.target.value });
                      }}
                      ref={fitTextarea}
                    />
                  </label>
                ))}
              </li>
            );
          })}
        </ol>
      )}
      <button className="user-research-add-phase" type="button" onClick={addPhase}>
        Add phase
      </button>
    </div>
  );
}

function SortCard({
  card,
  number,
  placed,
  dragStyle,
  onText,
  onRemove,
  onPointerDown,
  onNudge,
}) {
  const fieldRef = useRef(null);

  useEffect(() => {
    fitTextarea(fieldRef.current);
  }, [card.text]);

  const style = dragStyle || (placed ? {
    left: `${card.x * 100}%`,
    top: `${card.y * 100}%`,
  } : undefined);

  return (
    <article
      className={[
        'user-research-card',
        placed ? 'is-placed' : '',
        dragStyle ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      onPointerDown={onPointerDown}
    >
      <button
        className="user-research-card-grip"
        type="button"
        aria-label={`Drag card ${number}`}
        onKeyDown={onNudge}
      >
        <span className="user-research-card-grip-mark" aria-hidden="true" />
      </button>
      <textarea
        id={`card-${card.id}`}
        ref={fieldRef}
        value={card.text}
        placeholder="A short phrase"
        aria-label={`Card ${number}`}
        rows={1}
        onChange={(event) => {
          fitTextarea(event.currentTarget);
          onText(event.target.value);
        }}
      />
      <button
        className="user-research-card-remove"
        type="button"
        aria-label={`Remove card ${number}`}
        onClick={onRemove}
      >
        {'\u00D7'}
      </button>
    </article>
  );
}

function CardBoard({ cards, onChange }) {
  const boardRef = useRef(null);
  const cardsRef = useRef(cards);
  const dragRef = useRef(null);
  const [focusId, setFocusId] = useState(null);
  const [drag, setDrag] = useState(null);
  const [overBin, setOverBin] = useState(null);

  cardsRef.current = cards;

  useEffect(() => {
    if (!focusId) return undefined;
    const field = document.getElementById(`card-${focusId}`);
    field?.focus();
    setFocusId(null);
    return undefined;
  }, [focusId]);

  const writeCards = (next) => {
    cardsRef.current = next;
    onChange(next);
  };

  const patchCard = (id, patch, toFront) => {
    const current = cardsRef.current;
    const card = current.find((entry) => entry.id === id);
    if (!card) return;
    const updated = { ...card, ...patch };
    const rest = current.filter((entry) => entry.id !== id);
    writeCards(toFront ? [...rest, updated] : current.map((entry) => (
      entry.id === id ? updated : entry
    )));
  };

  const locate = (clientX, clientY, dragState) => {
    const board = boardRef.current.getBoundingClientRect();
    const maxX = Math.max(0, 1 - dragState.width / board.width);
    const maxY = Math.max(0, 1 - dragState.height / board.height);
    const x = Math.min(maxX, Math.max(0, (clientX - dragState.offsetX - board.left) / board.width));
    const y = Math.min(maxY, Math.max(0, (clientY - dragState.offsetY - board.top) / board.height));
    const centerX = board.left + x * board.width + dragState.width / 2;
    const centerY = board.top + y * board.height + dragState.height / 2;
    let bin = '';
    boardRef.current.querySelectorAll('[data-bin]').forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (centerX >= rect.left && centerX <= rect.right && centerY >= rect.top && centerY <= rect.bottom) {
        bin = section.dataset.bin;
      }
    });
    return { x, y, bin };
  };

  const addCard = () => {
    const id = createCardId();
    writeCards([...cardsRef.current, { id, text: '', bin: '', x: null, y: null }]);
    setFocusId(id);
  };

  const updateText = (id, text) => patchCard(id, { text });

  const removeCard = (id) => {
    writeCards(cardsRef.current.filter((card) => card.id !== id));
  };

  const nudge = (card, event) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.06 : 0.03;
    const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
    const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
    const origin = card.x == null ? { x: 0.04, y: 0.08 } : card;
    const surface = event.currentTarget.closest('.user-research-card');
    const board = boardRef.current?.getBoundingClientRect();
    const width = surface?.offsetWidth || 0;
    const height = surface?.offsetHeight || 0;
    const maxX = board ? Math.max(0, 1 - width / board.width) : 1;
    const maxY = board ? Math.max(0, 1 - height / board.height) : 1;
    const x = Math.min(maxX, Math.max(0, origin.x + dx));
    const y = Math.min(maxY, Math.max(0, origin.y + dy));
    const spot = locate(
      (board?.left || 0) + x * (board?.width || 0),
      (board?.top || 0) + y * (board?.height || 0),
      { offsetX: 0, offsetY: 0, width, height },
    );
    patchCard(card.id, { x, y, bin: spot.bin }, true);
  };

  const moveDrag = (event) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const moved = current.moved || Math.hypot(event.clientX - current.clientX, event.clientY - current.clientY) > 3;
    const next = {
      ...current,
      clientX: event.clientX,
      clientY: event.clientY,
      moved,
    };
    dragRef.current = next;
    setDrag(next);
    if (moved) setOverBin(locate(event.clientX, event.clientY, next).bin);
  };

  const endDrag = (event) => {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    window.removeEventListener('pointermove', moveDrag);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    if (current.moved) {
      const spot = locate(event.clientX, event.clientY, current);
      patchCard(current.id, spot, true);
    }
    dragRef.current = null;
    setDrag(null);
    setOverBin(null);
  };

  const startDrag = (event, card) => {
    if (event.button !== 0) return;
    if (event.target.closest('textarea, .user-research-card-remove')) return;
    const surface = event.currentTarget;
    const rect = surface.getBoundingClientRect();
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // The drag still follows the pointer through the window listeners.
    }
    const next = {
      id: card.id,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      clientX: event.clientX,
      clientY: event.clientY,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
  };

  const renderCard = (card) => {
    const number = cards.findIndex((entry) => entry.id === card.id) + 1;
    const dragging = drag?.id === card.id ? drag : null;
    return (
      <SortCard
        key={card.id}
        card={card}
        number={number}
        placed={card.x != null && card.y != null}
        dragStyle={dragging?.moved ? {
          position: 'fixed',
          left: dragging.clientX - dragging.offsetX,
          top: dragging.clientY - dragging.offsetY,
          width: dragging.width,
          zIndex: 30,
        } : null}
        onText={(text) => updateText(card.id, text)}
        onRemove={() => removeCard(card.id)}
        onPointerDown={(event) => startDrag(event, card)}
        onNudge={(event) => nudge(card, event)}
      />
    );
  };

  const loose = cards.filter((card) => card.x == null || card.y == null);
  const placed = cards.filter((card) => card.x != null && card.y != null);

  return (
    <div className="user-research-board-wrap">
      <div className="user-research-board" ref={boardRef}>
        {BINS.map((bin) => (
          <section
            key={bin.id}
            className={`user-research-quadrant${overBin === bin.id ? ' is-drop' : ''}`}
            data-bin={bin.id}
            aria-label={`${bin.title}. ${bin.description}`}
          >
            <div className="user-research-quadrant-label">
              <h2>{bin.title}</h2>
              <p>{bin.description}</p>
            </div>
          </section>
        ))}
        {placed.map((card) => renderCard(card))}
      </div>
      <div className="user-research-card-dock">
        {loose.length > 0 && (
          <ul className="user-research-loose-cards" aria-label="Cards not yet placed">
            {loose.map((card) => <li key={card.id}>{renderCard(card)}</li>)}
          </ul>
        )}
        <div className="user-research-card-actions">
          <button className="user-research-add-card" type="button" onClick={addCard}>
            Add card
          </button>
          <p className="user-research-card-count">
            {cards.length} {cards.length === 1 ? 'card' : 'cards'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FormatEditor({ value, labelledBy, placeholder, onChange }) {
  const editorRef = useRef(null);
  const selectionRef = useRef(null);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor && document.activeElement !== editor && editor.innerHTML !== value) {
      editor.innerHTML = value;
    }
  }, [value]);

  const emitChange = () => {
    const editor = editorRef.current;
    if (editor) onChange(sanitizeFormat(editor.innerHTML));
  };

  const rememberSelection = () => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (
      editor
      && selection
      && selection.rangeCount
      && editor.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      selectionRef.current = selection.getRangeAt(0).cloneRange();
    }
  };

  const runCommand = (command) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (selection && selectionRef.current) {
      selection.removeAllRanges();
      selection.addRange(selectionRef.current);
    }
    document.execCommand?.(command, false, null);
    rememberSelection();
    emitChange();
  };

  return (
    <div className="user-research-editor">
      <div
        className="user-research-editor-toolbar"
        role="toolbar"
        aria-label="Note formatting"
        onMouseDownCapture={rememberSelection}
      >
        <button type="button" aria-label="Bold" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('bold')}>
          <strong>B</strong>
        </button>
        <button type="button" aria-label="Italic" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('italic')}>
          <em>I</em>
        </button>
        <button type="button" aria-label="Underline" onMouseDown={(event) => event.preventDefault()} onClick={() => runCommand('underline')}>
          <u>U</u>
        </button>
      </div>
      <div
        className="user-research-editor-surface"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-labelledby={labelledBy}
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={emitChange}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={(event) => {
          event.preventDefault();
          const clipboard = event.clipboardData;
          const html = clipboard?.getData('text/html');
          const plain = clipboard?.getData('text/plain') || '';
          const safe = html
            ? sanitizeFormat(html)
            : escapeHTML(plain).replace(/\r?\n/g, '<br>');
          document.execCommand?.('insertHTML', false, safe);
          emitChange();
        }}
      />
    </div>
  );
}

function UserResearch() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    document.title = 'Practice 07: User Research Methods';
  }, []);

  useEffect(() => {
    document.body.classList.add('practice-07');
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.head.appendChild(printRules);
    return () => {
      document.body.classList.remove('practice-07');
      printRules.remove();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
    } catch {
      // The exercise still works when browser storage is unavailable.
    }
  }, [answers]);

  useEffect(() => {
    if (!confirmReset) return undefined;
    const previouslyFocused = document.activeElement;
    confirmRef.current?.querySelector('button')?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') setConfirmReset(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [confirmReset]);

  const resetWork = () => {
    setAnswers(blankAnswers());
    setConfirmReset(false);
    window.scrollTo(0, 0);
  };

  return (
    <main className="user-research-shell">
      <header className="user-research-topbar">
        <div className="topbar-left">
          <Link to="/" className="user-research-home-link">Practices</Link>
          <h1>User Research Methods</h1>
        </div>
        <div className="user-research-actions">
          <button className="reset-button" type="button" onClick={() => setConfirmReset(true)}>
            Reset
          </button>
          <button className="export-pdf" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      <section className="user-research-step is-names" aria-label="Step 01: Student names">
        <div className="user-research-step-head">
          <p className="user-research-step-label">
            <span className="user-research-step-number">01</span>
            Student names
          </p>
        </div>
        <div className="user-research-step-body">
          <div className="user-research-step-copy">
            <p className="user-research-step-prompt" id="names-prompt">List out your names.</p>
          </div>
          <textarea
            className="user-research-names"
            ref={fitTextarea}
            value={answers.names}
            placeholder="One name per line"
            aria-labelledby="names-prompt"
            rows={3}
            onChange={(event) => {
              fitTextarea(event.currentTarget);
              const { value } = event.target;
              setAnswers((current) => ({ ...current, names: value }));
            }}
          />
          <p className="user-research-names-print">
            {answers.names
              .split(/\r?\n/)
              .map((name) => name.trim())
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
      </section>

      <section className="user-research-step is-split is-brief" aria-label="Step 02: Brief">
        <div className="user-research-step-main">
          <div className="user-research-step-head">
            <p className="user-research-step-label">
              <span className="user-research-step-number">02</span>
              Brief
            </p>
          </div>
          <div className="user-research-step-body">
            <p className="user-research-written">
            OCAD University has received a donation and committed to spending it on improving the student experience. The university has chosen to redesign the 6th-floor open space and has hired your group to research the needs of the space’s users. Your team will provide a set of recommendations for improving the space, which will be handed to the interior architects.
            </p>
          </div>
        </div>
        <figure className="user-research-studio">
          <img src={STUDIO_YELLOW} alt="Open studio" />
          <img src={STUDIO_WHITE} alt="Open studio" />
        </figure>
      </section>

      <section className="user-research-step is-observation" aria-label="Step 03: Observation">
        <div className="user-research-step-head">
          <p className="user-research-step-label">
            <span className="user-research-step-number">03</span>
            Observation
          </p>
        </div>
        <div className="user-research-step-body">
          <p className="user-research-written" id="observation-prompt">
            Visit the space and spend a few minutes attending to what it’s like to be in it. Take notes on sensory input (sights, sounds, smells, temperature), how people are using the space, and its advantages and limitations. Collect and dump notes here:
          </p>
          <FormatEditor
            value={answers.observation}
            labelledBy="observation-prompt"
            placeholder="Dump notes here…"
            onChange={(observation) => setAnswers((current) => ({ ...current, observation }))}
          />
        </div>
      </section>

      <section className="user-research-step is-journey" aria-label="Step 04: Journey Map">
        <div className="user-research-step-head">
          <p className="user-research-step-label">
            <span className="user-research-step-number">04</span>
            Journey Map
          </p>
        </div>
        <div className="user-research-step-body is-board">
          <div className="user-research-step-copy">
            <p className="user-research-written">
              Construct a journey map of the current experience of the open studio based on the following conditions.
            </p>
            <dl className="user-research-conditions">
              <div>
                <dt>Persona</dt>
                <dd>Graphic Design students at OCAD University</dd>
              </div>
              <div>
                <dt>Scenario</dt>
                <dd>A weekday spent working at school with no classes</dd>
              </div>
              <div>
                <dt>Expectation</dt>
                <dd>To work through an individual assignment alongside peers</dd>
              </div>
            </dl>
          </div>
          <JourneyMap
            phases={answers.phases || []}
            onChange={(phases) => setAnswers((current) => ({ ...current, phases }))}
          />
        </div>
      </section>

      <section className="user-research-step is-cards" aria-label="Step 05: Card Sort">
        <div className="user-research-step-head">
          <p className="user-research-step-label">
            <span className="user-research-step-number">05</span>
            Card Sort
          </p>
        </div>
        <div className="user-research-step-body is-board">
          <div className="user-research-step-copy">
            <p className="user-research-written" id="cards-prompt">
              In this phase, you are both researchers and subjects. Drawing on your observations, develop a mental model of the ideal space. Create at least 15 cards in total, each naming a single idea, and place them in the following containers:
            </p>
            <p className="user-research-note">
              Note: Write each card as a short, concrete phrase. If a card could fit in more than one container, place it where you think it fits best and note the uncertainty.
            </p>
          </div>
          <CardBoard
            cards={answers.cards || []}
            onChange={(cards) => setAnswers((current) => ({ ...current, cards }))}
          />
        </div>
      </section>

      {confirmReset && (
        <div
          className="user-research-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="user-research-confirm-panel" ref={confirmRef}>
            <p id="reset-confirm-title">Are you sure? This will delete all your progress thus far.</p>
            <div className="user-research-confirm-actions">
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" onClick={resetWork}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default UserResearch;
