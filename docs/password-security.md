# Password changes and recovery

`GET /api/auth/password/capability` returns `hasPassword` only to the signed-in
account, based on its current database hash. It does not expose provider tokens
or a public account lookup. Google-only users change their password in
[Google account security](https://support.google.com/accounts/answer/41078).
Accounts with an existing local password retain change/reset access even if
they also use Google.

`POST /api/auth/password/change` requires the current password and a replacement
of 12–200 characters. Forgot, reset and change requests require a trusted browser
Origin. Successful change/reset consumes every outstanding reset token for that
account and invalidates all existing in-process sessions; sign-in is required again.
The response expires the current cookie. Notification-mail failure does not roll
back an already committed password change. Passwords and reset tokens are never
included in the change notification or logs.

Recovery returns the same message for local, Google-only, nonexistent and limited
accounts. A bounded worker queue performs lookup, token issuance and delivery
outside the HTTP request, avoiding SMTP/account-dependent response timing. Failed
delivery rolls back token issuance. Tokens use 256-bit randomness, SHA-256 storage,
a 30-minute expiry and transactional single-use consumption under an account lock.
Capability is rechecked when a token is consumed, including legacy tokens.

Limits use ten-minute windows: five change attempts per authenticated account,
twenty recovery requests per remote IP, three per normalized email, and twenty
reset attempts per remote IP. IPs come from the servlet remote address; forwarded
headers are not trusted here. The limiter holds at most 10,000 expiring keys; the
worker has one thread and 128 queued requests. Both are process-local, as are
existing login sessions. A restart clears limits and can drop undelivered recovery
requests; users can retry. Multiple application instances need shared rate limits
and session revocation before this deployment model is changed.

This follows [OWASP change-password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#change-password-feature)
and [OWASP recovery guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html).
Automated tests use transactional H2 data and mocked SMTP; configured-mail delivery
is a separate integration/release check.
