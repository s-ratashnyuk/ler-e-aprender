const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const detectImageMime = (base64: string): string | null => {
  const normalized = base64.trim();
  if (!normalized) {
    return null;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(normalized, "base64");
  } catch {
    return null;
  }

  if (buffer.length >= PNG_HEADER.length && buffer.subarray(0, PNG_HEADER.length).equals(PNG_HEADER)) {
    return "image/png";
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (buffer.length >= 6) {
    const header = buffer.subarray(0, 6).toString("ascii");
    if (header === "GIF87a" || header === "GIF89a") {
      return "image/gif";
    }
  }

  if (buffer.length >= 12) {
    const riff = buffer.subarray(0, 4).toString("ascii");
    const webp = buffer.subarray(8, 12).toString("ascii");
    if (riff === "RIFF" && webp === "WEBP") {
      return "image/webp";
    }
  }

  if (buffer.length >= 2 && buffer.subarray(0, 2).toString("ascii") === "BM") {
    return "image/bmp";
  }

  return null;
};

export const buildImageDataUrl = (base64: string, mime?: string | null): string | null => {
  const normalized = base64.trim();
  if (!normalized) {
    return null;
  }

  const resolvedMime = mime?.trim() || detectImageMime(normalized);
  if (!resolvedMime) {
    return null;
  }

  return `data:${resolvedMime};base64,${normalized}`;
};
