import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './ArtifactAnnotation.css';
import content from './content.json';

const STORAGE_KEY = 'artifact-annotation-v2';
const IMAGE_DIR = `${process.env.PUBLIC_URL}/images/03`;
const SHUFFLE_ON_LOAD = true;

const asText = (value) => (typeof value === 'string' ? value.trim() : '');

const shuffle = (list) => {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
};

// The artifact set is edited in content.json; the filename doubles as the id so
// reordering the file doesn't scramble saved answers.
const artifacts = (() => {
  const listed = (Array.isArray(content) ? content : [])
    .filter((entry) => asText(entry?.filename))
    .map((entry, index) => {
      const filename = asText(entry.filename);
      return {
        id: filename,
        number: String(index + 1).padStart(2, '0'),
        filename,
        src: `${IMAGE_DIR}/${encodeURIComponent(filename)}`,
        sourceURL: asText(entry.sourceURL),
        description: asText(entry.description),
      };
    });

  return SHUFFLE_ON_LOAD ? shuffle(listed) : listed;
})();

const artifactLabel = (artifact) => artifact.description || `Artifact ${artifact.number}`;

// Filenames are listed in content.json before the images land in
// public/images/03, so a missing file shows its name rather than a broken icon.
function ArtifactImage({ artifact, alt }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="annot-missing" role="img" aria-label={alt || artifact.filename}>
        {artifact.filename}
      </span>
    );
  }

  return (
    <img
      src={artifact.src}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}

// Regular CSS Grid keeps a shared row height, which leaves holes under
// shorter artifacts. Span implicit rows from each card's measured height
// so later tiles pack into those gaps, Pinterest-style.
function useMasonryGrid(ref, enabled) {
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid || !enabled) return;

    const measure = () => {
      const styles = window.getComputedStyle(grid);
      const rowHeight = parseFloat(styles.getPropertyValue('grid-auto-rows')) || 8;
      const gap = parseFloat(styles.getPropertyValue('row-gap')) || 0;

      [...grid.children].forEach((item) => {
        const card = item.firstElementChild || item;
        const height = card.getBoundingClientRect().height;
        const span = Math.max(1, Math.ceil((height + gap) / (rowHeight + gap)));
        if (item.dataset.masonrySpan !== String(span)) {
          item.dataset.masonrySpan = String(span);
          item.style.gridRowEnd = `span ${span}`;
        }
      });
    };

    measure();

    const images = [...grid.querySelectorAll('img')];
    images.forEach((img) => {
      img.addEventListener('load', measure);
      img.addEventListener('error', measure);
    });

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(measure);
    observer?.observe(grid);
    window.addEventListener('resize', measure);

    return () => {
      images.forEach((img) => {
        img.removeEventListener('load', measure);
        img.removeEventListener('error', measure);
      });
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [enabled, ref]);
}

const EDITOR_VERSION = 1;
const ALLOWED_EDITOR_TAGS = new Set([
  'A',
  'B',
  'BLOCKQUOTE',
  'BR',
  'DIV',
  'EM',
  'H3',
  'I',
  'LI',
  'OL',
  'P',
  'STRONG',
  'U',
  'UL',
]);
const BLOCKED_EDITOR_TAGS = new Set(['EMBED', 'IFRAME', 'OBJECT', 'SCRIPT', 'STYLE']);

const escapeHTML = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const plainTextToHTML = (value) => (
  value ? escapeHTML(value).replace(/\r?\n/g, '<br>') : ''
);

const safeLink = (value) => {
  const href = value.trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(href)) return href;
  return '';
};

const sanitizeRichText = (value) => {
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

      if (BLOCKED_EDITOR_TAGS.has(node.tagName)) {
        node.remove();
        return;
      }

      if (!ALLOWED_EDITOR_TAGS.has(node.tagName)) {
        clean(node);
        node.replaceWith(...node.childNodes);
        return;
      }

      const originalHref = node.tagName === 'A' ? node.getAttribute('href') || '' : '';
      [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
      if (node.tagName === 'A') {
        const href = safeLink(originalHref);
        if (href) {
          node.setAttribute('href', href);
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noreferrer');
        } else {
          node.replaceWith(...node.childNodes);
          return;
        }
      }
      clean(node);
    });
  };

  clean(template.content);
  return template.innerHTML;
};

const richTextToPlain = (value) => {
  if (!value || typeof document === 'undefined') return '';
  const template = document.createElement('template');
  template.innerHTML = sanitizeRichText(value);
  return (template.content.textContent || '').replace(/\u00a0/g, ' ').trim();
};

function EditorButton({ label, onClick, children }) {
  return (
    <button
      className="annot-editor-tool"
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function RichTextEditor({ value, onChange, placeholder, label }) {
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
    if (editor) onChange(sanitizeRichText(editor.innerHTML));
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

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const runCommand = (command, commandValue = null) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    document.execCommand?.(command, false, commandValue);
    rememberSelection();
    emitChange();
  };

  const addLink = () => {
    const entered = window.prompt('Link URL');
    if (!entered) return;
    const href = safeLink(entered) || safeLink(`https://${entered}`);
    if (href) runCommand('createLink', href);
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    const plain = clipboard.getData('text/plain');
    const safe = html
      ? sanitizeRichText(html)
      : plainTextToHTML(plain);
    document.execCommand?.('insertHTML', false, safe);
    emitChange();
  };

  const handleBlur = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const safe = sanitizeRichText(editor.innerHTML);
    if (editor.innerHTML !== safe) editor.innerHTML = safe;
    onChange(safe);
  };

  return (
    <div className="annot-editor">
      <div
        className="annot-editor-toolbar"
        role="toolbar"
        aria-label={`${label} formatting`}
        onMouseDownCapture={rememberSelection}
      >
        <select
          className="annot-editor-format"
          aria-label="Text style"
          defaultValue="p"
          onChange={(event) => {
            runCommand('formatBlock', event.target.value);
            event.target.value = 'p';
          }}
        >
          <option value="p">Paragraph</option>
          <option value="h3">Heading</option>
          <option value="blockquote">Quote</option>
        </select>
        <EditorButton label="Bold" onClick={() => runCommand('bold')}>
          <strong>B</strong>
        </EditorButton>
        <EditorButton label="Italic" onClick={() => runCommand('italic')}>
          <em>I</em>
        </EditorButton>
        <EditorButton label="Underline" onClick={() => runCommand('underline')}>
          <u>U</u>
        </EditorButton>
        <EditorButton label="Bulleted list" onClick={() => runCommand('insertUnorderedList')}>
          • List
        </EditorButton>
        <EditorButton label="Numbered list" onClick={() => runCommand('insertOrderedList')}>
          1. List
        </EditorButton>
        <EditorButton label="Add link" onClick={addLink}>
          Link
        </EditorButton>
        <EditorButton label="Remove formatting" onClick={() => runCommand('removeFormat')}>
          Clear
        </EditorButton>
      </div>
      <div
        className="annot-editor-surface"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-label={label}
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emitChange}
        onBlur={handleBlur}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        onPaste={handlePaste}
      />
    </div>
  );
}

const parts = [
  {
    key: 'look',
    number: '02',
    title: 'Formal Analysis: Look closely',
    prompt: 'Look patiently and closely first.',
    editor: false,
  },
  {
    key: 'describe',
    number: '03',
    title: 'Formal Analysis: Describe what you see',
    prompt: 'Describe what you see. Describe the elements, principles, and actions.',
    placeholder: 'Elements, principles, actions…',
  },
  {
    key: 'relationships',
    number: '04',
    title: 'Formal Analysis: Examine relationships',
    prompt: 'Examine relationships between elements.',
    placeholder: 'How do the elements relate…',
  },
  {
    key: 'choices',
    number: '05',
    title: 'Formal Analysis: Articulate formal choices',
    prompt: 'Articulate what each formal choice does.',
    placeholder: 'What each formal choice does…',
  },
  {
    key: 'contextual',
    number: '06',
    title: 'Contextual analysis',
    prompt: 'Using the methods and categories mentioned in today’s lecture, speculate on audience, era, influence, materiality and other contextual clues you can glean from the artifact.',
    placeholder: 'Audience, era, influence, materiality…',
  },
  {
    key: 'facts',
    number: '07',
    title: 'Contextual Analysis: Identify basic facts',
    prompt: 'Identify whatever basic facts about the object that you can determine through online research.',
    placeholder: 'Source, designer, date, place…',
  },
  {
    key: 'history',
    number: '08',
    title: 'Contextual Analysis: Historical/political context',
    prompt: 'What is the historical/political context informing this piece?',
    placeholder: 'Historical and political context…',
  },
  {
    key: 'conventions',
    number: '09',
    title: 'Contextual Analysis: Trends and conventions',
    prompt: 'What key trends/conventions do you think inform the designer’s approach?',
    placeholder: 'Trends and conventions…',
  },
];

const emptyAnswers = () => Object.fromEntries(parts.map((part) => [part.key, '']));

const emptyState = () => ({
  selectedId: null,
  answers: emptyAnswers(),
  activePart: 0,
});

const clampActivePart = (value) => (
  Number.isInteger(value) ? Math.max(0, Math.min(parts.length - 1, value)) : 0
);

const loadState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved !== 'object') return emptyState();

    const selectedId = artifacts.some((artifact) => artifact.id === saved.selectedId)
      ? saved.selectedId
      : null;
    const answers = emptyAnswers();

    const storedAnswers = saved.answers && typeof saved.answers === 'object' ? saved.answers : saved;
    const isLegacyFormal = typeof storedAnswers.formal === 'string' && storedAnswers.look === undefined;

    parts.forEach((part) => {
      const value = part.key === 'describe'
        ? storedAnswers.describe ?? storedAnswers.formal
        : part.key === 'facts'
          ? storedAnswers.facts ?? storedAnswers.provenance
          : storedAnswers[part.key];
      if (typeof value === 'string') {
        answers[part.key] = saved.editorVersion === EDITOR_VERSION
          ? sanitizeRichText(value)
          : plainTextToHTML(value);
      }
    });

    const lastWritten = parts.reduce(
      (highest, part, index) => (richTextToPlain(answers[part.key]) ? index : highest),
      0,
    );
    const rawActive = Number.isInteger(saved.activePart)
      ? saved.activePart
      : Number.isInteger(saved.opened)
        ? saved.opened - 1
        : lastWritten;
    const savedActive = isLegacyFormal && rawActive === 1
      ? parts.findIndex((part) => part.key === 'contextual')
      : isLegacyFormal && rawActive === 2
        ? parts.findIndex((part) => part.key === 'facts')
        : rawActive;

    return {
      selectedId,
      answers,
      activePart: clampActivePart(savedActive),
    };
  } catch {
    return emptyState();
  }
};

function ArtifactAnnotation() {
  const restored = useRef(loadState()).current;
  const [selectedId, setSelectedId] = useState(restored.selectedId);
  const [answers, setAnswers] = useState(restored.answers);
  const [activePart, setActivePart] = useState(restored.activePart);
  const gridRef = useRef(null);

  const selected = artifacts.find((artifact) => artifact.id === selectedId) || null;
  useMasonryGrid(gridRef, !selected);

  useEffect(() => {
    document.title = 'Practice 03: Artifact Annotation';
  }, []);

  useEffect(() => {
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.body.classList.add('practice-03');
    document.head.appendChild(printRules);

    return () => {
      document.body.classList.remove('practice-03');
      printRules.remove();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        selectedId,
        answers,
        activePart,
        editorVersion: EDITOR_VERSION,
      }));
    } catch {
      // The exercise still works when browser storage is unavailable.
    }
  }, [selectedId, answers, activePart]);

  const returnToGrid = () => {
    setSelectedId(null);
    setAnswers(emptyAnswers());
    setActivePart(0);
  };

  const setAnswer = (key, value) => {
    setAnswers((current) => ({ ...current, [key]: value }));
  };

  const showPart = (index) => setActivePart(clampActivePart(index));

  return (
    <main className={`annot-shell ${selected ? 'is-selected' : ''}`}>
      <header className="annot-topbar">
        <div className="topbar-left">
          <Link to="/" className="annot-home-link">Practices</Link>
          <h1>Artifact Annotation</h1>
        </div>
        <div className="header-actions">
          {selected && (
            <button className="reset-button" type="button" onClick={returnToGrid}>
              Change artifact
            </button>
          )}
          <button className="export-pdf" type="button" onClick={() => window.print()}>
            Export PDF
          </button>
        </div>
      </header>

      {selected ? (
        <section className="annot-analyze" aria-label={`Analysis of ${artifactLabel(selected)}`}>
          <figure className="annot-chosen">
            <a
              href={selected.src}
              target="_blank"
              rel="noreferrer"
              aria-label={`Open ${artifactLabel(selected)} image in a new tab`}
            >
              <ArtifactImage artifact={selected} alt={artifactLabel(selected)} />
            </a>
            <figcaption>
              <span className="annot-caption-number">{selected.number}</span>
              <span>{artifactLabel(selected)}</span>
            </figcaption>
          </figure>

          <div className="annot-parts">
            {parts.map((part, index) => {
              const value = answers[part.key];
              const previousPart = parts[index - 1];
              const nextPart = parts[index + 1];
              const isActive = index === activePart;

              return (
                <section
                  className={`annot-part ${isActive ? 'is-active' : ''} ${richTextToPlain(value) ? '' : 'is-blank'}`}
                  key={part.key}
                  aria-label={`Part ${part.number}: ${part.title}`}
                  aria-hidden={!isActive}
                >
                  <p className="annot-part-label">
                    <span className="annot-part-number">{part.number}</span>
                    {part.title}
                  </p>
                  <p className="annot-part-prompt">{part.prompt}</p>
                  {part.editor !== false && (
                    <>
                      <RichTextEditor
                        value={value}
                        onChange={(nextValue) => setAnswer(part.key, nextValue)}
                        placeholder={part.placeholder}
                        label={part.title}
                      />
                      <div
                        className="print-value"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
                      />
                    </>
                  )}
                  {isActive && (previousPart || nextPart) && (
                    <div className="annot-part-foot">
                      {previousPart && (
                        <button
                          className="annot-previous"
                          type="button"
                          onClick={() => showPart(index - 1)}
                        >
                          {`Previous: ${previousPart.title}`}
                        </button>
                      )}
                      {nextPart && (
                        <button
                          className="annot-next"
                          type="button"
                          onClick={() => showPart(index + 1)}
                        >
                          {`Next: ${nextPart.title}`}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="annot-picker" aria-label="Select an artifact">
          <div className="annot-picker-copy">
            <p className="annot-kicker">Part 01</p>
            <h2>Select an artifact</h2>
          </div>
          <ul className="annot-grid" ref={gridRef}>
            {artifacts.map((artifact) => (
              <li key={artifact.id}>
                <button
                  type="button"
                  className="annot-tile"
                  onClick={() => setSelectedId(artifact.id)}
                >
                  <ArtifactImage artifact={artifact} alt="" />
                  <span className="annot-tile-label">
                    <em>{artifact.number}</em>
                    {artifactLabel(artifact)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

export default ArtifactAnnotation;
