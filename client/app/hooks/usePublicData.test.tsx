import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePublicData } from './usePublicData';
import { createMemoryRouter, RouterProvider, useRouteError } from 'react-router';
import { ErrorBoundary } from '../root';

afterEach(() => vi.restoreAllMocks());
it('identifies the endpoint when an API response lacks the data contract', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'old deployment' }));
  const { result } = renderHook(() => usePublicData('https://api.example.gov/api/conflicts/filters'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toContain('/api/conflicts/filters');
});

it.each([404, 200])('renders the 404 screen for missing records (HTTP %s)', async status => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ data: null }, { status }));
  function Page() { usePublicData('https://api.example.gov/api/conflicts/id'); return <p>Loading</p>; }
  function Boundary() { return <ErrorBoundary error={useRouteError()} params={{}} />; }
  const router = createMemoryRouter([{ path: '/', Component: Page, ErrorBoundary: Boundary }]);
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeVisible();
});
it('keeps server outages retryable rather than showing a 404', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({}, { status: 503 }));
  const { result } = renderHook(() => usePublicData('https://api.example.gov/api/conflicts/id'));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toContain('503');
});