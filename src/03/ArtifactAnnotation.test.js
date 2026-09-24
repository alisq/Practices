import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ArtifactAnnotation from './ArtifactAnnotation';
import content from './content.json';

const renderPractice = () => render(
  <MemoryRouter>
    <ArtifactAnnotation />
  </MemoryRouter>,
);

const labelFor = (index) => (
  content[index].description || `Artifact ${String(index + 1).padStart(2, '0')}`
);

const tile = (index) => screen.getByRole('button', {
  name: new RegExp(`^${String(index + 1).padStart(2, '0')}\\s+${labelFor(index)}$`, 'i'),
});

const setEditorHTML = (editor, html) => {
  editor.innerHTML = html;
  fireEvent.input(editor);
};

beforeEach(() => {
  localStorage.clear();
  document.body.className = '';
});

test('lists every artifact from content.json, then opens looking closely alone', () => {
  renderPractice();

  expect(screen.getByRole('heading', { name: /select an artifact/i })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(content.length);

  fireEvent.click(tile(2));

  expect(screen.queryByRole('heading', { name: /select an artifact/i })).not.toBeInTheDocument();
  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.getByRole('img', { name: labelFor(2) })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /open artifact 03 image in a new tab/i })).toHaveAttribute(
    'href',
    `/images/03/${encodeURIComponent(content[2].filename)}`,
  );
  expect(screen.getByRole('link', { name: /open artifact 03 image in a new tab/i })).toHaveAttribute(
    'target',
    '_blank',
  );
  expect(screen.getByText(/formal analysis: look closely/i)).toBeInTheDocument();
  expect(screen.getByText(/look patiently and closely first/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /next: formal analysis: describe what you see/i })).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual analysis' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual Analysis: Identify basic facts' })).not.toBeInTheDocument();
});

test('next and previous buttons show one part at a time', () => {
  renderPractice();
  fireEvent.click(tile(0));

  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: describe what you see/i }));
  expect(screen.getByRole('textbox', { name: 'Formal Analysis: Describe what you see' })).toBeInTheDocument();
  expect(screen.getByText(/describe the elements, principles, and actions/i)).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Formal Analysis: Look closely' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: examine relationships/i }));
  expect(screen.getByRole('textbox', { name: 'Formal Analysis: Examine relationships' })).toBeInTheDocument();
  expect(screen.getByText(/relationships between elements/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: articulate formal choices/i }));
  expect(screen.getByRole('textbox', { name: 'Formal Analysis: Articulate formal choices' })).toBeInTheDocument();
  expect(screen.getByText(/what each formal choice does/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: contextual analysis/i }));
  expect(screen.getByRole('textbox', { name: 'Contextual analysis' })).toBeInTheDocument();
  expect(screen.getByText(/clues you can glean from the artifact/i)).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Formal Analysis: Articulate formal choices' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: contextual analysis: identify basic facts/i }));
  expect(screen.getByRole('textbox', { name: 'Contextual Analysis: Identify basic facts' })).toBeInTheDocument();
  expect(screen.getByText(/basic facts about the object/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: contextual analysis: historical\/political context/i }));
  expect(screen.getByRole('textbox', { name: 'Contextual Analysis: Historical/political context' })).toBeInTheDocument();
  expect(screen.getByText(/historical\/political context informing this piece/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /next: contextual analysis: trends and conventions/i }));
  expect(screen.getByRole('textbox', { name: 'Contextual Analysis: Trends and conventions' })).toBeInTheDocument();
  expect(screen.getByText(/key trends\/conventions/i)).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual analysis' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^next:/i })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /previous: contextual analysis: historical\/political context/i }));
  expect(screen.getByRole('textbox', { name: 'Contextual Analysis: Historical/political context' })).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual Analysis: Trends and conventions' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /previous: contextual analysis: identify basic facts/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: contextual analysis$/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: articulate formal choices/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: examine relationships/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: describe what you see/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: look closely/i }));
  expect(screen.getByText(/look patiently and closely first/i)).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^previous:/i })).not.toBeInTheDocument();
});

test('points each image at public/images/03', () => {
  const { container } = renderPractice();

  const sources = [...container.querySelectorAll('.annot-tile img')].map((img) => img.getAttribute('src'));
  const expected = content.map((entry) => `/images/03/${encodeURIComponent(entry.filename)}`);
  expect(sources).toHaveLength(expected.length);
  expect(sources).toEqual(expect.arrayContaining(expected));
});

test('keeps answers and the active part when the page is remounted', () => {
  const first = renderPractice();

  fireEvent.click(tile(4));
  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: describe what you see/i }));
  setEditorHTML(
    screen.getByRole('textbox', { name: 'Formal Analysis: Describe what you see' }),
    '<p><strong>Heavy</strong> serifs.</p>',
  );
  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: examine relationships/i }));
  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: articulate formal choices/i }));
  fireEvent.click(screen.getByRole('button', { name: /next: contextual analysis/i }));
  setEditorHTML(
    screen.getByRole('textbox', { name: 'Contextual analysis' }),
    '<p>Late nineteenth century.</p>',
  );
  first.unmount();

  renderPractice();
  expect(screen.getByRole('img', { name: labelFor(4) })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Contextual analysis' })).toHaveTextContent(
    'Late nineteenth century.',
  );
  expect(screen.queryByRole('textbox', { name: 'Formal Analysis: Describe what you see' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual Analysis: Identify basic facts' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: articulate formal choices/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: examine relationships/i }));
  fireEvent.click(screen.getByRole('button', { name: /previous: formal analysis: describe what you see/i }));
  expect(screen.getByRole('textbox', { name: 'Formal Analysis: Describe what you see' })).toHaveTextContent('Heavy serifs.');
  expect(screen.getByRole('textbox', { name: 'Formal Analysis: Describe what you see' }).querySelector('strong')).toHaveTextContent(
    'Heavy',
  );
});

test('change artifact fully resets answers and progress', () => {
  renderPractice();

  fireEvent.click(tile(1));
  fireEvent.click(screen.getByRole('button', { name: /next: formal analysis: describe what you see/i }));
  setEditorHTML(
    screen.getByRole('textbox', { name: 'Formal Analysis: Describe what you see' }),
    '<p>A formal observation.</p>',
  );
  fireEvent.click(screen.getByRole('button', { name: /change artifact/i }));

  expect(screen.getByRole('heading', { name: /select an artifact/i })).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(content.length);

  fireEvent.click(tile(0));
  expect(screen.getByText(/look patiently and closely first/i)).toBeInTheDocument();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual analysis' })).not.toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'Contextual Analysis: Identify basic facts' })).not.toBeInTheDocument();
});
