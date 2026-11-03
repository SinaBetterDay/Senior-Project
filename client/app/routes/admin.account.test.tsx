import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';
import AccountPage from './admin.account';

const mocks = vi.hoisted(() => ({ receive: vi.fn(), finish: vi.fn() }));
vi.mock('../adminAuth', () => ({ receiveAccountLink: mocks.receive, finishAccountSetup: mocks.finish }));
beforeEach(() => { vi.resetAllMocks(); mocks.receive.mockResolvedValue('invitation-token'); mocks.finish.mockResolvedValue(undefined); });
it('requires matching passwords before finishing an invitation', async () => {
  render(<MemoryRouter><AccountPage /></MemoryRouter>);
  fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'a-long-password' } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'different-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
  expect(mocks.finish).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'a-long-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save password and continue' }));
  await waitFor(() => expect(mocks.finish).toHaveBeenCalledWith('a-long-password', 'invitation-token'));
});
it('displays expired-link errors without exposing a password form', async () => {
  mocks.receive.mockRejectedValue(new Error('This account link is expired.'));
  render(<MemoryRouter><AccountPage /></MemoryRouter>);
  expect(await screen.findByRole('alert')).toHaveTextContent('expired');
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
});