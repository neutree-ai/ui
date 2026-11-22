# Auth contract

Backend: `RegisterAuthRoutes` (`internal/routes/auth/auth.go`), GoTrue proxy `/api/v1/auth`;
`LDAPTokenRequest` (`ldap.go`), OIDC handlers (`oidc.go`), GoTrue users/sessions and `api.user_profiles`.
No Auth resource envelope, CRUD table or client RPC. Backend: `origin/main@062192f6`.
Login/recovery routes are public; GoTrue validates bearer tokens for user updates, identity and logout.
Source configuration: `src/domains/identity-source/contract.md`. Profile schema, permissions and writes:
`src/domains/user/contract.md`. Backend paths below are under `internal/routes/auth/` unless prefixed.

## Type

UI: `src/foundation/providers/auth-provider/index.ts:authProvider`, `LdapLoginParams` and auth-js `User`/`Session`.
Defaults below describe the UI. Passwords are write-only inputs, not masked resource fields.

Inputs are user-owned, blank and untrimmed. Tokens and identity are server-owned, read-only.
Password fields and tokens are secret; profile/source metadata are not. No resource field uses masking tags.

| field | type | required/default | editable here | backend rule |
|---|---|---|---|---|
| local `email`, `password` | strings | required | login only | `resolveEmailByUsername`; password grant |
| LDAP `source`, `username`, `password` | strings | selected source; required credentials | login only | `LDAPTokenRequest` |
| source `name`, `display_name`, `type` | strings | public response | no | `handleListLoginIdentitySources` |
| `access_token`, `refresh_token` | strings | session response | SDK replacement | GoTrue issuance |
| `expires_in`, `expires_at`, `token_type` | seconds, Unix seconds, string | session response | no | auth-js `Session` |
| user `id`, `role`, `email`, `user_metadata` | UUID, strings, map | GoTrue response | no inputs | `handleAuthProxy` |
| `app_metadata.identity_source` | string | absent for local | no | `auth.IdentitySource` |
| recovery `email` | string | required | reset input | GoTrue recovery |
| new `password`, `confirmPassword` | strings | required | local only | confirmation absent from API |

`resolveEmailByUsername` substitutes email for exact local profile names; unknown names, lookup failures and
source-labelled profiles retain the identifier. `LoginSources.resolve` allows omitted source only with one enabled
source of that type; the UI always names it. `LdapLoginParams.method` is the UI-only ldap discriminator.

## Roles

- Identity: `authUserDisplayName`, `authUserEmail`, `isExternalUser` (`foundation/role/user-identity.ts`);
  tests beside helpers. `getIdentity` adds name, displayEmail and external to the GoTrue user.
- `fetchOwnProfile` reads metadata by UUID. Name prefers profile display name/technical name, then GoTrue
  name, username, preferred_username and display email. Failed reads use the GoTrue fallbacks.
- Local email is GoTrue email; external email is trimmed `user_metadata.email`, never the placeholder.
  Password inputs are masked; no status or `STATUS_TONE` role applies.

## Scenes

- Login (`src/pages/auth/LoginPage.tsx:LoginPage`): local credentials, LDAP choices, OIDC actions; no registration.
  `useLoginIdentitySources` has no retry/notification and 60-second stale time; failure keeps local login available.
- `normalizeLoginIdentitySources` keeps named LDAP/OIDC entries and defaults blank display names to names.
  Local `mutationVariables` override inputs; LDAP ignores them. `AuthPage` hides Remember me.
- OIDC (`startOidcLogin`): browser navigation through `buildOidcAuthorizeUrl`, return to origin plus pathname.
  Public `SsoCallbackPage` redeems once per token/page load, invalidates auth state and replaces the route.
- Recovery (`ForgotPasswordPage`): signed-out email form; mutationVariables can override email.
  Provider success has no redirect. No source-specific recovery.
- Change (`UpdatePasswordPage`): authenticated `/update-password`, new password/confirmation, no old password.
  External identity shows managed-password help. Success navigates to `/`.
- Logout (`foundation/components/LogoutButton.tsx`): logout plus all-resource cache invalidation;
  provider success redirects to `/login`, failure returns the SDK error.
- Profile: `UserDropdown` shows name/email and local password change; no self-profile page/edit action.
  `/user-profiles/show/:id` mounts `UsersShow`; details belong to `src/domains/user/contract.md`.
- No Auth list, resource Create/Edit/Delete, batch actions or YAML scenes.

## Requests and payloads

Paths use `/api/v1`. Installed auth-js 2.69.1 adds the security/PKCE fields shown below.

| operation | method and path | body or query | backend symbol |
|---|---|---|---|
| local login | POST `/auth/token?grant_type=password` | `{email,password,gotrue_meta_security:{}}` | `handleTokenProxy` |
| LDAP login | POST `/auth/ldap/token` | `{source,username,password}` | `handleLDAPToken` |
| OIDC start | GET `/auth/oidc/authorize` | query `source`, `redirect_to` | `handleOIDCAuthorize` |
| OIDC provider return | GET `/auth/oidc/callback` | provider code/state or error | `handleOIDCCallback` |
| SSO redemption | POST `/auth/verify` | `{token_hash,type:"magiclink",gotrue_meta_security:{}}` | `handleVerifyProxy` |
| refresh | POST `/auth/token?grant_type=refresh_token` | `{refresh_token}` | `handleTokenProxy` |
| current identity | GET `/auth/user` | bearer; no body | `handleAuthProxy` |
| profile metadata | GET `/user_profiles` | `select=metadata`, `id=eq.<user UUID>` | `RegisterUserProfileRoutes` |
| recovery | POST `/auth/recover` | email, null code_challenge/method, empty gotrue_meta_security | `handleAuthProxy` |
| password change | PUT `/auth/user` | password, null code_challenge/method | `handleUpdateUser` |
| logout | POST `/auth/logout?scope=global` | bearer; no body | `handleAuthProxy` |

Recovery query is `redirect_to` set to window origin plus `/update-password`.
Its body is `{email,code_challenge:null,code_challenge_method:null,gotrue_meta_security:{}}`.
Password change sends exactly `{password,code_challenge:null,code_challenge_method:null}`; confirmation is discarded.
GET/PUT user and logout use the session access token. Login, recovery and token redemption need no existing bearer.
SDK evidence: `GoTrueClient` methods named above, `_updateUser`, `_refreshAccessToken`,
`GoTrueAdminApi.signOut` and `lib/fetch.ts:_request` in `@supabase/auth-js`.

`handleLDAPToken` checks `loginUser` for a ban; `issueSession` verifies a server-generated magic link.
OIDC `finishLogin` returns the hash only; `handleVerifyProxy` accepts magiclink types only.
Source linkage/profile synchronization: `src/domains/user/contract.md`.

## Session and secrets

`auth` enables auto-refresh; SDK defaults persistSession and detectSessionInUrl are true, flowType is implicit.
`GoTrueClient` uses browser localStorage key `supabase.auth.token` for the serialized session, including both tokens
and user. Unavailable localStorage falls back to SDK memory storage. Remember me does not alter persistence.
`_saveSession` replaces that value; `_removeSession` removes it on logout. The UI adds no token cookie.
`onAuthStateChange` sets or deletes the shared PostgREST Authorization header; `check` also sets it after success.
`check` requires session and GET user, else logout and `/login`; getPermissions returns user.role.

`captureSsoCallback` runs before routing, stores the hash/error in module memory and replaces the URL fragment.
Only the sanitized destination is in sessionStorage, under `neutree.sso.postLoginPath`.
`sanitizePostLoginPath` rejects off-site, login and callback paths; absent/unavailable storage lands on `/`.
Tests: `foundation/sso/sso-callback.test.ts`, `pages/auth/SsoCallbackPage.test.tsx`.

No secret prefill or masked-field backfill. Reopen leaves password inputs blank; required checks prevent submission.
Replacement uses the password body above; empty confirmation/mismatch sends no update.
LDAP passes returned access/refresh tokens to `setSession`; directory passwords are not persisted by the UI.

## Descriptions

Local/LDAP identifiers and passwords use native required checks. Recovery adds native email validation.
New password requires six characters; confirmation is required and `validatePasswordMatch` uses exact equality.
Mismatch toasts `pages.auth.errors.confirmPasswordNotMatch`; labels/placeholders use `pages.login` and `pages.auth`.
External help: `pages.updatePassword.externalManaged`. No further password-policy validation.

## Overrides

Provider/helpers stay in foundation because moving them removes no code. No shared secret-edit helper applies.
`verifyOnce` caches redemption promises because tokens are single-use and React reruns effects (kept comment).

## Error mapping

Local login/recovery/update/logout return SDK errors unchanged; no field mapping. Login/recovery/update catch throws.
LDAP `ldapFailure` ignores server text and uses title `pages.login.errors.title`.

| LDAP HTTP status | message key under pages.login.errors | backend source |
|---|---|---|
| 401 | invalidCredentials | `ldapErrorResponse`; invalid, missing or ambiguous user |
| 403 | accountDisabled | `handleLDAPToken`, `loginUser`; banned user |
| 404 | sourceNotFound | `sourceErrorResponse`; missing/disabled source |
| 503 | directoryUnavailable | `sourceErrorResponse`, `ldapErrorResponse` |
| other or missing session tokens | ldapFailed | `ldapFailure`; generic failure |

`KNOWN_ERRORS` in `SsoCallbackPage.tsx` maps codes to `pages.ssoCallback.errors.<code>` inline.

| OIDC code | displayed meaning | backend symbol |
|---|---|---|
| invalid_state | expired or mismatched sign-in session | `handleOIDCCallback` |
| idp_error | provider refused sign-in | `handleOIDCCallback` |
| idp_unavailable | provider unavailable | `handleOIDCAuthorize`, `finishLogin` |
| login_failed | account could not sign in | `finishLogin` |
| server_error | server failure | `handleOIDCAuthorize`, `finishLogin` |
| source_unavailable | sign-in method unavailable | `handleOIDCCallback` |
| user_disabled | disabled account; contact administrator | `finishLogin`, `loginUser` |

Other callback codes use unknown; absent capture uses missing; failed redemption uses verifyFailed.
Authorize failures before a safe redirect return JSON directly; browser navigation does not translate those errors.
`handleUpdateUser` refuses LDAP/OIDC password/email/phone writes with 403, including empty strings; null is skipped.
`onError` logs out only for code `PGRST301` or numeric 401, not statusCode or string "401".
Resource error transport: `src/foundation/contract.md`, “Error toast path”.

## Known deviations

1. Recovery requests use a path return address that conflicts with the hash router.
   UI: `foundation/providers/auth-provider/index.ts:authProvider.forgotPassword` requests `/update-password`;
   `src/App.tsx:App` uses HashRouter. API: `cmd/neutree-api/app/spa.go:spaFallback` redirects HTML path requests to
   `/#/update-password`, replacing a recovery fragment rather than preserving it.
   When GoTrue honors that return address, a signed-out user can lose the recovery session before reaching the form.
   This is a code trace, not a live mail-link test. Ticket: TBD
2. Unrecognized identity-source markers disable password change locally.
   UI: `foundation/role/user-identity.ts:isExternalUser` treats any trimmed nonempty marker as external;
   `src/pages/auth/UpdatePasswordPage.tsx:UpdatePasswordPage` hides the form.
   API: `internal/auth/identity_source.go:ExternallyManagedFields` protects only ldap and oidc;
   `handleUpdateUser` proxies other sources unchanged. Users with another marker cannot use a password-change
   action that this backend leaves available. Ticket: TBD

## Open points

No live GoTrue, mail delivery, session refresh or browser recovery journey was exercised.
GoTrue deployment password policy, mail templates and redirect allowlist remain unverified.
Provider/page tests pin SDK arguments, LDAP JSON, identity output and SSO navigation; SDK wire bodies are code reads.
No submit/transform moved.
