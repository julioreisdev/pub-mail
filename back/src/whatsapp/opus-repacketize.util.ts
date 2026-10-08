// ============================================================================
// Reempacotamento de OGG/Opus para mensagem de VOZ (PTT) — port de um patch da
// comunidade do Baileys (PR WhiskeySockets/Baileys#2648, nunca mesclado).
//
// O app nativo do WhatsApp grava voz em pacotes Opus com VÁRIOS quadros de 20 ms
// (TOC "code 3", em geral 3×20 ms = 60 ms). O ffmpeg/libopus gera um quadro por
// pacote ("code 0"). O WhatsApp do iOS recusa voz em code 0 — mostra "Este áudio
// não está mais disponível" — enquanto o Android toca os dois. Regrupar os quadros
// em pacotes code 3 resolve. Sem dependências; idempotente (code 3 ou não-OGG/Opus
// volta igual). Referência: RFC 6716 §3.1/§3.2 e RFC 3533 (páginas OGG).
// ============================================================================

const OGG_CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = (i << 24) >>> 0;
    for (let j = 0; j < 8; j++)
      r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    table[i] = r >>> 0;
  }
  return table;
})();

function oggPageCrc(page: Buffer): number {
  let crc = 0;
  for (let i = 0; i < page.length; i++)
    crc =
      (((crc << 8) >>> 0) ^ OGG_CRC_TABLE[((crc >>> 24) & 0xff) ^ page[i]]) >>>
      0;
  return crc >>> 0;
}

// duração do quadro (em amostras a 48 kHz) a partir do "config" do TOC (RFC 6716 §3.1)
function opusFrameSamples48k(config: number): number {
  const c = config & 0x1f;
  const ms =
    c < 12
      ? [10, 20, 40, 60][c % 4]
      : c < 16
        ? c % 2 === 0
          ? 10
          : 20
        : [2.5, 5, 10, 20][c % 4];
  return Math.round(ms * 48);
}

function parseOggPackets(buf: Buffer) {
  const packets: Buffer[] = [];
  let cur: Buffer[] = [];
  let off = 0;
  let serial = 0;
  let preSkip = 0;
  while (off + 27 <= buf.length) {
    if (buf.toString('ascii', off, off + 4) !== 'OggS') break;
    serial = buf.readUInt32LE(off + 14);
    const nseg = buf[off + 26];
    const segTableStart = off + 27;
    let dataOff = segTableStart + nseg;
    for (let s = 0; s < nseg; s++) {
      const len = buf[segTableStart + s];
      cur.push(buf.subarray(dataOff, dataOff + len));
      dataOff += len;
      if (len < 255) {
        packets.push(Buffer.concat(cur));
        cur = [];
      }
    }
    off = dataOff;
  }
  if (cur.length) packets.push(Buffer.concat(cur));
  if (
    (packets[0]?.length ?? 0) >= 12 &&
    packets[0].subarray(0, 8).toString('ascii') === 'OpusHead'
  )
    preSkip = packets[0].readUInt16LE(10);
  return { packets, serial, preSkip };
}

function encodeOpusFrameLength(len: number): number[] {
  if (len < 252) return [len];
  const b0 = 252 + (len % 4);
  return [b0, Math.floor((len - b0) / 4)];
}

function buildOggPage(
  headerType: number,
  granule: number,
  serial: number,
  seq: number,
  packet: Buffer,
): Buffer {
  const segs: number[] = [];
  let rem = packet.length;
  while (rem >= 255) {
    segs.push(255);
    rem -= 255;
  }
  segs.push(rem);
  const header = Buffer.alloc(27 + segs.length);
  header.write('OggS', 0, 'ascii');
  header[4] = 0;
  header[5] = headerType;
  header.writeBigUInt64LE(BigInt(granule), 6);
  header.writeUInt32LE(serial >>> 0, 14);
  header.writeUInt32LE(seq >>> 0, 18);
  header[26] = segs.length;
  for (let i = 0; i < segs.length; i++) header[27 + i] = segs[i];
  const page = Buffer.concat([header, packet]);
  page.writeUInt32LE(oggPageCrc(page), 22);
  return page;
}

export function isOggOpus(buf: Buffer): boolean {
  if (
    !Buffer.isBuffer(buf) ||
    buf.length < 4 ||
    buf.toString('ascii', 0, 4) !== 'OggS'
  )
    return false;
  const { packets } = parseOggPackets(buf);
  return (
    packets.length >= 3 &&
    packets[0].subarray(0, 8).toString('ascii') === 'OpusHead'
  );
}

/** TOC "code" (0..3) do 1º pacote de áudio, ou null se não for OGG/Opus. Útil em diagnóstico/teste. */
export function firstOpusTocCode(buf: Buffer): number | null {
  if (!isOggOpus(buf)) return null;
  const { packets } = parseOggPackets(buf);
  const p = packets[2];
  return p?.length ? p[0] & 0x03 : null;
}

/**
 * Regrupa pacotes Opus de um quadro ("code 0") em pacotes de vários quadros ("code 3",
 * padrão 3×20 ms = 60 ms), como o cliente nativo do WhatsApp faz nas mensagens de voz —
 * assim tocam no iOS. Devolve a entrada intacta se não for OGG/Opus ou se já for code 3.
 */
export function repacketizeOggOpusToCode3(
  input: Buffer,
  framesPerPacket = 3,
): Buffer {
  if (
    !Buffer.isBuffer(input) ||
    input.length < 4 ||
    input.toString('ascii', 0, 4) !== 'OggS'
  )
    return input;
  const { packets, serial, preSkip } = parseOggPackets(input);
  if (
    packets.length < 3 ||
    packets[0].subarray(0, 8).toString('ascii') !== 'OpusHead'
  )
    return input;
  const audioPackets = packets.slice(2);
  if (audioPackets[0]?.length && (audioPackets[0][0] & 0x03) === 3)
    return input; // já é multi-quadro
  const frames = audioPackets
    .filter((p) => p.length >= 1)
    .map((p) => ({
      configStereo: p[0] >> 2,
      samples: opusFrameSamples48k(p[0] >> 3),
      data: p.subarray(1),
    }));
  if (!frames.length) return input;

  const out: Buffer[] = [
    buildOggPage(0x02, 0, serial, 0, packets[0]),
    buildOggPage(0x00, 0, serial, 1, packets[1]),
  ];
  let seq = 2;
  let samplesDone = 0;
  let i = 0;
  while (i < frames.length) {
    // um pacote code 3 só pode ter quadros com o mesmo config; o libopus pode alternar
    // SILK<->CELT entre quadros, então só agrupa consecutivos iguais
    const cs = frames[i].configStereo;
    const group: Buffer[] = [];
    while (
      i < frames.length &&
      group.length < framesPerPacket &&
      frames[i].configStereo === cs
    ) {
      group.push(frames[i].data);
      samplesDone += frames[i].samples;
      i++;
    }
    const toc = ((cs << 2) | 3) & 0xff;
    const frameCountByte = (0x80 | group.length) & 0xff; // VBR, sem padding, contagem
    const lengths: number[] = [];
    for (let k = 0; k < group.length - 1; k++)
      lengths.push(...encodeOpusFrameLength(group[k].length));
    const packet = Buffer.concat([
      Buffer.from([toc, frameCountByte, ...lengths]),
      ...group,
    ]);
    out.push(
      buildOggPage(
        i >= frames.length ? 0x04 : 0x00,
        preSkip + samplesDone,
        serial,
        seq,
        packet,
      ),
    );
    seq++;
  }
  return Buffer.concat(out);
}
