
/**
 * This service uses the native Web Audio API to decode video audio
 * and a Blob-based Worker to encode to MP3 using lamejs.
 * This avoids all Cross-Origin/Worker issues.
 */

export const processVideoToMp3 = async (
  file: File,
  onProgress: (status: 'DECODING' | 'ENCODING', progress: number) => void
): Promise<{ blob: Blob; fileName: string }> => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // 1. Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // 2. Decode Audio
  onProgress('DECODING', 0);
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  
  // 3. Prepare Worker Code as a String (Self-contained)
  const workerCode = `
    importScripts('https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js');
    
    self.onmessage = function(e) {
      const { channels, sampleRate, leftPcm, rightPcm } = e.data;
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 192);
      const mp3Data = [];
      
      const sampleBlockSize = 1152;
      const length = leftPcm.length;
      
      for (let i = 0; i < length; i += sampleBlockSize) {
        const leftChunk = leftPcm.subarray(i, i + sampleBlockSize);
        let mp3buf;
        
        if (channels === 2) {
          const rightChunk = rightPcm.subarray(i, i + sampleBlockSize);
          mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        } else {
          mp3buf = mp3encoder.encodeBuffer(leftChunk);
        }
        
        if (mp3buf.length > 0) {
          mp3Data.push(new Int8Array(mp3buf));
        }
        
        self.postMessage({ type: 'PROGRESS', progress: Math.round((i / length) * 100) });
      }
      
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
      
      self.postMessage({ type: 'COMPLETE', data: mp3Data });
    };
  `;

  // 4. Run Encoding in Worker
  return new Promise((resolve, reject) => {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const worker = new Worker(URL.createObjectURL(blob));
    
    // Prepare PCM data for lamejs (Float32 to Int16)
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    
    const toInt16 = (float32Array: Float32Array) => {
      const int16 = new Int16Array(float32Array.length);
      for (let i = 0; i < float32Array.length; i++) {
        const s = Math.max(-1, Math.min(1, float32Array[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return int16;
    };

    onProgress('ENCODING', 0);
    
    worker.onmessage = (e) => {
      if (e.data.type === 'PROGRESS') {
        onProgress('ENCODING', e.data.progress);
      } else if (e.data.type === 'COMPLETE') {
        const finalBlob = new Blob(e.data.data, { type: 'audio/mp3' });
        const name = file.name.replace(/\.[^/.]+$/, "") + ".mp3";
        worker.terminate();
        resolve({ blob: finalBlob, fileName: name });
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    const leftPcm = toInt16(audioBuffer.getChannelData(0));
    const rightPcm = channels > 1 ? toInt16(audioBuffer.getChannelData(1)) : null;

    worker.postMessage({
      channels,
      sampleRate,
      leftPcm,
      rightPcm
    }, [leftPcm.buffer, ...(rightPcm ? [rightPcm.buffer] : [])]);
  });
};
