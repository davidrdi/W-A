import zlib from "node:zlib";

export interface DecodedPng {
  width: number;
  height: number;
  /** Devuelve [r, g, b] del píxel indicado. */
  pixel: (x: number, y: number) => [number, number, number];
}

/**
 * Decodificador PNG mínimo (8 bits, no entrelazado) para las capturas de Playwright.
 *
 * Se hace a mano en vez de tirar de una librería de imagen porque la única pregunta
 * que hay que responder es "¿de qué color es este píxel?", y añadir una dependencia
 * binaria a un monorepo que ya sufrió problemas de instalación no compensa.
 */
export function decodePng(buffer: Buffer): DecodedPng {
  let offset = 8; // cabecera PNG
  let width = 0;
  let height = 0;
  let colorType = 0;
  let bitDepth = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (bitDepth !== 8) throw new Error(`PNG con bitDepth ${bitDepth} no soportado`);
      if (data[12] !== 0) throw new Error("PNG entrelazado no soportado");
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length; // len + type + data + crc
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 4 ? 2 : 1;
  if (channels < 3) throw new Error(`PNG con colorType ${colorType} no soportado`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  // Deshace el filtrado por scanline (PNG spec, sección 9.2).
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null;

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? out[i - channels] : 0;
      const b = prev ? prev[i] : 0;
      const c = prev && i >= channels ? prev[i - channels] : 0;
      const x = line[i];

      switch (filter) {
        case 0:
          out[i] = x;
          break;
        case 1:
          out[i] = (x + a) & 0xff;
          break;
        case 2:
          out[i] = (x + b) & 0xff;
          break;
        case 3:
          out[i] = (x + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          out[i] = (x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`Filtro PNG desconocido: ${filter}`);
      }
    }
  }

  return {
    width,
    height,
    pixel: (x, y) => {
      const i = y * stride + x * channels;
      return [pixels[i], pixels[i + 1], pixels[i + 2]];
    },
  };
}

/** Porcentaje (0-1) de píxeles cercanos al color dado. */
export function shareOfColor(png: DecodedPng, [r, g, b]: [number, number, number], tolerance = 24): number {
  let hits = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const [pr, pg, pb] = png.pixel(x, y);
      if (Math.abs(pr - r) <= tolerance && Math.abs(pg - g) <= tolerance && Math.abs(pb - b) <= tolerance) hits++;
    }
  }
  return hits / (png.width * png.height);
}
