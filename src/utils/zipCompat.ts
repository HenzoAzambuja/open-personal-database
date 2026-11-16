import { unzipSync as fflateUnzipSync, zipSync as fflateZipSync } from "fflate";

export const strToU8 = (s: string) => new TextEncoder().encode(s);

export function zipSync(files: Record<string, Uint8Array>): Uint8Array {
  return fflateZipSync(files, { level: 6 });
}

export async function unzipSync(b: Uint8Array): Promise<Record<string, Uint8Array>> {
  try {
    const unzipped = fflateUnzipSync(b);
    const result: Record<string, Uint8Array> = {};
    for (const [key, val] of Object.entries(unzipped)) {
      if (!key.endsWith("/")) {
        result[key] = val;
      }
    }
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Falha ao descompactar pacote .opd: ${msg}`);
  }
}
