// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV;

Sentry.init({
  dsn: "https://7dc9b3e8560c01b07445871f08f7a7a1@o4512032724418560.ingest.us.sentry.io/4512032729464832",
  enabled: environment === "production" || environment === "preview",
  environment: environment ?? "local",
  release: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});
