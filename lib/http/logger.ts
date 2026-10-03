import "server-only";

type LogDetails = Record<string, unknown>;

function write(level: "warn" | "error", event: string, details?: LogDetails) {
  const payload = {
    level,
    service: "jkstore",
    event,
    timestamp: new Date().toISOString(),
    ...(details ?? {}),
  };

  console[level](JSON.stringify(payload));
}

export function logWarning(event: string, details?: LogDetails) {
  write("warn", event, details);
}

export function logError(event: string, details?: LogDetails) {
  write("error", event, details);
}

export function getSafeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return { errorName: error.name };
  }

  return { errorName: "UnknownError" };
}
