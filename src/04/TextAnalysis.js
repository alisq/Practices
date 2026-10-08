import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './TextAnalysis.css';
import content from './content.json';

const STORAGE_KEY = 'text-analysis-v1';
const PROGRESS_KEY = 'text-analysis-step-v1';

const parts = (Array.isArray(content) ? content : [content]).map((part, index) => ({
  ...part,
  number: String(index + 1).padStart(2, '0'),
  steps: part.steps || [],
}));

const sequence = parts.flatMap((part, partIndex) => (
  part.steps.map((step, stepIndex) => ({ partIndex, stepIndex }))
));

const clampStep = (value) => (
  Number.isInteger(value) ? Math.max(0, Math.min(sequence.length - 1, value)) : 0
);

const loadStep = () => {
  try {
    return clampStep(Number(localStorage.getItem(PROGRESS_KEY)));
  } catch {
    return 0;
  }
};

const stepLabel = (position) => {
  const { partIndex, stepIndex } = sequence[position];
  return parts[partIndex].steps[stepIndex].title;
};

let idCounter = 0;
const createId = (prefix) => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

const createStance = () => ({ id: createId('s'), name: '', sentence: '' });
const createTerm = () => ({ id: createId('t'), term: '', definition: '' });

const asString = (value) => (typeof value === 'string' ? value : '');

const isElision = (paragraph) => /^\[(…|\.\.\.)\]$/.test(paragraph.trim());

// Hidden steps measure as zero height, so they're refit when they're shown.
const fitTextarea = (element) => {
  if (!element || !element.offsetParent) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

const readStances = (value) => {
  const list = (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => ({
      id: entry.id,
      name: asString(entry.name),
      sentence: asString(entry.sentence),
    }));
  return list.length ? list : [createStance()];
};

const readTerms = (value) => {
  const list = (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry.id === 'string')
    .map((entry) => ({
      id: entry.id,
      term: asString(entry.term),
      definition: asString(entry.definition),
    }));
  return list.length ? list : [createTerm()];
};

const loadAnswers = () => {
  let saved = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (parsed && typeof parsed === 'object') saved = parsed;
  } catch {
    saved = {};
  }

  return Object.fromEntries(parts.map((part) => {
    const stored = saved[part.id] && typeof saved[part.id] === 'object' ? saved[part.id] : {};
    const answers = {};
    part.steps.forEach((step) => {
      if (step.type === 'stances') answers[step.key] = readStances(stored[step.key]);
      if (step.type === 'terms') answers[step.key] = readTerms(stored[step.key]);
      if (step.type === 'text') answers[step.key] = asString(stored[step.key]);
    });
    return [part.id, answers];
  }));
};

function StanceList({ entries, onChange }) {
  const update = (id, patch) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const remove = (id) => {
    const next = entries.filter((entry) => entry.id !== id);
    onChange(next.length ? next : [createStance()]);
  };

  return (
    <div className="card-list">
      <ol>
        {entries.map((entry, index) => {
          const person = entry.name.trim() || `Person ${index + 1}`;
          const isBlank = !entry.name.trim() && !entry.sentence.trim();

          return (
            <li className={`entry-card ${isBlank ? 'is-blank' : ''}`} key={entry.id}>
              <div className="entry-card-head">
                <span className="entry-card-number">{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={entry.name}
                  onChange={(event) => update(entry.id, { name: event.target.value })}
                  placeholder="Name"
                  aria-label={`Name of person ${index + 1}`}
                />
                <button
                  className="entry-card-remove"
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label={`Remove ${person}`}
                >
                  ×
                </button>
              </div>
              <textarea
                ref={fitTextarea}
                value={entry.sentence}
                onChange={(event) => {
                  fitTextarea(event.currentTarget);
                  update(entry.id, { sentence: event.target.value });
                }}
                placeholder="Your stance, and one sentence from the paragraph that defends it…"
                aria-label={`${person}’s stance and defending sentence`}
              />
              <p className="print-value">
                <strong>{person}</strong>
                {entry.sentence.trim() ? `\n${entry.sentence.trim()}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="card-list-actions">
        <button className="card-list-add" type="button" onClick={() => onChange([...entries, createStance()])}>
          + Add person
        </button>
      </div>
    </div>
  );
}

function TermList({ entries, onChange }) {
  const update = (id, patch) => {
    onChange(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const remove = (id) => {
    const next = entries.filter((entry) => entry.id !== id);
    onChange(next.length ? next : [createTerm()]);
  };

  return (
    <div className="card-list">
      <ol>
        {entries.map((entry, index) => {
          const label = entry.term.trim() || `term ${index + 1}`;
          const isBlank = !entry.term.trim() && !entry.definition.trim();

          return (
            <li className={`entry-card ${isBlank ? 'is-blank' : ''}`} key={entry.id}>
              <div className="entry-card-head">
                <span className="entry-card-number">{String(index + 1).padStart(2, '0')}</span>
                <input
                  value={entry.term}
                  onChange={(event) => update(entry.id, { term: event.target.value })}
                  placeholder="Term"
                  aria-label={`Term ${index + 1}`}
                />
                <button
                  className="entry-card-remove"
                  type="button"
                  onClick={() => remove(entry.id)}
                  aria-label={`Remove ${label}`}
                >
                  ×
                </button>
              </div>
              <textarea
                ref={fitTextarea}
                value={entry.definition}
                onChange={(event) => {
                  fitTextarea(event.currentTarget);
                  update(entry.id, { definition: event.target.value });
                }}
                placeholder="Definition, and where you found it…"
                aria-label={`Definition of ${label}`}
              />
              <p className="print-value">
                <strong>{entry.term.trim() || `Term ${index + 1}`}</strong>
                {entry.definition.trim() ? `\n${entry.definition.trim()}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
      <div className="card-list-actions">
        <button className="card-list-add" type="button" onClick={() => onChange([...entries, createTerm()])}>
          + Add term
        </button>
      </div>
    </div>
  );
}

function TextAnalysis() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [activeStep, setActiveStep] = useState(loadStep);
  const active = sequence[activeStep];

  useEffect(() => {
    document.title = 'Practice 04: Text Analysis';
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROGRESS_KEY, String(activeStep));
    } catch {
      // Progress simply restarts if storage is unavailable.
    }
    document.querySelectorAll('.text-step.is-active textarea').forEach(fitTextarea);
  }, [activeStep]);

  const showStep = (position) => {
    setActiveStep(clampStep(position));
    window.scrollTo(0, 0);
  };

  const navLabel = (position) => {
    const target = sequence[position];
    if (target.partIndex === active.partIndex) return stepLabel(position);
    const part = parts[target.partIndex];
    return `Part ${part.number}: ${part.title}`;
  };

  // Stylesheets are bundled globally, so the print rules for this page have to
  // be tied to the mounted route or they leak into the other practices.
  useEffect(() => {
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.body.classList.add('practice-04');
    document.head.appendChild(printRules);

    return () => {
      document.body.classList.remove('practice-04');
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

  const setAnswer = (partId, key, value) => {
    setAnswers((current) => ({
      ...current,
      [partId]: { ...current[partId], [key]: value },
    }));
  };

  return (
    <main className="text-shell">
      <header className="text-topbar">
        <div className="topbar-left">
          <Link to="/" className="text-home-link">Practices</Link>
          <h1>Text Analysis</h1>
        </div>
        <button className="export-pdf" type="button" onClick={() => window.print()}>
          Export PDF
        </button>
      </header>

      <p className="text-note">NOTE: PLEASE DO NOT RELY ON AI FOR THIS PROJECT. (OBVIOUSLY)</p>

      {parts.map((part, partIndex) => (
        <section
          className={`text-part ${partIndex === active.partIndex ? 'is-active' : ''}`}
          key={part.id}
          aria-label={`Part ${part.number}: ${part.title}`}
        >
          <div className="text-part-label">
            <p>
              <span className="text-part-number">Part {part.number}</span>
              {part.title}
            </p>
            <span className="text-part-progress">
              Step {active.stepIndex + 1} of {part.steps.length}
            </span>
          </div>

          <div className={`text-part-body ${part.textRight ? 'is-text-right' : ''}`}>
            <blockquote className={`text-passage ${part.poem ? 'is-poem' : ''}`}>
              {part.passage.map((paragraph, index) => (
                <p className={isElision(paragraph) ? 'is-elision' : ''} key={index}>{paragraph}</p>
              ))}
              {part.author && (
                <cite>
                  {part.author}
                  {part.citation?.title && (
                    <>
                      {', '}
                      {part.citation.title}
                    </>
                  )}
                  {part.citation?.details && ` ${part.citation.details}`}
                  {part.source && (
                    <>
                      {', '}
                      <a href={part.source.url} target="_blank" rel="noreferrer">{part.source.title}</a>
                      {`, ${part.source.publication}`}
                    </>
                  )}
                </cite>
              )}
            </blockquote>

            <ol className="text-steps">
              {part.steps.map((step, index) => {
                const value = answers[part.id]?.[step.key];
                const isActive = partIndex === active.partIndex && index === active.stepIndex;

                return (
                  <li
                    className={`text-step ${isActive ? 'is-active' : ''}`}
                    key={step.key}
                    aria-label={`Step ${index + 1}: ${step.title}`}
                    aria-hidden={!isActive}
                  >
                    <p className="text-step-label">
                      <span className="text-step-number">{String(index + 1).padStart(2, '0')}</span>
                      {step.title}
                    </p>
                    <p className="text-step-prompt">{step.prompt}</p>

                    {step.type === 'text' && (
                      <>
                        <textarea
                          className={step.tall ? 'is-tall' : ''}
                          ref={fitTextarea}
                          value={value || ''}
                          onChange={(event) => {
                            fitTextarea(event.currentTarget);
                            setAnswer(part.id, step.key, event.target.value);
                          }}
                          placeholder={step.placeholder}
                          aria-label={step.title}
                        />
                        <p className="print-value">{value || ''}</p>
                      </>
                    )}

                    {step.type === 'stances' && (
                      <StanceList
                        entries={value || []}
                        onChange={(entries) => setAnswer(part.id, step.key, entries)}
                      />
                    )}

                    {step.type === 'terms' && (
                      <TermList
                        entries={value || []}
                        onChange={(entries) => setAnswer(part.id, step.key, entries)}
                      />
                    )}

                    {isActive && (
                      <div className="text-step-foot">
                        {activeStep > 0 && (
                          <button
                            className="text-previous"
                            type="button"
                            onClick={() => showStep(activeStep - 1)}
                          >
                            Previous
                          </button>
                        )}
                        {activeStep < sequence.length - 1 && (
                          <button
                            className="text-next"
                            type="button"
                            onClick={() => showStep(activeStep + 1)}
                          >
                            {`Next: ${navLabel(activeStep + 1)}`}
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      ))}
    </main>
  );
}

export default TextAnalysis;
