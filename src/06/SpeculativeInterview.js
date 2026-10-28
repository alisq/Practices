import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './SpeculativeInterview.css';

const STORAGE_KEY = 'speculative-interview-v1';

const topics = [
  'History and Evolution of Visual Language',
  'Early History of the Web and Interaction Design',
  'Platform Cooperatives and New Digital Models for Ownership',
  'Public Domain and Open Source Information',
];

const topicBriefs = {
  'History and Evolution of Visual Language': [
    'Your expert is an author, theorist and cultural critic whose research on alphabet historiography, modeling interpretation for electronic scholarship, digital aesthetics, the history of visual information design, history of the book and print culture, history of information, and critical studies in visual knowledge representation. Her recent book draws on digital humanities, media studies, and graphic design history to build a shared vocabulary for analyzing how charts, diagrams, maps, and other visuals communicate knowledge. She also explains how the layout and structure of these visuals shape the meaning we take from them.',
    'Your interview is geared towards getting her to apply her historical research to critically analyze the ways that interfaces are changing with the rise of Large Language Models and Agentic AI.',
  ],
  'Early History of the Web and Interaction Design': [
    'Your expert is an artist, curator and theorist. As an artist she has worked steadily since the early 90s making experimental websites and installations (often using animated GIFs as an artistic medium). She regularly writes and publishes about new media, digital folklore, amateur or vernacular web design, the early history of home pages and the early conventions of the web. She famously has argued for designing for technology users as capable and creative agents and against designing digital experiences with too many expectations of passivity, limitations, and simplification.',
    'The goal of your interview is to get her to discuss the relationship between her art practice and her theories of the user.',
  ],
  'Platform Cooperatives and New Digital Models for Ownership': [
    'Your expert is an academic whose work focused on cooperative entrepreneurship in the digital economy. He has written several books both critiquing current structures of the digital economy and promoting alternative models. Furthermore, he has developed  the guiding principles for “platform cooperatives,” worker-owned alternatives to digital “gig economy” services such as Uber and Instacart that promote economic, social, labor, and environmental justice.',
	  'The goal of your interview is to better understand why he feels the need to develop an alternative to the existing “gig economy” model.'
  ],
  
};

const surveyBriefs = {
  'History and Evolution of Visual Language': [
    'Your survey is geared towards determining users\' perceptions of how their own reading practices have changed since the widespread adoption of AI.',
  ],
  'Early History of the Web and Interaction Design': [
    'You are designing a survey to collect user feedback on an online exhibition of digital work. Write questions that determine whether users can adequately navigate and understand the interaction patterns of this (hypothetical) website.',   
  ],
  'Platform Cooperatives and New Digital Models for Ownership': [
    'You are designing a survey for gig economy workers to determine the "pain points" of their current working experiences.'
  ]
};

const steps = [
  {
    id: 'names',
    number: '01',
    title: 'Student names',
    prompt: 'List out your names.',
    placeholder: 'One name per line',
  },
  {
    id: 'topic',
    number: '02',
    title: 'Topic',
    prompt: 'Choose a research topic from the following dropdown.',
    options: topics,
    placeholder: 'Select a topic…',
  },
  {
    id: 'questions',
    number: '03',
    title: 'Expert Interview Questions',
    prompt: 'Write, sequence, and evaluate at least three interview questions for your expert.',
  },
  {
    id: 'surveys',
    number: '04',
    title: 'User Surveys',
    prompt: 'Create and sequence at least three online fields with the goal of collecting anonymous responses.',
  },
];

const MIN_QUESTIONS = 3;
const MIN_SURVEY_FIELDS = 3;
const INPUT_TYPES = [
  'Text entry',
  'Multiple choice (outline choices below)',
  'Sliding scale',
  'Media upload (describe media below)',
];
const SCALES = [
  { key: 'closedOpen', start: 'Closed', end: 'Open ended' },
  { key: 'leadingNeutral', start: 'Leading', end: 'Neutral' },
  { key: 'abstractConcrete', start: 'Abstract', end: 'Concrete' },
];

let idCounter = 0;
const createId = (prefix = 'q') => {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
};

const clampScale = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.max(0, Math.min(100, Math.round(number)));
};

const emptyQuestion = () => ({
  id: createId(),
  text: '',
  closedOpen: 50,
  leadingNeutral: 50,
  abstractConcrete: 50,
});

const blankQuestions = () => Array.from({ length: MIN_QUESTIONS }, () => emptyQuestion());

const readQuestions = (value) => {
  const list = (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : createId(),
      text: typeof entry.text === 'string' ? entry.text : '',
      closedOpen: clampScale(entry.closedOpen),
      leadingNeutral: clampScale(entry.leadingNeutral),
      abstractConcrete: clampScale(entry.abstractConcrete),
    }));
  while (list.length < MIN_QUESTIONS) list.push(emptyQuestion());
  return list;
};

const emptySurvey = () => ({
  id: createId('s'),
  inputType: '',
  description: '',
});

const blankSurveys = () => Array.from({ length: MIN_SURVEY_FIELDS }, () => emptySurvey());

const readSurveys = (value) => {
  const list = (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : createId('s'),
      inputType: INPUT_TYPES.includes(entry.inputType) ? entry.inputType : '',
      description: typeof entry.description === 'string' ? entry.description : '',
    }));
  while (list.length < MIN_SURVEY_FIELDS) list.push(emptySurvey());
  return list;
};

const blankAnswers = () => ({
  names: '',
  topic: '',
  questions: blankQuestions(),
  surveys: blankSurveys(),
});

const readAnswer = (step, saved) => {
  const value = typeof saved?.[step.id] === 'string' ? saved[step.id] : '';
  if (step.options && !step.options.includes(value)) return '';
  return value;
};

const loadAnswers = () => {
  const blank = blankAnswers();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return blank;
    return {
      names: readAnswer(steps[0], saved),
      topic: readAnswer(steps[1], saved),
      questions: readQuestions(saved.questions),
      surveys: readSurveys(saved.surveys),
    };
  } catch {
    return blank;
  }
};

const isStepComplete = (step, answers) => {
  if (step.id === 'questions') {
    return answers.questions.filter((question) => question.text.trim()).length >= MIN_QUESTIONS;
  }
  if (step.id === 'surveys') {
    return (answers.surveys || []).filter((field) => field.inputType && field.description.trim()).length >= MIN_SURVEY_FIELDS;
  }
  const value = answers[step.id] || '';
  if (step.options) return step.options.includes(value);
  return Boolean(value.trim());
};

const revealedCount = (answers) => {
  let count = 1;
  while (count < steps.length && isStepComplete(steps[count - 1], answers)) count += 1;
  return count;
};

const fitTextarea = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

const dropPlaceFor = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

function QuestionList({ questions, onChange }) {
  const [focusId, setFocusId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragIdRef = useRef(null);

  useEffect(() => {
    if (!focusId) return undefined;
    document.getElementById(`question-${focusId}`)?.focus();
    setFocusId(null);
    return undefined;
  }, [focusId]);

  const update = (id, patch) => {
    onChange(questions.map((question) => (
      question.id === id ? { ...question, ...patch } : question
    )));
  };

  const moveBy = (id, delta) => {
    const from = questions.findIndex((question) => question.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= questions.length) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  };

  const dropOn = (id, place) => {
    const fromId = dragIdRef.current;
    clearDrag();
    if (!fromId || fromId === id) return;
    const from = questions.findIndex((question) => question.id === fromId);
    let to = questions.findIndex((question) => question.id === id);
    if (from < 0 || to < 0) return;
    const next = [...questions];
    const [item] = next.splice(from, 1);
    if (from < to) to -= 1;
    next.splice(place === 'after' ? to + 1 : to, 0, item);
    onChange(next);
  };

  const addQuestion = () => {
    const question = emptyQuestion();
    onChange([...questions, question]);
    setFocusId(question.id);
  };

  const remove = (id) => {
    const next = questions.filter((question) => question.id !== id);
    onChange(next.length >= MIN_QUESTIONS ? next : blankQuestions());
  };

  return (
    <div className="interview-questions">
      <ol>
        {questions.map((question, index) => {
          const number = String(index + 1).padStart(2, '0');
          const dropPlace = dropTarget?.id === question.id ? dropTarget.place : null;

          return (
            <li
              className={[
                'interview-question',
                dragId === question.id ? 'is-dragging' : '',
                dropPlace ? `is-drop-${dropPlace}` : '',
              ].filter(Boolean).join(' ')}
              key={question.id}
              onDragOver={(event) => {
                if (!dragIdRef.current || dragIdRef.current === question.id) return;
                event.preventDefault();
                const place = dropPlaceFor(event);
                setDropTarget((current) => (
                  current?.id === question.id && current.place === place
                    ? current
                    : { id: question.id, place }
                ));
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(question.id, dropPlaceFor(event));
              }}
            >
              <div className="interview-question-head">
                <button
                  className="interview-grip"
                  type="button"
                  draggable
                  aria-label={`Reorder question ${number}. Use arrow keys or drag.`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', question.id);
                    const card = event.currentTarget.closest('.interview-question');
                    if (card) event.dataTransfer.setDragImage(card, 24, 24);
                    dragIdRef.current = question.id;
                    setDragId(question.id);
                  }}
                  onDragEnd={clearDrag}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    moveBy(question.id, event.key === 'ArrowUp' ? -1 : 1);
                  }}
                >
                  <span className="interview-grip-mark" aria-hidden="true" />
                </button>
                <span className="interview-question-number">{number}</span>
                {questions.length > MIN_QUESTIONS && (
                  <button
                    className="interview-question-remove"
                    type="button"
                    onClick={() => remove(question.id)}
                    aria-label={`Remove question ${number}`}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="interview-question-row">
                <textarea
                  id={`question-${question.id}`}
                  value={question.text}
                  placeholder="Write a question…"
                  aria-label={`Interview question ${number}`}
                  onChange={(event) => update(question.id, { text: event.target.value })}
                />
                <fieldset className="interview-eval">
                  <legend><span>Evaluation</span></legend>
                  {SCALES.map((scale) => {
                    const startId = `${question.id}-${scale.key}-start`;
                    const endId = `${question.id}-${scale.key}-end`;
                    return (
                      <div className="interview-scale" key={scale.key}>
                        <span id={startId}>{scale.start}</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={question[scale.key]}
                          aria-labelledby={`${startId} ${endId}`}
                          onChange={(event) => update(question.id, {
                            [scale.key]: clampScale(event.target.value),
                          })}
                        />
                        <span id={endId}>{scale.end}</span>
                      </div>
                    );
                  })}
                </fieldset>
              </div>
            </li>
          );
        })}
      </ol>
      <button className="interview-add" type="button" onClick={addQuestion}>
        + Add question
      </button>
    </div>
  );
}

function SurveyList({ fields, onChange }) {
  const [focusId, setFocusId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragIdRef = useRef(null);

  useEffect(() => {
    if (!focusId) return undefined;
    document.getElementById(`survey-${focusId}`)?.focus();
    setFocusId(null);
    return undefined;
  }, [focusId]);

  const update = (id, patch) => {
    onChange(fields.map((field) => (
      field.id === id ? { ...field, ...patch } : field
    )));
  };

  const moveBy = (id, delta) => {
    const from = fields.findIndex((field) => field.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= fields.length) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  };

  const dropOn = (id, place) => {
    const fromId = dragIdRef.current;
    clearDrag();
    if (!fromId || fromId === id) return;
    const from = fields.findIndex((field) => field.id === fromId);
    let to = fields.findIndex((field) => field.id === id);
    if (from < 0 || to < 0) return;
    const next = [...fields];
    const [item] = next.splice(from, 1);
    if (from < to) to -= 1;
    next.splice(place === 'after' ? to + 1 : to, 0, item);
    onChange(next);
  };

  const addField = () => {
    const field = emptySurvey();
    onChange([...fields, field]);
    setFocusId(field.id);
  };

  const remove = (id) => {
    const next = fields.filter((field) => field.id !== id);
    onChange(next.length >= MIN_SURVEY_FIELDS ? next : blankSurveys());
  };

  return (
    <div className="interview-questions">
      <ol>
        {fields.map((field, index) => {
          const number = String(index + 1).padStart(2, '0');
          const dropPlace = dropTarget?.id === field.id ? dropTarget.place : null;

          return (
            <li
              className={[
                'interview-question',
                dragId === field.id ? 'is-dragging' : '',
                dropPlace ? `is-drop-${dropPlace}` : '',
              ].filter(Boolean).join(' ')}
              key={field.id}
              onDragOver={(event) => {
                if (!dragIdRef.current || dragIdRef.current === field.id) return;
                event.preventDefault();
                const place = dropPlaceFor(event);
                setDropTarget((current) => (
                  current?.id === field.id && current.place === place
                    ? current
                    : { id: field.id, place }
                ));
              }}
              onDrop={(event) => {
                event.preventDefault();
                dropOn(field.id, dropPlaceFor(event));
              }}
            >
              <div className="interview-question-head">
                <button
                  className="interview-grip"
                  type="button"
                  draggable
                  aria-label={`Reorder field ${number}. Use arrow keys or drag.`}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', field.id);
                    const card = event.currentTarget.closest('.interview-question');
                    if (card) event.dataTransfer.setDragImage(card, 24, 24);
                    dragIdRef.current = field.id;
                    setDragId(field.id);
                  }}
                  onDragEnd={clearDrag}
                  onKeyDown={(event) => {
                    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                    event.preventDefault();
                    moveBy(field.id, event.key === 'ArrowUp' ? -1 : 1);
                  }}
                >
                  <span className="interview-grip-mark" aria-hidden="true" />
                </button>
                <span className="interview-question-number">{number}</span>
                {fields.length > MIN_SURVEY_FIELDS && (
                  <button
                    className="interview-question-remove"
                    type="button"
                    onClick={() => remove(field.id)}
                    aria-label={`Remove field ${number}`}
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="interview-question-row">
                <label className="interview-field">
                  <span>Input type</span>
                  <select
                    id={`survey-${field.id}`}
                    className={field.inputType ? '' : 'is-empty'}
                    value={field.inputType}
                    aria-label={`Input type for field ${number}`}
                    onChange={(event) => update(field.id, { inputType: event.target.value })}
                  >
                    <option value="" disabled>Select an input type…</option>
                    {INPUT_TYPES.map((type) => (
                      <option value={type} key={type}>{type}</option>
                    ))}
                  </select>
                </label>
                <label className="interview-field">
                  <span>Question description</span>
                  <textarea
                    value={field.description}
                    placeholder="Describe the question…"
                    aria-label={`Question description for field ${number}`}
                    onChange={(event) => update(field.id, { description: event.target.value })}
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      <button className="interview-add" type="button" onClick={addField}>
        + Add field
      </button>
    </div>
  );
}

function SpeculativeInterview() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    document.title = 'Practice 06: Speculative Interview';
  }, []);

  useEffect(() => {
    document.body.classList.add('practice-06');
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.head.appendChild(printRules);
    return () => {
      document.body.classList.remove('practice-06');
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

  const setQuestions = (questions) => {
    setAnswers((current) => ({ ...current, questions }));
  };

  const setSurveys = (surveys) => {
    setAnswers((current) => ({ ...current, surveys }));
  };

  const names = answers.names
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ');
  const revealed = revealedCount(answers);
  const brief = topicBriefs[answers.topic] || [];
  const surveyBrief = surveyBriefs[answers.topic] || [];
  const writtenQuestions = answers.questions.filter((question) => question.text.trim());
  const writtenSurveys = (answers.surveys || []).filter((field) => field.inputType || field.description.trim());

  return (
    <main className="interview-shell">
      <header className="interview-topbar">
        <div className="topbar-left">
          <Link to="/" className="interview-home-link">Practices</Link>
          <h1>Speculative Interview</h1>
        </div>
        <div className="interview-actions">
          <button className="reset-button" type="button" onClick={() => setConfirmReset(true)}>
            Reset
          </button>
          <button className="export-pdf" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      {confirmReset && (
        <div
          className="interview-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="interview-confirm-panel" ref={confirmRef}>
            <p id="reset-confirm-title">Are you sure? This will delete all your progress thus far.</p>
            <div className="interview-confirm-actions">
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" onClick={resetWork}>Reset</button>
            </div>
          </div>
        </div>
      )}

      <article className="interview-print">
        {names && <p className="interview-print-names">{names}</p>}
        {answers.topic && <h1>{answers.topic}</h1>}
        {brief.length > 0 && (
          <div className="interview-print-brief">
            {brief.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        )}
        {writtenQuestions.length > 0 && (
          <ol className="interview-print-questions">
            {writtenQuestions.map((question) => (
              <li key={question.id}>
                <p>{question.text.trim()}</p>
                {SCALES.map((scale) => (
                  <p className="interview-print-scale" key={scale.key}>
                    <span>{scale.start}</span>
                    <span>{question[scale.key]}</span>
                    <span>{scale.end}</span>
                  </p>
                ))}
              </li>
            ))}
          </ol>
        )}
        {surveyBrief.length > 0 && writtenSurveys.length > 0 && (
          <div className="interview-print-brief">
            {surveyBrief.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </div>
        )}
        {writtenSurveys.length > 0 && (
          <ol className="interview-print-questions">
            {writtenSurveys.map((field) => (
              <li key={field.id}>
                {field.inputType && <p className="interview-print-scale">{field.inputType}</p>}
                {field.description.trim() && <p>{field.description.trim()}</p>}
              </li>
            ))}
          </ol>
        )}
      </article>

      {steps.slice(0, revealed).map((step, index) => (
        <section
          className="interview-step"
          key={step.id}
          aria-label={`Step ${step.number}: ${step.title}`}
        >
          <div className="interview-step-head">
            <p className="interview-step-label">
              <span className="interview-step-number">{step.number}</span>
              {step.title}
            </p>
          </div>
          <div className={`interview-step-body ${step.id === 'questions' || step.id === 'surveys' ? 'is-questions' : ''}`}>
            {step.id === 'questions' && brief.length > 0 && (
              <div className="interview-brief">
                {brief.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
            {step.id === 'surveys' && surveyBrief.length > 0 && (
              <div className="interview-brief">
                {surveyBrief.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            )}
            <p className="interview-step-prompt" id={`${step.id}-prompt`}>{step.prompt}</p>
            {step.id === 'questions' ? (
              <QuestionList questions={answers.questions} onChange={setQuestions} />
            ) : step.id === 'surveys' ? (
              <SurveyList fields={answers.surveys} onChange={setSurveys} />
            ) : step.options ? (
              <select
                className={answers[step.id] ? '' : 'is-empty'}
                value={answers[step.id] || ''}
                title={answers[step.id] || undefined}
                aria-labelledby={`${step.id}-prompt`}
                onChange={(event) => {
                  const { value } = event.target;
                  setAnswers((current) => ({ ...current, [step.id]: value }));
                }}
              >
                <option value="" disabled>{step.placeholder}</option>
                {step.options.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            ) : (
              <textarea
                className="interview-names"
                ref={fitTextarea}
                value={answers[step.id]}
                placeholder={step.placeholder}
                aria-labelledby={`${step.id}-prompt`}
                rows={3}
                onChange={(event) => {
                  fitTextarea(event.currentTarget);
                  const { value } = event.target;
                  setAnswers((current) => ({ ...current, [step.id]: value }));
                }}
              />
            )}
            {index === revealed - 1 && index < steps.length - 1 && !isStepComplete(step, answers) && (
              <p className="interview-step-note">Complete this step to continue.</p>
            )}
          </div>
        </section>
      ))}
    </main>
  );
}

export default SpeculativeInterview;
