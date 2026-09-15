/**
 * @file reporting.ts
 * @description Installs Sentry as the sink for both of logger.ts's seams: reportError()
 * becomes a Sentry event, logger.* becomes a breadcrumb on it.
 */
import * as Sentry from '@sentry/react-native';
import type { SeverityLevel } from '@sentry/react-native';
import { setErrorReporter, setBreadcrumbSink, redact, redactString } from '@/src/lib/logger';
import type { LogLevel } from '@/src/lib/logger';

// Translates logger vocabulary to sentry's
const BREADCRUMB_LEVEL: Record<LogLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: true,
  sendDefaultPii: false,

  // Every session that produces error gets recorded and is replayable
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // The last gate before an event leaves the device
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

// Every reportError() call in the app becomes Sentry.captureException.
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
