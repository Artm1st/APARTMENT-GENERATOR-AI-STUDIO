export class GeminiTemporarilyUnavailableError extends Error {
  constructor(message = "Gemini está temporalmente ocupado. Intenta nuevamente en unos segundos.") {
    super(message);
    this.name = "GeminiTemporarilyUnavailableError";
  }
}

export interface GeminiFallbackOptions {
  models?: string[];
  retriesPerModel?: number;
  baseDelayMs?: number;
}

const DEFAULT_MODELS = [
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
];

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export function resolveV2GeminiModels(): string[] {
  const override = typeof process !== "undefined" ? process.env.GEMINI_MODEL_V2 : undefined;
  return unique([override ?? "", ...DEFAULT_MODELS]);
}

export function isTransientGeminiError(error: unknown): boolean {
  const anyError = error as any;
  const numericCodes = [
    Number(anyError?.status),
    Number(anyError?.code),
    Number(anyError?.error?.code),
    Number(anyError?.response?.status),
  ].filter(Number.isFinite);

  if (numericCodes.some((code) => [429, 500, 502, 503, 504].includes(code))) {
    return true;
  }

  const message = String(anyError?.message ?? error ?? "");
  return /\b429\b|\b500\b|\b502\b|\b503\b|\b504\b|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|temporar(?:y|ily)|overloaded|try again later/i.test(message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithGeminiFallback<T>(
  operation: (model: string) => Promise<T>,
  options: GeminiFallbackOptions = {}
): Promise<{ value: T; model: string }> {
  const models = unique(options.models ?? resolveV2GeminiModels());
  const retriesPerModel = Math.max(1, Math.floor(options.retriesPerModel ?? 2));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? 650));

  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= retriesPerModel; attempt++) {
      try {
        const value = await operation(model);
        return { value, model };
      } catch (error) {
        lastError = error;
        if (!isTransientGeminiError(error)) {
          throw error;
        }

        console.warn(
          `[Engine v2] Gemini temporalmente no disponible en ${model} (intento ${attempt}/${retriesPerModel}).`
        );

        if (attempt < retriesPerModel && baseDelayMs > 0) {
          await sleep(baseDelayMs * attempt);
        }
      }
    }
  }

  console.error("[Engine v2] Todos los modelos Gemini de respaldo fallaron.", lastError);
  throw new GeminiTemporarilyUnavailableError(
    "Los modelos Gemini están temporalmente ocupados o alcanzaron un límite momentáneo. Engine v2 reintentó automáticamente; espera unos segundos y vuelve a generar."
  );
}
