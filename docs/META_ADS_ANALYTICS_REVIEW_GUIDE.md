# Meta Ads Analytics review guide

## Purpose and permission

AdsHunting lets an authenticated user connect an ad account they are authorized to access and inspect read-only spend, impressions, clicks, reach, CTR, CPC, CPM, daily trends, platform distribution, and campaign reporting. The integration requests only `ads_read`. It does not create, edit, publish, or delete ads and therefore does not request `ads_management`.

Demo mode is fictional sample data and is always labelled **Demo Data**. It must not be used as evidence that Meta API access works.

## Environment prerequisites

1. Apply `supabase/migrations/20261114000002_meta_ads_analytics.sql`.
2. In Meta for Developers, copy the App ID from **App settings → Basic** into the server-only `META_APP_ID` variable. Copy the App Secret into server-only `META_APP_SECRET`; never expose either through a `NEXT_PUBLIC_` variable or browser response.
3. Configure `META_API_VERSION` to a currently supported version used by the Meta app. The application validates the `vN.N` format and currently falls back to `v27.0`, but production should set the version explicitly and review it before Meta retires that version.
4. Generate a distinct 256-bit `META_ANALYTICS_ENCRYPTION_KEY` as exactly 64 hexadecimal characters with `openssl rand -hex 32`, and store it only in the deployment secret manager. Back it up securely: losing it makes stored connections undecryptable. Rotation requires decrypting with the old key and re-encrypting with the new key, or disconnecting all accounts and requiring reauthorization.
5. Set `META_ANALYTICS_REDIRECT_URI` to the exact HTTPS callback URL, for example `https://staging.example.com/api/ads-analytics/callback`. In the Meta app's Facebook Login configuration, add the identical URI under **Valid OAuth Redirect URIs**. Scheme, hostname, path, port, and trailing slash must match. Add the staging hostname to the app domains and OAuth allowed domains.
6. Enable the Meta product/use case that supports Facebook Login for Business and Marketing API access. Request Advanced Access for `ads_read` when required, complete business verification and data-use checks where Meta requires them, and keep the app in the appropriate development/live mode for the users who will test it.
7. In development mode, the connecting Meta user must have an app role or permitted test role and legitimate access to the supplied ad account. For review, provide a dedicated reviewer path and authorized account containing non-sensitive reporting data. Never share a production advertiser's credentials.

Meta approval is not guaranteed. Requirements and Graph API versions must be rechecked in Meta's current documentation before submission.

## Reproducible reviewer flow

1. Sign in to the supplied AdsHunting reviewer account.
2. Open **Ads Analytics** from the sidebar.
3. Confirm the initial sample view is labelled **Demo Data**.
4. Select **Connected Meta account**, then choose **Connect Meta Account**.
5. Complete Meta authorization and grant `ads_read` for the supplied authorized account.
6. Select that account and confirm the source indicator says **Live Meta Data**, shows the account suffix, currency, timezone, and update time.
7. Change the range from Last 30 days to Last 7 days and confirm cards, charts, platform rows, and campaigns reload.
8. Search or sort Campaign Performance, open a campaign, and inspect its reporting-period metrics and daily trend.
9. Select **View ad sets**, open one ad set, then inspect its individual ads. Confirm every level retains the selected account and reporting period. Open a Meta ad preview only when Meta returned a supported preview URL.
10. Export CSV at campaign and drilldown levels. Confirm its first column says `LIVE META DATA` and matches the current search/status filters and reporting period.
11. Disconnect the account in the UI. Confirm AdsHunting attempts Meta permission revocation, deletes the encrypted local connection, and no longer offers the account for reporting. Reconnect to demonstrate renewed authorization.

Explain that `ads_read` is necessary because these private performance metrics are not available through public ad-library data. The benefit is a consolidated, read-only performance dashboard for the user's own authorized advertising accounts.

## Security and data handling

- OAuth state is a short-lived, HttpOnly, SameSite cookie and is validated before token exchange.
- Tokens are exchanged and used only on the server, encrypted with AES-256-GCM before storage, never returned to browser responses, and never intentionally logged.
- Every connection and report query is scoped to the authenticated Clerk user/workspace. The token table revokes all browser roles, including `authenticated`; only server-side service-role queries can access it and every such query includes the Clerk workspace ID.
- Live API errors are shown as errors; demo results are never substituted for failed live results.
- Disconnect attempts Meta permission revocation and always removes the local encrypted connection.
- Reporting responses are not shared-cacheable. CSV files are created locally in the user's browser from the currently visible normalized report.

## Recording checklist

Record one continuous run showing the HTTPS browser address, AdsHunting sign-in, Ads Analytics navigation, Meta consent screen with `ads_read`, a real account selection, live source badge/account suffix, changed date range, campaign detail, ad-set and ad detail, CSV export, disconnect, and reconnect. Compare one account-level total and one campaign row to Meta Ads Manager or Graph API Explorer for the identical account, account timezone, period, and attribution settings. Avoid exposing access tokens, app secrets, unrelated accounts, or personal data.

Live verification still requires a configured Meta app, current permission access, an authorized test account with reporting data, the deployed migration, and a hosted HTTPS callback. Local demo tests cannot establish those external prerequisites.

## Current environment status (14 November 2026)

The ignored local environment contains `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION=v27.0`, and a locally generated 256-bit `META_ANALYTICS_ENCRYPTION_KEY`. The key value is not committed or documented. `META_ANALYTICS_REDIRECT_URI` remains unset because no authenticated staging deployment/domain was available to establish the exact HTTPS callback. Legitimate OAuth is therefore **BLOCKED** until an administrator provisions the same encryption key in staging, sets the exact staging callback, and registers it in Meta.

The linked Supabase project `ads intelligence` was identified by the CLI as **production**. Migration `20261114000002_meta_ads_analytics.sql` is pending there and was intentionally not applied. A separate staging project or explicit production approval is required.

The Clerk development application `ads intelligence` has Facebook login enabled with custom credentials, but its Facebook client ID does not match the backend analytics `META_APP_ID`; treat them as distinct Meta applications unless verified otherwise in Meta for Developers. Because a Clerk Facebook App Secret was exposed in a screenshot, rotate it in Meta and Clerk using the sequence below. Do not replace the analytics backend secret during that rotation unless its App ID is confirmed to be the exposed application.

1. Keep the existing Clerk Facebook provider active while creating/resetting the secret in the corresponding Meta application.
2. Immediately update the Clerk development instance's Facebook provider secret, then test Facebook sign-in in a separate session.
3. Update the Clerk production instance only during an approved production change window, and test sign-in before invalidating any remaining old credential.
4. If Meta invalidates the old secret immediately on reset, coordinate the Clerk update in the same maintenance window and keep email/Google sign-in available as recovery paths.
5. Verify the Meta App ID in each dashboard before entering the new secret. Never copy the exposed secret into the analytics environment or chat.

No live connection, Insights reconciliation, hosted RLS test, browser acceptance, or Meta review decision is claimed.
