# Admin user management and handoff

## Access model

Supabase authenticates accounts; FAIR's `admin_members` table authorizes them.
An active **admin** can use existing admin features. An active **owner** can also
invite staff, change roles, and enable/disable memberships at `/admin/users`.
Backend checks apply even if a caller bypasses the UI. Disabling membership
denies subsequent protected requests without deleting the Supabase account or
historical import attribution. There is no public self-enrollment.

## One-time deployment setup

1. Back up the database. Before starting the new backend, run from `server/`:
   `npx prisma migrate deploy` and `npx prisma generate`. Deploy both frontend
   and backend. Access verification fails closed if the migration is missing.
2. Configure backend `SUPABASE_URL` and either `SUPABASE_SERVICE_ROLE_KEY` or
   `SUPABASE_SECRET_KEY` from the same project used by the frontend public URL
   and anon key. Never expose server keys to the browser.
3. Set backend `CLIENT_ORIGIN` to the exact frontend origin and
   `FAIR_ADMIN_EMAIL` to the existing, verified first owner's Supabase email.
4. Sign in as that user. A locked transaction creates its owner membership,
   records attribution, and marks bootstrap complete. Verify Users loads.
5. You can remove `FAIR_ADMIN_EMAIL` afterward. It cannot create another owner
   after initialization or restore disabled membership. Keep two trusted owners.
6. Configure custom SMTP in Supabase Authentication. Default email delivery has
   recipient/rate restrictions and is not suitable for production staff invites.
7. Configure Supabase Site URL and Redirect URLs. Allow the exact frontend's
   `/admin/account` callback including the invitation query parameter, e.g. a
   pattern scoped to that hostname and `/admin/account**`. Do not allow wildcard
   production hostnames.
8. Default Supabase invitation/recovery emails return session tokens in the URL
   fragment. Custom `token_hash` templates are also supported if they preserve
   `invitation` and supply `type=invite` or `type=recovery`. This callback does not
   exchange PKCE authorization codes.
9. Test an actual invite and password reset with a test mailbox after deployment.
   Verify production DB privileges/RLS, email delivery, and callback redirects.

Provider references:
- [Invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Email templates](https://supabase.com/docs/guides/auth/auth-email-templates)

## Client workflow

Owners use **Users → Invite a user**, enter an email, and choose Admin or Owner.
Recipients open their email and set a password of at least 12 characters.
Existing Supabase accounts receive a recovery email instead of a duplicate
account. Staff passwords are never chosen or viewed by an owner.

Invitations last 48 hours in FAIR; Supabase email links may expire sooner.
Resend rotates the acceptance token, invalidating older links. Owners may revoke
pending/expired invitations. Acceptance requires the matching verified Supabase
email and an inviter who is still an active owner. Existing disabled memberships
cannot be reactivated through invitations; an owner must enable them directly.

`delivery_failed` is visible in Users. Fix SMTP/redirect configuration and resend.
A `sending` record older than one minute can be resent after an interrupted
worker. Invitation attempts are durably limited to ten per owner per hour.

Email and database writes are not atomic. An email may arrive before a failed
status write; a `sending` record cannot activate access. Refresh Users before
retrying, inspect its state, and resend. Email delivery alone never grants access.

Access changes, invitations, and acceptance are audited. Users shows the latest
100 invitations/events; older records remain stored. Mutations share a PostgreSQL
transaction advisory lock, protecting the last active owner even from concurrent
demotions. Direct privileged SQL is outside that protection.

## Recovery and operations

Forgot password on the login page sends a non-enumerating recovery request.
Keep multiple owners. If all owners lose access, an authorized database operator
must verify identity and restore an existing trusted membership. Never delete
`admin_access_state` to reopen bootstrap.

Document ownership of Supabase, Railway, SMTP, and the database during handoff.
Access tables have RLS without browser policies; public, anon, and authenticated
privileges are revoked. The backend needs a privileged DB role able to manage
these tables. No live migration or email delivery is implied by local unit tests.