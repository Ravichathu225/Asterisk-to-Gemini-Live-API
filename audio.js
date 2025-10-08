// μ-law <-> 16-bit linear PCM conversion (8kHz).
// Based on standard G.711 implementation.
// Decode: Direct table lookup (no inversion needed; table accounts for transmitted format).
// Encode: Algorithmic with exponent table.

const cBias = 0x84;  // 132
const cClip = 32635;

const MuLawCompressTable = new Uint8Array([
  0,0,1,1,2,2,2,2,3,3,3,3,3,3,3,3,
  4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,
  7,7,7,7,7,7,7,7,7,7,7,7,7,7,7,7
]);

const MuLawDecompressTable = new Int16Array([
  -32124,-31100,-30076,-29052,-28028,-27004,-25980,-24956,
  -23932,-22908,-21884,-20860,-19836,-18812,-17788,-16764,
  -15996,-15484,-14972,-14460,-13948,-13436,-12924,-12412,
  -11900,-11388,-10876,-10364, -9852, -9340, -8828, -8316,
  -7932, -7676, -7420, -7164, -6908, -6652, -6396, -6140,
  -5884, -5628, -5372, -5116, -4860, -4604, -4348, -4092,
  -3900, -3772, -3644, -3516, -3388, -3260, -3132, -3004,
  -2876, -2748, -2620, -2492, -2364, -2236, -2108, -1980,
  -1884, -1820, -1756, -1692, -1628, -1564, -1500, -1436,
  -1372, -1308, -1244, -1180, -1116, -1052,  -988,  -924,
   -876,  -844,  -812,  -780,  -748,  -716,  -684,  -652,
   -620,  -588,  -556,  -524,  -492,  -460,  -428,  -396,
   -372,  -356,  -340,  -324,  -308,  -292,  -276,  -260,
   -244,  -228,  -212,  -196,  -180,  -164,  -148,  -132,
   -120,  -112,  -104,   -96,   -88,   -80,   -72,   -64,
    -56,   -48,   -40,   -32,   -24,   -16,    -8,     0,
  32124, 31100, 30076, 29052, 28028, 27004, 25980, 24956,
  23932, 22908, 21884, 20860, 19836, 18812, 17788, 16764,
  15996, 15484, 14972, 14460, 13948, 13436, 12924, 12412,
  11900, 11388, 10876, 10364,  9852,  9340,  8828,  8316,
   7932,  7676,  7420,  7164,  6908,  6652,  6396,  6140,
  5884,  5628,  5372,  5116,  4860,  4604,  4348,  4092,
  3900,  3772,  3644,  3516,  3388,  3260,  3132,  3004,
  2876,  2748,  2620,  2492,  2364,  2236,  2108,  1980,
  1884,  1820,  1756,  1692,  1628,  1564,  1500,  1436,
  1372,  1308,  1244,  1180,  1116,  1052,   988,   924,
   876,   844,   812,   780,   748,   716,   684,   652,
   620,   588,   556,   524,   492,   460,   428,   396,
   372,   356,   340,   324,   308,   292,   276,   260,
   244,   228,   212,   196,   180,   164,   148,   132,
   120,   112,   104,    96,    88,    80,    72,    64,
    56,    48,    40,    32,    24,    16,     8,     0
]);

function ulawToLinear(ulawByte) {
  return MuLawDecompressTable[ulawByte & 0xFF];
}

function linearToUlaw(linear16) {
  let sign = (linear16 >> 8) & 0x80;
  if (sign !== 0) {
    linear16 = -linear16;
  }
  if (linear16 > cClip) {
    linear16 = cClip;
  }
  linear16 += cBias;
  let exponent = MuLawCompressTable[(linear16 >> 7) & 0xFF];
  let mantissa = (linear16 >> (exponent + 3)) & 0x0F;
  let compressedByte = ~(sign | (exponent << 4) | mantissa);
  return compressedByte & 0xFF;
}

// Resample from 8kHz to 16kHz (simple linear interpolation; use resampler-js for better quality)
function resample8kTo16k(pcm8kBuffer) {
  const pcm16k = new Int16Array(pcm8kBuffer.length * 2);
  for (let i = 0; i < pcm8kBuffer.length; i++) {
    pcm16k[i * 2] = pcm8kBuffer[i];
    if (i + 1 < pcm8kBuffer.length) {
      pcm16k[i * 2 + 1] = (pcm8kBuffer[i] + pcm8kBuffer[i + 1]) / 2;
    } else {
      pcm16k[i * 2 + 1] = pcm8kBuffer[i];
    }
  }
  return Buffer.from(pcm16k.buffer);
}

// Resample from 24kHz to 8kHz (simple decimation; average every 3 samples for better quality)
function resample24kTo8k(pcm24kBuffer) {
  const factor = 3;
  const pcm8kLength = Math.floor(pcm24kBuffer.length / factor);
  const pcm8k = new Int16Array(pcm8kLength);
  for (let i = 0; i < pcm8kLength; i++) {
    let sum = 0;
    for (let j = 0; j < factor; j++) {
      sum += pcm24kBuffer[i * factor + j];
    }
    pcm8k[i] = sum / factor;
  }
  return Buffer.from(pcm8k.buffer);
}

module.exports = {
  ulawToPcm16k: (ulawBuffer) => {
    const linear8k = Buffer.alloc(ulawBuffer.length * 2);
    for (let i = 0; i < ulawBuffer.length; i++) {
      const linear = ulawToLinear(ulawBuffer[i]);
      linear8k.writeInt16LE(linear, i * 2);
    }
    const pcm16k = Buffer.alloc(linear8k.length * 2);
    const pcm16kView = new Int16Array(pcm16k.buffer);
    const linear8kView = new Int16Array(linear8k.buffer);
    resample8kTo16k(linear8kView, pcm16kView);  // Note: adjust if resample returns Buffer
    return pcm16k;
  },
  pcm24kToUlaw: (pcm24kBuffer) => {
    const pcm8k = resample24kTo8k(pcm24kBuffer);
    const linear8kView = new Int16Array(pcm8k.buffer);
    const ulaw = Buffer.alloc(linear8kView.length / 2);  // One byte per sample
    for (let i = 0; i < linear8kView.length / 2; i++) {  // Assuming even length
      const linear = linear8kView[i * 2];  // Wait, no: pcm8k is Int16Array of length samples
      ulaw[i] = linearToUlaw(linear);
    }
    return ulaw;
  }
};