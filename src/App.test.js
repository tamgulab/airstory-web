import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// App renders only a loading spinner until Firebase's auth callback fires, so the
// real listener would never resolve here (test env has no Firebase config). Fire it
// synchronously with no user to land on the signed-out landing page.
jest.mock('./firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth, callback) => {
    callback(null);
    return () => {};
  },
}));

test('renders the AirStory landing page', () => {
  render(<App />);
  expect(screen.getByLabelText(/air story/i)).toBeInTheDocument();
});
