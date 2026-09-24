import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';

const practices = [
  {
    path: '/01',
    number: '01',
    title: 'Research Process Timeline',
    description: 'Place research prompts on a theory–practice map.',
  },
  {
    path: '/02',
    number: '02',
    title: 'Research Question Mettle Testing',
    description: 'Work through seven timed sections, one gate at a time.',
  },
  {
    path: '/03',
    number: '03',
    title: 'Artifact Annotation',
    description: 'Choose an artifact, then look closely and work through form and context.',
  },
];

function Home() {
  useEffect(() => {
    document.title = 'Practices';
  }, []);

  return (
    <main className="home-shell">
      <header className="home-header">
        <p className="home-kicker">Studio practices</p>
        <h1>Practices</h1>
      </header>
      <ul className="practice-list">
        {practices.map((practice) => (
          <li key={practice.path}>
            <Link to={practice.path}>
              <span className="practice-number">{practice.number}</span>
              <span className="practice-copy">
                <strong>{practice.title}</strong>
                <em>{practice.description}</em>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default Home;
