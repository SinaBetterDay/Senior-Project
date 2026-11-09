import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import NotFound from './NotFound';

it('explains missing content and offers a home link', () => {
  render(<NotFound />);
  expect(screen.getByText('FAIR · 404')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  expect(screen.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
});