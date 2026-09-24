import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the practices index with a link to each practice', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'Practices' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /research process timeline/i })).toHaveAttribute('href', '/01');
  expect(screen.getByRole('link', { name: /mettle testing/i })).toHaveAttribute('href', '/02');
  expect(screen.getByRole('link', { name: /artifact annotation/i })).toHaveAttribute('href', '/03');
});
