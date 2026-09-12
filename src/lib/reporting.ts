/**
 * @file reporting.ts
 * @description Installs Sentry as the sink for both of logger.ts's seams: reportError()
 * becomes a Sentry event, logger.* becomes a breadcrumb on it. Imported for its side effect
 * before anything else so both sinks exist before the first throw.
 */
import * as Sentry from '@sentry/react-native';
import type { SeverityLevel } from '@sentry/react-native';
import { setErrorReporter, setBreadcrumbSink, redact, redactString } from '@/src/lib/logger';
import type { LogLevel } from '@/src/lib/logger';

const BREADCRUMB_LEVEL: Record<LogLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // The logger owns the console in dev; Sentry owns production.
  enabled: true,
  // The logger strips emails/JWTs - do not let the SDK re-attach identifiers.
  sendDefaultPii: false,

  // Configure Session Replay
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // logger.* breadcrumbs arrive pre-redacted, but Sentry auto-captures console and network
  // breadcrumbs of its own - a Supabase URL can carry an identifier. Scrub everything on the
  // way out, so redaction does not depend on which code path produced the event.
  beforeSend: (event) => {
    event.exception?.values?.forEach((value) => {
      if (value.value) value.value = redactString(value.value);
    });

    if (event.message) event.message = redactString(event.message);

    event.breadcrumbs?.forEach((breadcrumb) => {
      if (breadcrumb.message) breadcrumb.message = redactString(breadcrumb.message);
      if (breadcrumb.data) breadcrumb.data = redact(breadcrumb.data);
    });

    return event;
  },
});

setErrorReporter((error, context) => {
  Sentry.captureException(error, { extra: context });
});

// logger.* becomes the trail leading to whatever reportError() captures.
setBreadcrumbSink((level, message, context) => {
  Sentry.addBreadcrumb({
    level: BREADCRUMB_LEVEL[level],
    message,
    data: context,
  });
});
