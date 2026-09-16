import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './MettleTest.css';

const STORAGE_KEY = 'mettle-test-answers-v1';
const PROGRESS_KEY = 'mettle-test-progress-v1';
const TOTAL_PARTS = 7;
const MIN_ASSESSMENTS = 2;
const MIN_REFINED = 2;

const topics = [
  'Artifice and perfection in images of contemporary architecture',
  'Typography in science fiction film',
  'Fibre arts and the machines that make images from thread',
  'Motion and interaction in brand identity',
  'Digital voter ID and democratic participation',
  'Interaction design against screen addiction',
  'DIY screenprinting',
  'Visual histories of ecofeminism',
];

let idCounter = 0;
const createEntry = () => {
  idCounter += 1;
  return { id: `e-${Date.now().toString(36)}-${idCounter}`, text: '' };
};

const readList = (answers, key) => (answers[key] || []).map((entry) => (
  typeof entry === 'string' ? { id: entry, text: entry } : entry
));

const writtenList = (answers, key) => readList(answers, key).filter((entry) => entry.text.trim());

const countFilled = (entries, values) => entries.filter((entry) => values[entry.id]?.trim()).length;

const fitTextarea = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

function EntryList({ entries, onChange, placeholder, label, variant }) {
  const [focusId, setFocusId] = useState(null);
  const inputs = useRef({});
  const written = entries.filter((entry) => entry.text.trim()).length;

  useEffect(() => {
    if (!focusId) return;
    inputs.current[focusId]?.focus();
    setFocusId(null);
  }, [focusId]);

  const updateEntry = (id, text) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, text } : entry)));
  };

  const addEntry = () => {
    const entry = createEntry();
    onChange([...entries, entry]);
    setFocusId(entry.id);
  };

  const removeEntry = (id) => {
    const next = entries.filter((entry) => entry.id !== id);
    onChange(next.length ? next : [createEntry()]);
  };

  return (
    <div className={`entry-list ${variant === 'large' ? 'is-large' : ''}`}>
      <ol>
        {entries.map((entry, index) => (
          <li className={entry.text.trim() ? '' : 'is-blank'} key={entry.id}>
            <span className="entry-number">{String(index + 1).padStart(2, '0')}</span>
            <input
              ref={(element) => { inputs.current[entry.id] = element; }}
              value={entry.text}
              onChange={(event) => updateEntry(entry.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addEntry();
                }
              }}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
            />
            <button
              className="entry-remove"
              onClick={() => removeEntry(entry.id)}
              aria-label={`Remove ${label.toLowerCase()} ${index + 1}`}
            >
              ×
            </button>
            <p className="print-value">{entry.text}</p>
          </li>
        ))}
      </ol>
      <div className="entry-actions">
        <button className="entry-add" onClick={addEntry}>+ Add {label.toLowerCase()}</button>
        <span className="entry-count">{String(written).padStart(2, '0')} written</span>
      </div>
    </div>
  );
}

function CardNotes({ entries, values, onChange, placeholder, labelPrefix, countLabel }) {
  const filled = countFilled(entries, values);

  return (
    <div className="card-notes">
      <div className="card-grid">
        {entries.map((entry, index) => (
          <article className="note-card" key={entry.id}>
            <div className="note-question">
              <span className="entry-number">{String(index + 1).padStart(2, '0')}</span>
              <p>{entry.text}</p>
            </div>
            <textarea
              ref={fitTextarea}
              value={values[entry.id] || ''}
              onChange={(event) => {
                fitTextarea(event.currentTarget);
                onChange({ ...values, [entry.id]: event.target.value });
              }}
              placeholder={placeholder}
              aria-label={`${labelPrefix}: ${entry.text}`}
            />
            <p className="print-value">{values[entry.id] || ''}</p>
          </article>
        ))}
      </div>
      <p className="card-count">{filled} of {entries.length} {countLabel}</p>
    </div>
  );
}

const parts = [
  {
    id: 'topic',
    number: '01',
    title: 'Topic Selection',
    minutes: 3,
    instruction: 'As a group, choose one research topic from the list.',
    isComplete: (answers) => Boolean(answers.topic),
    completeNote: (answers) => `Topic locked in: ${answers.topic}`,
    render: ({ answers, setAnswer }) => (
      <label className="topic-picker">
        <span>Research topic</span>
        <select
          value={answers.topic || ''}
          onChange={(event) => setAnswer('topic', event.target.value)}
        >
          <option value="" disabled>Select a topic…</option>
          {topics.map((topic) => (
            <option value={topic} key={topic}>{topic}</option>
          ))}
        </select>
        <p className="print-value">{answers.topic || ''}</p>
      </label>
    ),
  },
  {
    id: 'sources',
    number: '02',
    title: 'Information Gathering',
    minutes: 15,
    instruction: 'Spend 10 minutes individually on quick preliminary research, then 5 minutes comparing findings. Paste all your sources below.',
    aside: 'When you do this for real, it takes days, not minutes.',
    isComplete: (answers) => Boolean(answers.sources?.trim()),
    completeNote: () => 'Sources recorded.',
    render: ({ answers, setAnswer }) => (
      <label className="source-dump">
        <span>Sources</span>
        <textarea
          ref={fitTextarea}
          value={answers.sources || ''}
          onChange={(event) => {
            fitTextarea(event.currentTarget);
            setAnswer('sources', event.target.value);
          }}
          placeholder="Links, citations, names, archives, anything you found…"
        />
        <p className="print-value">{answers.sources || ''}</p>
      </label>
    ),
  },
  {
    id: 'questions',
    number: '03',
    title: 'Research Questions',
    minutes: 10,
    // Each question is reprinted on its Part 04 card.
    printHidden: true,
    instruction: 'Generate as many research questions as you can.',
    aside: 'No bad ideas. Quantity over quality.',
    isComplete: (answers) => writtenList(answers, 'questions').length >= MIN_ASSESSMENTS,
    completeNote: (answers) => {
      const written = writtenList(answers, 'questions').length;
      return `${written} question${written === 1 ? '' : 's'} written.`;
    },
    render: ({ answers, setAnswer }) => (
      <EntryList
        entries={readList(answers, 'questions')}
        onChange={(questions) => setAnswer('questions', questions)}
        placeholder="Write a question…"
        label="Question"
      />
    ),
  },
  {
    id: 'critique',
    number: '04',
    title: 'Critique',
    minutes: 10,
    wide: true,
    instruction: 'Write a short assessment of each question.',
    aside: 'Is it too broad? Too specific? Is it researchable with the time and access you’d actually have? Does it connect to design?',
    isComplete: (answers) => (
      countFilled(writtenList(answers, 'questions'), answers.critiques || {}) >= MIN_ASSESSMENTS
    ),
    completeNote: (answers) => {
      const assessed = countFilled(writtenList(answers, 'questions'), answers.critiques || {});
      return `${assessed} questions assessed.`;
    },
    render: ({ answers, setAnswer }) => (
      <CardNotes
        entries={writtenList(answers, 'questions')}
        values={answers.critiques || {}}
        onChange={(critiques) => setAnswer('critiques', critiques)}
        placeholder="Short assessment…"
        labelPrefix="Assessment of"
        countLabel={`assessed — ${MIN_ASSESSMENTS} required`}
      />
    ),
  },
  {
    id: 'refined',
    number: '05',
    title: 'Refine',
    minutes: 10,
    // Each refined question is reprinted on its Part 06 card.
    printHidden: true,
    instruction: 'Working together, develop at least two refined research questions.',
    isComplete: (answers) => writtenList(answers, 'refined').length >= MIN_REFINED,
    completeNote: (answers) => `${writtenList(answers, 'refined').length} refined questions.`,
    render: ({ answers, setAnswer }) => (
      <EntryList
        entries={readList(answers, 'refined')}
        onChange={(refined) => setAnswer('refined', refined)}
        placeholder="Write a refined question…"
        label="Refined question"
        variant="large"
      />
    ),
  },
  {
    id: 'methods',
    number: '06',
    title: 'Methods',
    minutes: 10,
    wide: true,
    instruction: 'For each refined question, propose at least one method of investigation.',
    aside: 'Is the data primary or secondary? Is the method theory-based or practice-based? Most will traverse the spectrum rather than land on one side.',
    isComplete: (answers) => {
      const refined = writtenList(answers, 'refined');
      return refined.length > 0
        && refined.every((entry) => answers.methods?.[entry.id]?.trim());
    },
    completeNote: (answers) => {
      const refined = writtenList(answers, 'refined');
      return `${refined.length} questions have methods.`;
    },
    render: ({ answers, setAnswer }) => (
      <CardNotes
        entries={writtenList(answers, 'refined')}
        values={answers.methods || {}}
        onChange={(methods) => setAnswer('methods', methods)}
        placeholder="Method of investigation…"
        labelPrefix="Method for"
        countLabel="with a method"
      />
    ),
  },
  {
    id: 'output',
    number: '07',
    title: 'Output',
    minutes: 5,
    instruction: 'What’s your proposed output — book, application, font, tapestry, something else?',
    aside: 'Justify the choice.',
    isComplete: (answers) => Boolean(answers.output?.trim()),
    completeNote: () => 'Output proposed. Export a PDF to hand in.',
    render: ({ answers, setAnswer }) => (
      <label className="source-dump">
        <span>Proposed output</span>
        <textarea
          ref={fitTextarea}
          value={answers.output || ''}
          onChange={(event) => {
            fitTextarea(event.currentTarget);
            setAnswer('output', event.target.value);
          }}
          placeholder="What you would make, and why that form and not another…"
        />
        <p className="print-value">{answers.output || ''}</p>
      </label>
    ),
  },
];

const loadAnswers = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
};

const loadUnlocked = (answers) => {
  let derived = 1;
  while (derived < parts.length && parts[derived - 1].isComplete(answers)) derived += 1;

  let saved = 1;
  try {
    saved = Number(localStorage.getItem(PROGRESS_KEY)) || 1;
  } catch {
    saved = 1;
  }

  return Math.min(parts.length, Math.max(derived, saved));
};

const formatClock = (seconds) => {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

function MettleTest() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [unlocked, setUnlocked] = useState(() => loadUnlocked(loadAnswers()));
  const [now, setNow] = useState(() => Date.now());
  const [pendingScroll, setPendingScroll] = useState(null);
  const startTimes = useRef({});
  const sectionRefs = useRef([]);

  useEffect(() => {
    document.title = 'Practice 02: Research Question Mettle Testing';
  }, []);

  // Stylesheets are bundled globally, so the print rules for this page have to
  // be tied to the mounted route or they leak into the other practices.
  useEffect(() => {
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.body.classList.add('practice-02');
    document.head.appendChild(printRules);

    return () => {
      document.body.classList.remove('practice-02');
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
    try {
      localStorage.setItem(PROGRESS_KEY, String(unlocked));
    } catch {
      // Progress simply restarts if storage is unavailable.
    }
  }, [unlocked]);

  useEffect(() => {
    setAnswers((current) => {
      const seeded = { ...current };
      if (!current.questions?.length) seeded.questions = [createEntry()];
      if (!current.refined?.length) seeded.refined = [createEntry()];
      return seeded;
    });
  }, []);

  useEffect(() => {
    for (let index = 0; index < unlocked; index += 1) {
      if (!startTimes.current[index]) startTimes.current[index] = Date.now();
    }
  }, [unlocked]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (pendingScroll === null) return;
    sectionRefs.current[pendingScroll]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPendingScroll(null);
  }, [pendingScroll]);

  const setAnswer = (key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const advanceFrom = (index) => {
    setUnlocked((current) => Math.max(current, index + 2));
    setPendingScroll(index + 1);
  };

  const remainingFor = (index, minutes) => {
    const startedAt = startTimes.current[index];
    if (!startedAt) return minutes * 60;
    return Math.ceil((startedAt + minutes * 60 * 1000 - now) / 1000);
  };

  return (
    <main className="mettle-shell">
      <header className="mettle-topbar">
        <div className="topbar-left">
          <button className="export-pdf" onClick={() => window.print()}>Export PDF</button>
          <Link to="/" className="mettle-home-link">Practices</Link>
        </div>
        <h1>Research Question Mettle Testing</h1>
        <span className="mettle-progress">
          {String(Math.min(unlocked, TOTAL_PARTS)).padStart(2, '0')} / {String(TOTAL_PARTS).padStart(2, '0')}
        </span>
      </header>

      {parts.slice(0, unlocked).map((part, index) => {
        const remaining = remainingFor(index, part.minutes);
        const isExpired = remaining <= 0;
        const isComplete = part.isComplete(answers);
        const nextPart = parts[index + 1];

        return (
          <section
            className={`mettle-section ${part.printHidden ? 'is-print-hidden' : ''}`}
            key={part.id}
            ref={(element) => { sectionRefs.current[index] = element; }}
            aria-label={`Part ${part.number}: ${part.title}`}
          >
            <div className="section-head">
              <p className="section-label">
                <span className="section-number">{part.number}</span>
                {part.title}
              </p>
              <p className={`section-timer ${isExpired ? 'is-expired' : ''}`} role="timer">
                <span>{isExpired ? 'Time' : formatClock(remaining)}</span>
                <em>{isExpired ? `${part.minutes} min elapsed` : `of ${part.minutes} min`}</em>
              </p>
            </div>

            <div className={`section-body ${part.wide ? 'is-wide' : ''}`}>
              <div className="section-prompt">
                <p className="section-instruction">{part.instruction}</p>
                {part.aside && <p className="section-aside">{part.aside}</p>}
              </div>
              {part.render({ answers, setAnswer })}
            </div>

            <div className="section-foot">
              {nextPart ? (
                <>
                  <button
                    className="section-advance"
                    onClick={() => advanceFrom(index)}
                    disabled={!isComplete}
                  >
                    {`Continue to ${nextPart.title}`}
                  </button>
                  {!isComplete && <p className="section-note">Complete this section to continue.</p>}
                </>
              ) : (
                <p className="section-note">
                  {isComplete ? part.completeNote(answers) : 'Complete this section to finish.'}
                </p>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}

export default MettleTest;
