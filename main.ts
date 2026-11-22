// Tiny stack VM: faithful interpreter of make.fun's tiny stack ISA v1 (ISA.md in
// the kit). Node 22 runs this as main.ts; plain JavaScript, no dependencies.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const OUT = new Uint8Array(65536);
let OL = 0;
function run(p, inp) {
  const n = p.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  let sp = 0, cp = 0, ip = 0, pc = 0, left = 1000000;
  OL = 0;
  for (;;) {
    if (--left < 0) return 10;
    if (pc < 0 || pc >= n) return 9;
    const op = p[pc++];
    switch (op) {
      case 0x00: return 0;
      case 0x01:
        if (pc >= n) return 9;
        if (sp >= 256) return 3;
        D[sp++] = (p[pc++] << 24) >> 24;
        break;
      case 0x02:
        if (pc + 3 >= n) return 9;
        if (sp >= 256) return 3;
        D[sp++] = p[pc] | (p[pc + 1] << 8) | (p[pc + 2] << 16) | (p[pc + 3] << 24);
        pc += 4;
        break;
      case 0x03:
        if (sp < 1) return 2;
        sp--;
        break;
      case 0x04:
        if (sp < 1) return 2;
        if (sp > 255) return 3;
        D[sp] = D[sp - 1]; sp++;
        break;
      case 0x05:
        if (sp < 2) return 2;
        { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; }
        break;
      case 0x06:
        if (sp < 2) return 2;
        if (sp > 255) return 3;
        D[sp] = D[sp - 2]; sp++;
        break;
      case 0x07:
        if (sp < 3) return 2;
        { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; }
        break;
      case 0x10: case 0x11: case 0x12: case 0x13: case 0x14: case 0x15: case 0x16:
      case 0x18: case 0x19: case 0x1a: case 0x1c: case 0x1d: case 0x1e: case 0x20: case 0x21: case 0x22: {
        if (sp < 2) return 2;
        const b = D[sp - 1], a = D[sp - 2];
        let r;
        switch (op) {
          case 0x10: r = (a + b) | 0; break;
          case 0x11: r = (a - b) | 0; break;
          case 0x12: r = Math.imul(a, b); break;
          case 0x13: if (b === 0) return 4; r = (a / b) | 0; break;
          case 0x14: if (b === 0) return 4; r = (a % b) | 0; break;
          case 0x15: if (b === 0) return 4; r = Math.floor((a >>> 0) / (b >>> 0)) | 0; break;
          case 0x16: if (b === 0) return 4; r = ((a >>> 0) % (b >>> 0)) | 0; break;
          case 0x18: r = a & b; break;
          case 0x19: r = a | b; break;
          case 0x1a: r = a ^ b; break;
          case 0x1c: r = a << b; break;
          case 0x1d: r = a >> b; break;
          case 0x1e: r = (a >>> b) | 0; break;
          case 0x20: r = a === b ? 1 : 0; break;
          case 0x21: r = a < b ? 1 : 0; break;
          default: r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        }
        sp -= 2; D[sp++] = r;
        break;
      }
      case 0x17:
        if (sp < 1) return 2;
        D[sp - 1] = -D[sp - 1] | 0;
        break;
      case 0x1b:
        if (sp < 1) return 2;
        D[sp - 1] = ~D[sp - 1];
        break;
      case 0x30: {
        if (pc + 1 >= n) return 9;
        const rel = ((p[pc] | (p[pc + 1] << 8)) << 16) >> 16;
        pc += 2 + rel;
        break;
      }
      case 0x31: case 0x32: {
        if (pc + 1 >= n) return 9;
        const rel = ((p[pc] | (p[pc + 1] << 8)) << 16) >> 16;
        pc += 2;
        if (sp < 1) return 2;
        if ((op === 0x31) === (D[--sp] === 0)) pc += rel;
        break;
      }
      case 0x33:
        if (pc + 1 >= n) return 9;
        if (cp >= 64) return 7;
        C[cp++] = pc + 2;
        pc = p[pc] | (p[pc + 1] << 8);
        break;
      case 0x34:
        if (cp === 0) return 8;
        pc = C[--cp];
        break;
      case 0x40: {
        if (sp < 1) return 2;
        const a = D[sp - 1];
        if (a < 0 || a > 255) return 6;
        D[sp - 1] = M[a];
        break;
      }
      case 0x41: {
        if (sp < 2) return 2;
        const a = D[sp - 1], v = D[sp - 2];
        if (a < 0 || a > 255) return 6;
        sp -= 2; M[a] = v;
        break;
      }
      case 0x50: {
        if (sp < 1) return 2;
        const s = String(D[sp - 1]);
        if (OL + s.length > 65536) return 11;
        for (let i = 0; i < s.length; i++) OUT[OL++] = s.charCodeAt(i);
        sp--;
        break;
      }
      case 0x51:
        if (sp < 1) return 2;
        if (OL >= 65536) return 11;
        OUT[OL++] = D[--sp] & 255;
        break;
      case 0x52:
        if (sp >= 256) return 3;
        D[sp++] = ip < inp.length ? inp[ip++] : -1;
        break;
      case 0x53:
        if (sp < 1) return 2;
        return D[--sp] & 255;
      default:
        return 5;
    }
  }
}
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
for (const id of readdirSync(I).sort()) {
  const code = run(readFileSync(join(I, id, 'program.bin')), readFileSync(join(I, id, 'input.bin')));
  mkdirSync(join(O, id), { recursive: true });
  writeFileSync(join(O, id, 'stdout.bin'), OUT.subarray(0, OL));
  writeFileSync(join(O, id, 'exit.txt'), code + '\n');
}
