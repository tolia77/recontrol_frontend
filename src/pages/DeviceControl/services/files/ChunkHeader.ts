/**
 * 16-byte binary header for files-data chunks.
 *
 * Layout (all little-endian):
 *   bytes  0..3  : transferId (u32)
 *   bytes  4..7  : seq        (u32)
 *   bytes  8..15 : offset     (u64)
 *
 * offset is a u64 on the wire but represented here as a JS number. For offsets below
 * 2^53 (~8 PiB) this is lossless, which is more than enough for any file we'll transfer.
 * We split the u64 into two u32 halves to stay in safe-integer arithmetic.
 *
 * C# counterpart:
 *   recontrol_desktop/ReControl.Desktop/Services/Files/FilesProtocol/ChunkHeader.cs
 *
 * Shared test vector (hex, 16 bytes):
 *   78 56 34 12 DD CC BB AA EF CD AB 89 67 45 23 01
 *   -> transferId = 0x12345678
 *   -> seq        = 0xAABBCCDD
 *   -> offset     = 0x0123456789ABCDEF
 *
 * TODO(09): add a unit test here once the frontend adopts vitest. Parity with the C# side
 * is enforced today by ChunkHeaderTests.cs (xUnit). A developer can spot-check on the
 * browser console: paste the hex above into an ArrayBuffer and call ChunkHeader.read(buf).
 *
 * See recontrol_desktop/protocol/files-data.md for the full wire spec.
 */
export class ChunkHeader {
  static readonly SIZE = 16;

  readonly transferId: number;
  readonly seq: number;
  readonly offset: number;

  constructor(transferId: number, seq: number, offset: number) {
    this.transferId = transferId;
    this.seq = seq;
    this.offset = offset;
  }

  /**
   * Read a ChunkHeader from the 16 bytes starting at byteOffset in buf.
   * Throws if fewer than 16 bytes are available.
   */
  static read(buf: ArrayBuffer, byteOffset = 0): ChunkHeader {
    if (buf.byteLength - byteOffset < ChunkHeader.SIZE) {
      throw new Error(
        `Need ${ChunkHeader.SIZE} bytes at offset ${byteOffset}, got ${buf.byteLength - byteOffset}`,
      );
    }
    const dv = new DataView(buf, byteOffset, ChunkHeader.SIZE);
    const transferId = dv.getUint32(0, true);
    const seq = dv.getUint32(4, true);
    const offsetLo = dv.getUint32(8, true);
    const offsetHi = dv.getUint32(12, true);
    // Reassemble 64-bit value from two 32-bit halves. Safe up to 2^53.
    const offset = offsetHi * 0x100000000 + offsetLo;
    return new ChunkHeader(transferId, seq, offset);
  }

  /**
   * Write this header into the 16 bytes starting at byteOffset in buf.
   * Throws if fewer than 16 bytes are available.
   */
  writeTo(buf: ArrayBuffer, byteOffset = 0): void {
    if (buf.byteLength - byteOffset < ChunkHeader.SIZE) {
      throw new Error(`Need ${ChunkHeader.SIZE} bytes at offset ${byteOffset}`);
    }
    const dv = new DataView(buf, byteOffset, ChunkHeader.SIZE);
    dv.setUint32(0, this.transferId, true);
    dv.setUint32(4, this.seq, true);
    // Split 64-bit offset into two 32-bit halves (little-endian order: low half first).
    const offsetHi = Math.floor(this.offset / 0x100000000);
    // Bitwise OR with 0 coerces to int32; >>> 0 coerces to uint32.
    const offsetLo = (this.offset - offsetHi * 0x100000000) >>> 0;
    dv.setUint32(8, offsetLo, true);
    dv.setUint32(12, offsetHi, true);
  }
}
