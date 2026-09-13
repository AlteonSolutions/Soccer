/*
 * Pulls the text layer out of the league's schedule PDF. unpdf is pdf.js packaged for serverless
 * runtimes: pure JavaScript, no canvas, so it bundles into the Functions app with esbuild and runs
 * on the Static Web Apps host. Parsing the text into games is the pure function
 * parseScheduleText in @soccer/shared; this file only turns bytes into lines.
 */
import { AppError } from "@soccer/shared";
import { extractText, getDocumentProxy } from "unpdf";

// 5 MB: the league's PDF is under 100 KB; this stops an accidental photo or scan upload before
// pdf.js spends the API's 45-second budget on it.
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength === 0) {
    throw new AppError("VALIDATION", "Choose a PDF file first.", "Empty body on schedule parse.");
  }
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new AppError(
      "VALIDATION",
      "That file is too large. The schedule PDF is small.",
      "Schedule upload over MAX_PDF_BYTES.",
    );
  }
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  } catch (error) {
    throw new AppError(
      "VALIDATION",
      "That file could not be read as a PDF.",
      "pdf.js failed to open the upload; not a PDF, or a scanned image with no text layer.",
      { cause: error },
    );
  }
}
