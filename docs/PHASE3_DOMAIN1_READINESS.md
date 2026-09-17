# Phase 3 — DOMAIN-1 Readiness

**No binding is performed by this phase.** `globalnewsai.live` is untouched,
`alpha.globalnewsai.live` is not bound, no Porkbun DNS record has been created or
changed, and no Railway-generated domain has been removed. This is a readiness
statement about the candidate, not an action on the infrastructure.

This phase does **not** re-run the DOMAIN-1 R1 inspection. It re-verifies that
the conditions that inspection's verdict rested on still hold for **this**
candidate after Phase 1 and Phase 2.

---

## 1 · The session-isolation model still holds, and is stronger than "unset"

The DOMAIN-1 verdict rests on one structural property: a cookie set on
`globalnewsai.live` must not be sent to `alpha.globalnewsai.live`.

That is guaranteed by **host-only cookies** — a cookie with no `Domain`
attribute is scoped to the exact host that set it, and is never sent to a
subdomain or a sibling.

**Measured on this candidate:**

| check | result |
| ----- | ------ |
| `Domain=` anywhere in frontend or backend source | **none** |
| `domain` field on the backend's `CookieOptions` | **does not exist** |

The second is the important one. The auth cookie's option type declares exactly
`httpOnly`, `sameSite: 'lax'`, `secure` and `path` — **there is no `domain`
field to set**. Host-only is not merely the current value; it is
*unrepresentable*. A future contributor cannot widen the scope by editing a
value, only by changing a type, which is a visible act.

The language cookie is written client-side as
`path=/; max-age=31536000; SameSite=Lax` with no `Domain`, so it is host-only by
the same rule.

**`SameSite=Lax` does not weaken this.** Lax is about *request context* — it
governs whether a cookie rides along on a cross-site navigation — and
`globalnewsai.live` and `alpha.globalnewsai.live` share a registrable domain, so
they are same-site to that mechanism. Cookie *scoping* is a separate question
answered by `Domain`, and that answer is host-only. The two surfaces therefore
have genuinely separate sessions: signing in on one does not sign in on the
other.

---

## 2 · Nothing in the convergence work touched hostname-sensitive configuration

```
git diff --name-only 2c4b6ce..HEAD | grep -iE 'cors|cookie|origin|canonical|oauth|callback|security|next.config|metadata'
  (no matches)
```

Phase 1 added a language control, a language reconciliation and a sign-in return
state. None of them writes a cookie of its own:

- the map language control calls the existing `persistLanguageSelection`;
- `LanguageSync` calls the same function and holds no store;
- the sign-in return state uses **`sessionStorage`**, which is origin-scoped and
  per-tab, and never reaches the server.

The auth return-state work is the one that could plausibly have touched this, and
it deliberately did not: the `returnTo` allowlist, the HMAC flow-state cookie and
the same-origin exit assertion are all unchanged, because the state was kept in
the browser instead of carried through the redirect.

---

## 3 · Binding is a configuration action, not a source change

The hostname-sensitive values are environment variables, not literals:

| value | source |
| ----- | ------ |
| CORS origin | `FRONTEND_ORIGIN` — `resolveFrontendOrigin()`, validated at startup by `CorsStartupValidator` |
| OAuth callback base | `PUBLIC_OAUTH_CALLBACK_BASE` |
| Public backend origin | `public-backend-origin.config.ts` |

No hostname is compiled into the candidate, so binding the Alpha host requires
setting variables on the Alpha environment — not editing and redeploying source.
`CorsStartupValidator` fails startup when `NODE_ENV=production` and
`FRONTEND_ORIGIN` is missing, so a misconfigured binding is loud rather than
silent.

---

## 4 · DNS shape, without inventing values

The record **types, hosts and sequence** are stated. The **values are not**,
because Railway generates them and this phase does not have them. No placeholder
here should be read as a value to use.

| step | actor | action |
| ---- | ----- | ------ |
| 1 | Railway | add the custom domain `alpha.globalnewsai.live` to the **Alpha frontend service instance** |
| 2 | Railway | issues a target hostname — **value UNKNOWN until step 1 is performed** |
| 3 | Porkbun | create **one `CNAME`** at host `alpha` pointing to that issued target |
| 4 | Railway | domain verification |
| 5 | Railway | TLS certificate issuance |

Notes that matter:

- A `CNAME` is correct because the target is a hostname, not an address. An `A`
  record would require an IP Railway does not commit to.
- The record is created at host `alpha` only. **The apex is not touched**, which
  is what keeps `globalnewsai.live` out of this change entirely.
- Custom domains attach to a **per-environment service instance**, so binding
  the Alpha instance cannot affect the Production instance.
- **Existing Railway-generated URLs must remain usable** and are not removed.

---

## 5 · Verdict — Alpha binding only

**GO**, for `alpha.globalnewsai.live` on the Alpha frontend service instance,
subject to the two conditions below.

The readiness conditions the DOMAIN-1 verdict rested on all still hold on this
candidate: host-only session isolation is intact and structurally enforced, no
hostname is compiled in, and no hostname-sensitive file was touched by Phase 1
or Phase 2.

**Conditions:**

1. `FRONTEND_ORIGIN` and `PUBLIC_OAUTH_CALLBACK_BASE` must be set on the Alpha
   environment to the Alpha host **before** traffic is sent to it. The OAuth
   redirect URI must be registered for the new host, or sign-in on the bound
   host will fail at the provider.
2. The binding is an **operator action requiring explicit approval**. This phase
   performs none of it.

**HOLD** remains in force for `globalnewsai.live` and for Production in every
respect. Nothing in this phase changes that.

---

## 6 · What this phase deliberately did not do

- No domain attached, in Railway or anywhere else.
- No DNS record created, changed or deleted at Porkbun.
- No Railway variable set or read-modified.
- No Railway-generated domain removed.
- No OAuth client configuration changed.
- No deployment of any kind.
- No Railway-generated value invented, guessed or written down as if known.
