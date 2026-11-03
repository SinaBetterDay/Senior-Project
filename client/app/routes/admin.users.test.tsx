import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import UsersPage from './admin.users';
import { MemoryRouter, Routes, Route } from 'react-router';

const mocks = vi.hoisted(() => ({ verify: vi.fn(), fetch: vi.fn() }));
vi.mock('../adminComponents', () => ({ AdminGuard: ({ children }: { children: React.ReactNode }) => children, AdminNav: () => <nav>Admin</nav> }));
vi.mock('../adminAuth', () => ({ verifyAdminAccess: mocks.verify, adminFetch: mocks.fetch }));
const access = { members: [{ userId: 'owner', email: 'owner@example.gov', role: 'owner', active: true }], invitations: [{ id: 'invitation', email: 'pending@example.gov', role: 'admin', status: 'delivery_failed', expiresAt: '2026-01-01', lastError: 'Check SMTP' }], audit: [] };
beforeEach(() => { vi.resetAllMocks(); mocks.verify.mockResolvedValue({ role: 'owner' }); mocks.fetch.mockImplementation(async () => Response.json({ data: access })); });
it('lets an owner invite staff and see email delivery errors', async () => {
  render(<UsersPage />);
  expect(await screen.findByText('Check SMTP')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.gov' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send invitation' }));
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith('/api/admin/users/invitations', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'new@example.gov', role: 'admin' }) })));
  expect(await screen.findByText('Changes saved.')).toBeVisible();
});
it('does not load user lists or expose invitation controls to ordinary admins', async () => {
  mocks.verify.mockResolvedValue({ role: 'admin' }); render(<MemoryRouter initialEntries={['/admin/users']}><Routes><Route path="/admin/users" element={<UsersPage />} /><Route path="/admin/login" element={<h1>Admin sign in</h1>} /></Routes></MemoryRouter>);
  expect(await screen.findByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Send invitation' })).not.toBeInTheDocument();
});
it('shows server failures and keeps the invitation available to retry', async () => {
  mocks.fetch.mockResolvedValueOnce(Response.json({ data: access })).mockResolvedValueOnce(Response.json({ error: 'Email delivery failed' }, { status: 502 })).mockResolvedValue(Response.json({ data: access }));
  render(<UsersPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Resend to pending@example.gov' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Email delivery failed');
});