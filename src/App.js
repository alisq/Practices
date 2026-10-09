import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './Home';
import ResearchMap from './01/ResearchMap';
import MettleTest from './02/MettleTest';
import ArtifactAnnotation from './03/ArtifactAnnotation';
import TextAnalysis from './04/TextAnalysis';

const CONTRAST_KEY = 'practices-contrast';

function readContrast() {
  try {
    return window.localStorage.getItem(CONTRAST_KEY) === 'white';
  } catch {
    return false;
  }
}

function applyContrast(white) {
  document.documentElement.classList.toggle('contrast', white);
}

function ContrastToggle() {
  const [white, setWhite] = useState(() => {
    const stored = readContrast();
    applyContrast(stored);
    return stored;
  });

  useEffect(() => {
    applyContrast(white);
    try {
      window.localStorage.setItem(CONTRAST_KEY, white ? 'white' : 'yellow');
    } catch {
      // Preference still applies for this visit when storage is blocked.
    }
  }, [white]);

  return (
    <button
      type="button"
      className="contrast-toggle"
      aria-pressed={white}
      aria-label="Contrast"
      onClick={() => setWhite((value) => !value)}
    >
      <svg viewBox="0 0 512 512" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M448 256c0-106-86-192-192-192l0 384c106 0 192-86 192-192zM0 256a256 256 0 1 1 512 0A256 256 0 1 1 0 256z"
        />
      </svg>
    </button>
  );
}

function App() {
  const basename = process.env.NODE_ENV === 'production' ? process.env.PUBLIC_URL : undefined;

  return (
    <BrowserRouter
      basename={basename}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/01" element={<ResearchMap />} />
        <Route path="/02" element={<MettleTest />} />
        <Route path="/03" element={<ArtifactAnnotation />} />
        <Route path="/04" element={<TextAnalysis />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ContrastToggle />
    </BrowserRouter>
  );
}

export default App;
