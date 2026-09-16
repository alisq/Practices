import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './Home';
import ResearchMap from './01/ResearchMap';
import MettleTest from './02/MettleTest';

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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
