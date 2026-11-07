import type { OcrPage } from "../core/detect";
import type { Rgba } from "../core/redact";

export interface OcrEngine {
  recognize(image: Rgba, onProgress?: (fraction: number) => void): Promise<OcrPage>;
  terminate(): Promise<void>;
}
