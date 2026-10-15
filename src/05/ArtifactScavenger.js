import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './ArtifactScavenger.css';

const STORAGE_KEY = 'artifact-scavenger-v1';
const DB_NAME = 'artifact-scavenger';
const STORE = 'answers';
const MIN_ARTIFACTS = 5;
const MAX_IMAGE_EDGE = 1600;

const archiveTitles = [
  'Inscription',
  'Craft & automation',
  'Under the influence',
  'Cultural Digression',
  'Skeuomorphism through time',
  'Branding territory',
  'Creation myths',
];

const approvedArchives = [
  {
    href: 'https://docs.google.com/spreadsheets/d/1lyvVIqdGW78vftPu3rBUUqHfiFPltYntCLPUbkWxYew/edit?gid=1338835730#gid=1338835730',
    label: 'Casual Archivist: Sources',
  },
];

const steps = [
  {
    id: 'names',
    number: '01',
    title: 'Student names',
    prompt: 'List out your names.',
    text: true,
    placeholder: 'One name per line',
  },
  {
    id: 'title',
    number: '02',
    title: 'Archive title',
    prompt: 'Pick a title from the following drop down',
    options: archiveTitles,
    placeholder: 'Select a title…',
  },
  {
    id: 'archive',
    number: '03',
    title: 'Create Archive',
    prompt: 'Starting with Elizabeth Goodspeed\'s Casual Archivist: Sources, collect & sequence at least 5 artifacts that relate to your topic',
    help: 'Don\'t just pick the first images you find... explore, collect, edit, then upload',
    archives: approvedArchives,
  },
  {
    id: 'sequence',
    number: '04',
    title: 'Justify your sequence',
    prompt: 'Justify your sequencing decisions. Why did you place your items where you did?',
    richText: true,
  },
  {
    id: 'description',
    number: '05',
    title: 'Describe your archive',
    prompt: 'In at least 3 sentences, describe the idea behind your archive and how it relates to its title.',
    richText: true,
  },
];

let idCounter = 0;
const createId = () => {
  idCounter += 1;
  return `a-${Date.now().toString(36)}-${idCounter}`;
};

const emptyArtifact = () => ({
  id: createId(),
  image: '',
  metadata: '',
  caption: '',
});

const readArtifact = (entry) => ({
  id: typeof entry?.id === 'string' ? entry.id : createId(),
  image: typeof entry?.image === 'string' ? entry.image : '',
  metadata: typeof entry?.metadata === 'string' ? entry.metadata : '',
  caption: typeof entry?.caption === 'string' ? entry.caption : '',
});

const isBlankArtifact = (entry) => !entry.image && !entry.metadata.trim() && !entry.caption.trim();

const plainText = (html) => String(html || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

// A step stays hidden until the one before it is done: student names, a title,
// five collected images, then a written justification.
const isStepComplete = (step, answers) => {
  if (step.id === 'names') return Boolean(answers.names?.trim());
  if (step.id === 'title') return Boolean(answers.title);
  if (step.id === 'archive') {
    return answers.artifacts.filter((entry) => entry.image).length >= MIN_ARTIFACTS;
  }
  if (step.richText) return Boolean(plainText(answers[step.id]));
  return false;
};

const revealedCount = (answers) => {
  let count = 1;
  while (count < steps.length && isStepComplete(steps[count - 1], answers)) count += 1;
  return count;
};

const normalize = (saved) => {
  const source = saved && typeof saved === 'object' ? saved : {};
  const title = archiveTitles.includes(source.title) ? source.title : '';
  const stored = Array.isArray(source.artifacts)
    ? source.artifacts.filter((entry) => entry && typeof entry === 'object').map(readArtifact)
    : [];
  // Earlier drafts opened with five empty groups. A blank set from that draft
  // starts over at one; anything already filled is kept.
  const legacyBlankSet = source.version !== 2 && stored.every(isBlankArtifact);

  const asHTML = (value) => (typeof value === 'string' ? value : '');

  return {
    names: typeof source.names === 'string' ? source.names : '',
    title,
    artifacts: !stored.length || legacyBlankSet ? [emptyArtifact()] : stored,
    sequence: asHTML(source.sequence),
    description: asHTML(source.description),
  };
};

const loadLocal = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && typeof saved === 'object' ? saved : null;
  } catch {
    return null;
  }
};

const openDb = () => new Promise((resolve, reject) => {
  if (!window.indexedDB) {
    reject(new Error('IndexedDB is unavailable'));
    return;
  }
  const request = window.indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE)) {
      request.result.createObjectStore(STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const idbGet = async () => {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(STORAGE_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

const idbSet = async (value) => {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, STORAGE_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
};

// Images are kept in IndexedDB. localStorage only holds the text, so a full archive
// does not run into the browser's small storage limit.
const persist = async (answers) => {
  const record = { ...answers, version: 2 };
  const lite = {
    version: 2,
    names: answers.names,
    title: answers.title,
    sequence: answers.sequence,
    description: answers.description,
    artifacts: answers.artifacts.map(({ id, metadata, caption }) => ({ id, metadata, caption })),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lite));
  } catch {
    // Text still lives in IndexedDB when local storage is blocked.
  }
  try {
    await idbSet(record);
  } catch {
    // The text copy above is the fallback when IndexedDB is unavailable.
  }
};

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const compressImage = async (file) => {
  const original = await readAsDataURL(file);
  if (typeof createImageBitmap !== 'function') return original;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      return original;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const keepPng = file.type === 'image/png';
    return canvas.toDataURL(keepPng ? 'image/png' : 'image/jpeg', 0.82);
  } catch {
    return original;
  }
};

const imageFileFrom = (files, items) => {
  const fromFiles = [...(files || [])].find((file) => file.type.startsWith('image/'));
  if (fromFiles) return fromFiles;
  const item = [...(items || [])].find((entry) => entry.type?.startsWith('image/'));
  return item?.getAsFile?.() || null;
};

const isFileDrag = (event) => [...(event.dataTransfer?.types || [])].includes('Files');

const dropPlaceFor = (event) => {
  const rect = event.currentTarget.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
};

const fitTextarea = (element) => {
  if (!element) return;
  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
};

function ArtifactCard({
  entry,
  index,
  onChange,
  onRemove,
  canRemove,
  rowDragging,
  dropPlace,
  onRowDragStart,
  onRowDragEnd,
  onRowDragOver,
  onRowDrop,
}) {
  const metadataRef = useRef(null);
  const captionRef = useRef(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const number = String(index + 1).padStart(2, '0');

  useEffect(() => {
    fitTextarea(metadataRef.current);
    fitTextarea(captionRef.current);
  }, [entry.metadata, entry.caption]);

  const storeImage = async (file) => {
    if (!file) return;
    setPending(true);
    setError('');
    try {
      const image = await compressImage(file);
      if (!image) {
        setError('That image could not be read. Paste a JPG, PNG, or GIF.');
        return;
      }
      onChange(entry.id, { image });
    } catch {
      setError('That image could not be read. Paste a JPG, PNG, or GIF.');
    } finally {
      setPending(false);
    }
  };

  const takeImage = (files, items) => {
    const file = imageFileFrom(files, items);
    if (file) storeImage(file);
    return Boolean(file);
  };

  return (
    <li
      className={[
        'scavenge-artifact',
        entry.image ? '' : 'is-blank',
        rowDragging ? 'is-row-dragging' : '',
        dropPlace ? `is-drop-${dropPlace}` : '',
      ].filter(Boolean).join(' ')}
      onDragOver={(event) => {
        if (isFileDrag(event)) return;
        event.preventDefault();
        onRowDragOver(entry.id, dropPlaceFor(event));
      }}
      onDrop={(event) => {
        if (isFileDrag(event)) return;
        event.preventDefault();
        onRowDrop(entry.id, dropPlaceFor(event));
      }}
      onDragEnd={onRowDragEnd}
    >
      <button
        className="scavenge-grip"
        type="button"
        draggable
        aria-label={`Drag to reorder artifact ${number}`}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', entry.id);
          const row = event.currentTarget.closest('.scavenge-artifact');
          if (row) event.dataTransfer.setDragImage(row, 20, 20);
          onRowDragStart(entry.id);
        }}
      >
        <span className="scavenge-grip-mark" aria-hidden="true" />
      </button>
      <div className="scavenge-image-cell">
        <span className="scavenge-artifact-number">{number}</span>
        <div
          id={`artifact-image-${entry.id}`}
          className={`scavenge-image ${entry.image ? 'is-filled' : 'is-empty'} ${dragging ? 'is-dragging' : ''}`}
          tabIndex={0}
          role="group"
          aria-label={`Image for artifact ${number}. Paste an image.`}
          onPaste={(event) => {
            if (takeImage(event.clipboardData?.files, event.clipboardData?.items)) {
              event.preventDefault();
            }
          }}
          onDrop={(event) => {
            setDragging(false);
            if (takeImage(event.dataTransfer?.files, event.dataTransfer?.items)) {
              event.preventDefault();
            }
          }}
        onDragOver={(event) => {
          if (!isFileDrag(event)) return;
          event.preventDefault();
          setDragging(true);
        }}
          onDragLeave={() => setDragging(false)}
          onKeyDown={(event) => {
            if ((event.key === 'Backspace' || event.key === 'Delete') && entry.image) {
              event.preventDefault();
              onChange(entry.id, { image: '' });
            }
          }}
        >
          {entry.image ? (
            <img src={entry.image} alt={entry.caption.trim() || `Artifact ${number}`} draggable={false} />
          ) : (
            <p>{pending ? 'Reading image…' : 'Paste an image'}</p>
          )}
        </div>
        {entry.image && (
          <button
            className="scavenge-image-clear"
            type="button"
            onClick={() => onChange(entry.id, { image: '' })}
          >
            Remove image
          </button>
        )}
        {error && <p className="scavenge-image-error">{error}</p>}
      </div>

      <label className="scavenge-field">
        <span>Metadata</span>
        <textarea
          ref={metadataRef}
          value={entry.metadata}
          onChange={(event) => {
            fitTextarea(event.currentTarget);
            onChange(entry.id, { metadata: event.target.value });
          }}
          placeholder="Paste metadata"
          aria-label={`Metadata for artifact ${number}`}
        />
      </label>

      <label className="scavenge-field">
        <span>Caption</span>
        <textarea
          ref={captionRef}
          value={entry.caption}
          onChange={(event) => {
            fitTextarea(event.currentTarget);
            onChange(entry.id, { caption: event.target.value });
          }}
          placeholder="Paste caption"
          aria-label={`Caption for artifact ${number}`}
        />
      </label>

      {canRemove && (
        <button
          className="scavenge-remove"
          type="button"
          onClick={onRemove}
          aria-label={`Remove artifact ${number}`}
        >
          ×
        </button>
      )}
    </li>
  );
}

function ArtifactRepeater({ entries, onChange }) {
  const [focusId, setFocusId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragIdRef = useRef(null);
  const collected = entries.filter((entry) => entry.image).length;

  const clearDrag = () => {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  };

  const startDrag = (id) => {
    dragIdRef.current = id;
    setDragId(id);
  };

  const hoverRow = (id, place) => {
    if (!dragIdRef.current || dragIdRef.current === id) return;
    setDropTarget((current) => (
      current?.id === id && current.place === place ? current : { id, place }
    ));
  };

  const dropRow = (id, place) => {
    const fromId = dragIdRef.current;
    clearDrag();
    if (!fromId || fromId === id) return;
    onChange((current) => {
      const from = current.findIndex((entry) => entry.id === fromId);
      let to = current.findIndex((entry) => entry.id === id);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (from < to) to -= 1;
      next.splice(place === 'after' ? to + 1 : to, 0, item);
      return next;
    });
  };

  useEffect(() => {
    if (!focusId) return;
    document.getElementById(`artifact-image-${focusId}`)?.focus();
    setFocusId(null);
  }, [focusId]);

  const update = (id, patch) => {
    onChange((current) => current.map((entry) => (
      entry.id === id ? { ...entry, ...patch } : entry
    )));
  };

  const addArtifact = () => {
    const entry = emptyArtifact();
    onChange((current) => [...current, entry]);
    setFocusId(entry.id);
  };

  const removeArtifact = (id) => {
    onChange((current) => {
      const next = current.filter((entry) => entry.id !== id);
      return next.length ? next : [emptyArtifact()];
    });
  };

  return (
    <div className="scavenge-repeater">
      <div className="scavenge-table-head" aria-hidden="true">
        <span />
        <span>Image</span>
        <span>Metadata</span>
        <span>Caption</span>
      </div>
      <ol>
        {entries.map((entry, index) => (
          <ArtifactCard
            key={entry.id}
            entry={entry}
            index={index}
            onChange={update}
            onRemove={() => removeArtifact(entry.id)}
            canRemove={entries.length > 1}
            rowDragging={dragId === entry.id}
            dropPlace={dropTarget?.id === entry.id ? dropTarget.place : null}
            onRowDragStart={startDrag}
            onRowDragEnd={clearDrag}
            onRowDragOver={hoverRow}
            onRowDrop={dropRow}
          />
        ))}
      </ol>
      <div className="scavenge-repeater-actions">
        <button className="scavenge-add" type="button" onClick={addArtifact}>
          + Add artifact
        </button>
        <p className="scavenge-count" aria-live="polite">
          {String(collected).padStart(2, '0')} / {String(MIN_ARTIFACTS).padStart(2, '0')}
        </p>
      </div>
    </div>
  );
}

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

function FormatEditor({ value, label, onChange }) {
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
    <div className="scavenge-editor">
      <div
        className="scavenge-editor-toolbar"
        role="toolbar"
        aria-label={`${label} formatting`}
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
        className="scavenge-editor-surface"
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label={label}
        data-placeholder="Write here…"
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

function NameList({ value, placeholder, labelledBy, onChange }) {
  const fieldRef = useRef(null);

  useEffect(() => {
    fitTextarea(fieldRef.current);
  }, [value]);

  return (
    <textarea
      ref={fieldRef}
      className="scavenge-names"
      value={value}
      placeholder={placeholder}
      aria-labelledby={labelledBy}
      rows={3}
      onChange={(event) => {
        fitTextarea(event.currentTarget);
        onChange(event.target.value);
      }}
    />
  );
}

function PrintDocument({ answers }) {
  const description = plainText(answers.description) ? sanitizeFormat(answers.description) : '';
  const sequence = plainText(answers.sequence) ? sanitizeFormat(answers.sequence) : '';
  const artifacts = answers.artifacts.filter((entry) => (
    entry.image || entry.metadata.trim() || entry.caption.trim()
  ));
  const names = answers.names
    .split(/\r?\n/)
    .map((name) => name.trim())
    .filter(Boolean)
    .join(', ');

  return (
    <article className="scavenge-print">
      {names && <p className="scavenge-print-names">{names}</p>}
      {answers.title && <h1>{answers.title}</h1>}
      {description && (
        <div className="scavenge-print-copy" dangerouslySetInnerHTML={{ __html: description }} />
      )}
      {artifacts.length > 0 && (
        <ol>
          {artifacts.map((entry) => (
            <li key={entry.id}>
              {entry.image && <img src={entry.image} alt="" />}
              <div>
                {entry.metadata.trim() && <p className="scavenge-print-metadata">{entry.metadata}</p>}
                {entry.caption.trim() && <p className="scavenge-print-caption">{entry.caption}</p>}
              </div>
            </li>
          ))}
        </ol>
      )}
      {sequence && (
        <div className="scavenge-print-copy" dangerouslySetInnerHTML={{ __html: sequence }} />
      )}
    </article>
  );
}

function ArtifactScavenger() {
  const [answers, setAnswers] = useState(() => normalize(loadLocal()));
  const [hydrated, setHydrated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = useRef(false);
  const confirmRef = useRef(null);

  useEffect(() => {
    document.title = 'Practice 05: Artifact Scavenger Hunt';
  }, []);

  useEffect(() => {
    document.body.classList.add('practice-05');
    const printRules = document.createElement('style');
    printRules.textContent = '@page { margin: 1.4cm; } @media print { html { height: auto; overflow: visible; } }';
    document.head.appendChild(printRules);
    const blockFileNavigation = (event) => {
      if ([...(event.dataTransfer?.types || [])].includes('Files')) event.preventDefault();
    };
    window.addEventListener('dragover', blockFileNavigation);
    window.addEventListener('drop', blockFileNavigation);
    return () => {
      document.body.classList.remove('practice-05');
      printRules.remove();
      window.removeEventListener('dragover', blockFileNavigation);
      window.removeEventListener('drop', blockFileNavigation);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stored = null;
    idbGet()
      .then((saved) => {
        stored = saved;
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        if (stored && !dirty.current) setAnswers(normalize(stored));
        setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    const timer = window.setTimeout(() => persist(answers), 250);
    return () => window.clearTimeout(timer);
  }, [answers, hydrated]);

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

  const changeAnswers = (updater) => {
    dirty.current = true;
    setAnswers(updater);
  };

  const resetWork = () => {
    dirty.current = true;
    setAnswers({
      names: '',
      title: '',
      artifacts: [emptyArtifact()],
      sequence: '',
      description: '',
    });
    setConfirmReset(false);
    window.scrollTo(0, 0);
  };

  const collected = answers.artifacts.filter((entry) => entry.image).length;
  const revealed = revealedCount(answers);

  return (
    <main className="scavenge-shell">
      <header className="scavenge-topbar">
        <div className="topbar-left">
          <Link to="/" className="scavenge-home-link">Practices</Link>
          <h1>Artifact Scavenger Hunt</h1>
        </div>
        <div className="scavenge-actions">
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
          className="scavenge-confirm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-confirm-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setConfirmReset(false);
          }}
        >
          <div className="scavenge-confirm-panel" ref={confirmRef}>
            <p id="reset-confirm-title">Are you sure? This will delete all your progress thus far.</p>
            <div className="scavenge-confirm-actions">
              <button type="button" onClick={() => setConfirmReset(false)}>Cancel</button>
              <button type="button" onClick={resetWork}>Reset</button>
            </div>
          </div>
        </div>
      )}

      <PrintDocument answers={answers} />

      {steps.slice(0, revealed).map((step, index) => (
        <section
          className="scavenge-step"
          key={step.id}
          aria-label={`Step ${step.number}: ${step.title}`}
        >
          <div className="scavenge-step-head">
            <p className="scavenge-step-label">
              <span className="scavenge-step-number">{step.number}</span>
              {step.title}
            </p>
            {step.id === 'archive' && hydrated && (
              <p className="scavenge-count">
                {String(collected).padStart(2, '0')} / {String(MIN_ARTIFACTS).padStart(2, '0')}
              </p>
            )}
          </div>
          <div className={`scavenge-step-body ${step.id === 'archive' ? 'is-wide' : ''}`}>
            <div className="scavenge-step-copy">
              <p className="scavenge-step-prompt" id={`${step.id}-prompt`}>{step.prompt}</p>
              {step.archives?.length > 0 && (
                <ul className="scavenge-archives">
                  {step.archives.map((archive) => (
                    <li key={archive.href}>
                      <a href={archive.href} target="_blank" rel="noreferrer">{archive.label}</a>
                    </li>
                  ))}
                </ul>
              )}
              {step.help && <p className="scavenge-help">{step.help}</p>}
            </div>
            {step.text && (
              <NameList
                value={answers.names}
                placeholder={step.placeholder}
                labelledBy={`${step.id}-prompt`}
                onChange={(names) => changeAnswers((current) => ({
                  ...current,
                  names,
                }))}
              />
            )}
            {step.options && (
              <select
                className={answers.title ? '' : 'is-empty'}
                value={answers.title || ''}
                aria-labelledby={`${step.id}-prompt`}
                onChange={(event) => changeAnswers((current) => ({
                  ...current,
                  title: event.target.value,
                }))}
              >
                <option value="" disabled>{step.placeholder}</option>
                {step.options.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            )}
            {step.id === 'archive' && hydrated && (
              <ArtifactRepeater
                entries={answers.artifacts}
                onChange={(recipe) => changeAnswers((current) => ({
                  ...current,
                  artifacts: recipe(current.artifacts),
                }))}
              />
            )}
            {step.richText && (
              <FormatEditor
                value={answers[step.id] || ''}
                label={step.title}
                onChange={(value) => changeAnswers((current) => ({
                  ...current,
                  [step.id]: value,
                }))}
              />
            )}
            {index === revealed - 1 && index < steps.length - 1 && !isStepComplete(step, answers) && (
              <p className="scavenge-step-note">Complete this step to continue.</p>
            )}
          </div>
          {step.id === 'description' && (
            <button className="export-pdf" type="button" onClick={() => window.print()}>
              Export PDF
            </button>
          )}
        </section>
      ))}
    </main>
  );
}

export default ArtifactScavenger;
