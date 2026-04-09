import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
// @ts-ignore
import lamejs from "lamejs";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pcmToMp3(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob {
  const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128); // 128kbps
  const mp3Data: Int8Array[] = [];
  
  // Convert Uint8Array to Int16Array
  const int16Data = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength / 2);
  
  const sampleBlockSize = 1152;
  
  for (let i = 0; i < int16Data.length; i += sampleBlockSize) {
    const sampleChunk = int16Data.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }
  }
  
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(mp3buf);
  }
  
  return new Blob(mp3Data, { type: 'audio/mp3' });
}

export function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (v: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      v.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const pcmView = new Uint8Array(buffer, 44);
  pcmView.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}
