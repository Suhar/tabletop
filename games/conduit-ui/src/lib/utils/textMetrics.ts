// The theme's monospaced faces, measured in the browser: how far each character advances and how tall
// digits stand on the baseline, in em. SVG text has no layout, so pills size and centre from these.
export interface Face {
    advance: number
    digitHeight: number
}

// Conduit OCR: OCR-A (Matthew Skala's, fonts/OCRA.otf), the emblem letters' face.
export const OcrFace: Face = { advance: 0.723, digitHeight: 0.78 }
// Conduit Mono: Share Tech Mono, for text OCR-A is too wide for.
export const MonoFace: Face = { advance: 0.54, digitHeight: 0.704 }

export function textWidth(face: Face, text: string, fontSize: number): number {
    return text.length * face.advance * fontSize
}

// The dy that centres digits on y with the alphabetic baseline (see docs/phone-rendering.md).
export function centredShift(face: Face, fontSize: number): number {
    return (face.digitHeight / 2) * fontSize
}
