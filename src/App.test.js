import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

test('renders the AirStory landing page', async () => {
  render(<App />);
  expect(await screen.findByLabelText(/air story/i)).toBeInTheDocument();
});
