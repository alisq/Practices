import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './Autosyllabus.css';

const STORAGE_KEY = 'autosyllabus-v1';

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

const WEEK_COUNT = 4;

let linkIdCounter = 0;
const createLinkId = () => {
  linkIdCounter += 1;
  return `link-${Date.now().toString(36)}-${linkIdCounter}`;
};

const emptyLink = () => ({ id: createLinkId(), url: '', title: '' });

const readLinks = (value) => {
  const list = (Array.isArray(value) ? value : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : createLinkId(),
      url: typeof entry.url === 'string' ? entry.url : '',
      title: typeof entry.title === 'string' ? entry.title : '',
    }));
  return list.length ? list : [emptyLink()];
};

const blankWeek = () => ({
  phase: '',
  skills: [emptyLink()],
  readings: [emptyLink()],
});

const readWeeks = (value) => {
  const saved = Array.isArray(value) ? value : [];
  return Array.from({ length: WEEK_COUNT }, (_, index) => {
    const entry = saved[index];
    if (!entry || typeof entry !== 'object') return blankWeek();
    return {
      phase: typeof entry.phase === 'string' ? entry.phase : '',
      skills: readLinks(entry.skills),
      readings: readLinks(entry.readings),
    };
  });
};

const canFetchTitle = (value) => {
  const href = linkHref(value);
  if (!href) return false;
  try {
    return new URL(href).hostname.includes('.');
  } catch {
    return false;
  }
};

const fetchPageTitle = async (value) => {
  const href = linkHref(value);
  if (!href) return '';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(href)}`, {
      signal: controller.signal,
    });
    if (!response.ok) return '';
    const data = await response.json();
    const title = data?.data?.title;
    return typeof title === 'string' ? title.replace(/\s+/g, ' ').trim() : '';
  } catch {
    return '';
  } finally {
    clearTimeout(timer);
  }
};

const linkHref = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch {
    return '';
  }
};

const blankAnswers = () => ({
  name: '',
  question: '',
  skill: '',
  weeks: Array.from({ length: WEEK_COUNT }, () => blankWeek()),
});

const loadAnswers = () => {
  const blank = blankAnswers();
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return blank;
    return {
      name: typeof saved.name === 'string' ? saved.name : '',
      question: typeof saved.question === 'string' ? saved.question : '',
      skill: typeof saved.skill === 'string' ? sanitizeFormat(saved.skill) : '',
      weeks: readWeeks(saved.weeks),
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
    <div className="syllabus-editor">
      <div
        className="syllabus-editor-toolbar"
        role="toolbar"
        aria-label="Formatting"
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
        className="syllabus-editor-surface"
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

function PrintLink({ link }) {
  const href = linkHref(link.url);
  const url = link.url.trim();
  const title = (link.title || '').trim();
  const showTitle = title && title !== url;
  return (
    <p className="syllabus-print-link">
      {showTitle && <span className="syllabus-print-link-title">{title}</span>}
      {href ? <a href={href}>{url}</a> : url}
    </p>
  );
}

function LinkList({ links, label, placeholder, onChange, onRetitle }) {
  const [focusId, setFocusId] = useState(null);
  const inputs = useRef({});
  const retitleRef = useRef(onRetitle);
  const attempted = useRef(new Set());
  retitleRef.current = onRetitle;

  useEffect(() => {
    if (!focusId) return undefined;
    inputs.current[focusId]?.focus();
    setFocusId(null);
    return undefined;
  }, [focusId]);

  useEffect(() => {
    const pending = links.filter((link) => {
      const url = link.url.trim();
      return canFetchTitle(url) && !link.title && !attempted.current.has(`${link.id}|${url}`);
    });
    if (!pending.length) return undefined;
    const timer = setTimeout(() => {
      pending.forEach((link) => {
        const url = link.url.trim();
        attempted.current.add(`${link.id}|${url}`);
        fetchPageTitle(url).then((title) => {
          if (title) retitleRef.current?.(link.id, title, url);
        });
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [links]);

  const update = (id, url) => {
    onChange(links.map((link) => (
      link.id === id ? { ...link, url, title: link.url === url ? (link.title || '') : '' } : link
    )));
  };

  const retitle = (id, url) => {
    if (!canFetchTitle(url)) return;
    fetchPageTitle(url).then((title) => {
      if (title) retitleRef.current?.(id, title, url);
    });
  };

  const addAt = (index) => {
    const link = emptyLink();
    const next = [...links];
    next.splice(index, 0, link);
    onChange(next);
    setFocusId(link.id);
  };

  const remove = (id) => {
    const next = links.filter((link) => link.id !== id);
    onChange(next.length ? next : [emptyLink()]);
  };

  const written = links.filter((link) => link.url.trim());

  return (
    <div className="syllabus-links">
      <p className="syllabus-field-label">{label}</p>
      <ol>
        {links.map((link, index) => (
          <li key={link.id}>
            <input
              ref={(element) => { inputs.current[link.id] = element; }}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              value={link.url}
              placeholder={placeholder}
              aria-label={`${label} ${index + 1}`}
              onChange={(event) => update(link.id, event.target.value)}
              onBlur={(event) => retitle(link.id, event.target.value.trim())}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addAt(index + 1);
                }
              }}
            />
            <button
              className="syllabus-link-remove"
              type="button"
              onClick={() => remove(link.id)}
              aria-label={`Remove ${label} ${index + 1}`}
            >
              &times;
            </button>
          </li>
        ))}
      </ol>
      <button className="syllabus-add" type="button" aria-label={`Add ${label}`} onClick={() => addAt(links.length)}>
        + Add link
      </button>
      {written.length > 0 && (
        <ul className="syllabus-print-links">
          {written.map((link) => {
            const href = linkHref(link.url);
            return (
              <li key={link.id}>
                {href ? <a href={href}>{link.url.trim()}</a> : link.url.trim()}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Autosyllabus() {
  const [answers, setAnswers] = useState(loadAnswers);
  const [confirmReset, setConfirmReset] = useState(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    document.title = 'Practice 08: Autosyllabus';
  }, []);

  useEffect(() => {
    document.body.classList.add('practice-08');
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 0.5in; } @media print { html { height: auto; overflow: visible; } }';
    document.head.appendChild(printRules);
    return () => {
      document.body.classList.remove('practice-08');
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
    <main className="syllabus-shell">
      <header className="syllabus-topbar">
        <div className="topbar-left">
          <Link to="/" className="syllabus-home-link">Practices</Link>
          <h1>Autosyllabus</h1>
        </div>
        <div className="syllabus-actions">
          <button className="reset-button" type="button" onClick={() => setConfirmReset(true)}>
            Reset
          </button>
          <button className="export-pdf" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      <article className="syllabus-print">
        {answers.name.trim() && <p className="syllabus-print-name">{answers.name.trim()}</p>}
        {answers.question.trim() && <p className="syllabus-print-question">{answers.question.trim()}</p>}
        {answers.skill.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && (
          <div
            className="syllabus-print-skill"
            dangerouslySetInnerHTML={{ __html: sanitizeFormat(answers.skill) }}
          />
        )}
        {answers.weeks.map((week, index) => {
          const resources = week.skills.filter((link) => link.url.trim());
          const readings = week.readings.filter((link) => link.url.trim());
          const objectives = week.phase.trim();
          if (!objectives && !resources.length && !readings.length) return null;
          const number = String(index + 1).padStart(2, '0');
          return (
            <section className="syllabus-print-week" key={number}>
              <h2>Week {number}</h2>
              {objectives && <p className="syllabus-print-objectives">{objectives}</p>}
              {resources.length > 0 && (
                <div className="syllabus-print-group">
                  <h3>Resources</h3>
                  {resources.map((link) => <PrintLink link={link} key={link.id} />)}
                </div>
              )}
              {readings.length > 0 && (
                <div className="syllabus-print-group">
                  <h3>Critical links</h3>
                  {readings.map((link) => <PrintLink link={link} key={link.id} />)}
                </div>
              )}
            </section>
          );
        })}
      </article>

      <section className="syllabus-step is-name" aria-label="Step 01: Your name">
        <div className="syllabus-step-head">
          <p className="syllabus-step-label">
            <span className="syllabus-step-number">01</span>
            Your name
          </p>
        </div>
        <div className="syllabus-step-body">
          <p className="syllabus-step-prompt" id="name-prompt">Your name.</p>
          <input
            className="syllabus-name"
            type="text"
            value={answers.name}
            placeholder="Type your name"
            aria-labelledby="name-prompt"
            autoComplete="name"
            onChange={(event) => {
              const { value } = event.target;
              setAnswers((current) => ({ ...current, name: value }));
            }}
            />
        </div>
      </section>

      <section className="syllabus-step is-question" aria-label="Step 02: Research question">
        <div className="syllabus-step-head">
          <p className="syllabus-step-label">
            <span className="syllabus-step-number">02</span>
            Research question
          </p>
        </div>
        <div className="syllabus-step-body">
          <p className="syllabus-step-prompt" id="question-prompt">
            Write out the current iteration of your research question.
          </p>
          <textarea
            className="syllabus-question"
            ref={fitTextarea}
            value={answers.question}
            placeholder="Write your research question…"
            aria-labelledby="question-prompt"
            rows={4}
            onChange={(event) => {
              fitTextarea(event.currentTarget);
              const { value } = event.target;
              setAnswers((current) => ({ ...current, question: value }));
            }}
          />
        </div>
      </section>

      <section className="syllabus-step is-skill" aria-label="Step 03: Proposed skill">
        <div className="syllabus-step-head">
          <p className="syllabus-step-label">
            <span className="syllabus-step-number">03</span>
            Proposed skill
          </p>
        </div>
        <div className="syllabus-step-body">
          <p className="syllabus-step-prompt" id="skill-prompt">
            What skill do you propose to learn and how does it connect with your research interests?
          </p>
          <FormatEditor
            value={answers.skill}
            labelledBy="skill-prompt"
            placeholder="Write your answer…"
            onChange={(skill) => setAnswers((current) => ({ ...current, skill }))}
          />
        </div>
      </section>

      <section className="syllabus-step is-weeks" aria-label="Step 04: Weeks">
        <div className="syllabus-step-head">
          <p className="syllabus-step-label">
            <span className="syllabus-step-number">04</span>
            Weekly output/research
          </p>
        </div>
        <div className="syllabus-step-body is-weeks">
          {answers.weeks.map((week, index) => {
            const number = String(index + 1).padStart(2, '0');
            const updateWeek = (patch) => {
              setAnswers((current) => ({
                ...current,
                weeks: current.weeks.map((item, itemIndex) => (
                  itemIndex === index ? { ...item, ...patch } : item
                )),
              }));
            };
            const retitle = (field) => (id, title, url) => {
              setAnswers((current) => ({
                ...current,
                weeks: current.weeks.map((item, itemIndex) => (
                  itemIndex === index
                    ? {
                        ...item,
                        [field]: item[field].map((link) => (
                          link.id === id && link.url.trim() === url.trim() ? { ...link, title } : link
                        )),
                      }
                    : item
                )),
              }));
            };
            return (
              <article className="syllabus-week" key={number} aria-label={`Week ${number}`}>
                <h2>Week {number}</h2>
                <label className="syllabus-phase">
                  <span>Objectives</span>
                  <input
                    type="text"
                    value={week.phase}
                    placeholder="Write out your goals for this week"
                    aria-label={`Week ${number} objectives`}
                    onChange={(event) => updateWeek({ phase: event.target.value })}
                  />
                  {week.phase.trim() && <p className="syllabus-print-value">{week.phase.trim()}</p>}
                </label>
                <div className="syllabus-week-columns">
                  <LinkList
                    links={week.skills}
                    label="Skill building resources"
                    placeholder="Paste a link to a tutorial/instructional resource"
                    onChange={(skills) => updateWeek({ skills })}
                    onRetitle={retitle('skills')}
                  />
                  <LinkList
                    links={week.readings}
                    label="Critical readings/artists/artworks"
                    placeholder="Paste a link to critical or thematic resource"
                    onChange={(readings) => updateWeek({ readings })}
                    onRetitle={retitle('readings')}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {confirmReset && (
        <div
          className="syllabus-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="syllabus-confirm-panel" ref={confirmRef}>
            <p id="reset-confirm-title">Are you sure? This will delete all your progress thus far.</p>
            <div className="syllabus-confirm-actions">
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" onClick={resetWork}>Reset</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Autosyllabus;
