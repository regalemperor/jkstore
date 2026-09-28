import "server-only";

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

async function readBoundedBytes(request: Request, maxBytes: number) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new Error("Invalid request body limit.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const length = Number(declaredLength);
    if (Number.isSafeInteger(length) && length > maxBytes) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    throw new SyntaxError("Missing request body.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      total += value.byteLength;
      if (total > maxBytes) {
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return bytes;
}

export async function readTextBody(request: Request, maxBytes: number) {
  return new TextDecoder().decode(await readBoundedBytes(request, maxBytes));
}

export async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  return JSON.parse(await readTextBody(request, maxBytes)) as T;
}
