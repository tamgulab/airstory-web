import { render, screen } from '@testing-library/react';
import App from './App';

test('renders the AirStory landing page', () => {
  render(<App />);
  expect(screen.getByLabelText(/air story/i)).toBeInTheDocument();
});
