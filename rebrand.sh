#!/bin/bash

# Privacy page
sed -i '' "s/Review Bucket\&apos;s/Review Ads Hunting\&apos;s/g" app/\(workspace\)/settings/privacy/page.tsx
sed -i '' "s/Bucket stores/Ads Hunting stores/g" app/\(workspace\)/settings/privacy/page.tsx
sed -i '' "s/Bucket does not claim/Ads Hunting does not claim/g" app/\(workspace\)/settings/privacy/page.tsx

# Methodology page
sed -i '' "s/How Bucket derives/How Ads Hunting derives/g" app/\(workspace\)/settings/methodology/page.tsx
sed -i '' "s/Bucket intelligence is/Ads Hunting intelligence is/g" app/\(workspace\)/settings/methodology/page.tsx
sed -i '' "s/Bucket does not infer/Ads Hunting does not infer/g" app/\(workspace\)/settings/methodology/page.tsx

# Billing page
sed -i '' "s/Your Bucket subscription/Your Ads Hunting subscription/g" app/\(workspace\)/settings/billing/page.tsx
sed -i '' "s/using Bucket/using Ads Hunting/g" app/\(workspace\)/settings/billing/page.tsx

# Share page
sed -i '' "s/shared via Bucket/shared via Ads Hunting/g" app/share/\[token\]/page.tsx
sed -i '' "s/with Bucket/with Ads Hunting/g" app/share/\[token\]/page.tsx
sed -i '' "s/Sign in to Bucket/Sign in to Ads Hunting/g" app/share/\[token\]/page.tsx
sed -i '' "s/Explore Bucket/Explore Ads Hunting/g" app/share/\[token\]/page.tsx

# Dashboard view
sed -i '' "s/Learn Bucket/Learn Ads Hunting/g" components/dashboard-view.tsx

# Auth shell
sed -i '' "s/Bucket account/Ads Hunting account/g" components/auth-shell.tsx
sed -i '' "s/alt=\"Bucket Creative Intelligence\"/alt=\"Ads Hunting Creative Intelligence\"/g" components/auth-shell.tsx

# Shared creative view
sed -i '' "s/Bucket Signals/Ads Hunting Signals/g" components/shared-creative-view.tsx

# Ad detail
sed -i '' "s/BucketSignalsPanel/AdsHuntingSignalsPanel/g" components/ad-detail.tsx
sed -i '' "s/Bucket Signals/Ads Hunting Signals/g" components/ad-detail.tsx

# Billing History
sed -i '' "s/Bucket Pro Subscription/Ads Hunting Pro Subscription/g" components/billing/BillingHistory.tsx

# Plan Card
sed -i '' "s/name: \"Bucket\"/name: \"Ads Hunting\"/g" components/billing/PlanCard.tsx
sed -i '' "s/Bucket Pro Subscription/Ads Hunting Pro Subscription/g" components/billing/PlanCard.tsx
sed -i '' "s/Bucket trial/Ads Hunting trial/g" components/billing/PlanCard.tsx
sed -i '' "s/full Bucket access/full Ads Hunting access/g" components/billing/PlanCard.tsx
sed -i '' "s/Bucket Pro will/Ads Hunting Pro will/g" components/billing/PlanCard.tsx
sed -i '' "s/Bucket\&apos;s ads intelligence/Ads Hunting\&apos;s ads intelligence/g" components/billing/PlanCard.tsx

# lib/brand.ts
sed -i '' "s/name: \"Bucket\"/name: \"Ads Hunting\"/g" lib/brand.ts
sed -i '' "s/uppercaseName: \"BUCKET\"/uppercaseName: \"ADS HUNTING\"/g" lib/brand.ts

# lib/billing/billing-config.ts
sed -i '' "s/name: \"Bucket Pro\"/name: \"Ads Hunting Pro\"/g" lib/billing/billing-config.ts

# supabase functions
sed -i '' "s/planName: \"Bucket Pro\"/planName: \"Ads Hunting Pro\"/g" supabase/functions/billing-create-subscription/index.ts

# supabase templates
sed -i '' "s/>Bucket</>Ads Hunting</g" supabase/templates/confirmation.html
sed -i '' "s/Bucket login screen/Ads Hunting login screen/g" supabase/templates/confirmation.html
sed -i '' "s/>Bucket</>Ads Hunting</g" supabase/templates/magic-link.html
sed -i '' "s/Bucket login screen/Ads Hunting login screen/g" supabase/templates/magic-link.html

