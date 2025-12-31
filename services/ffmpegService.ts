
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

/**
 * Loads FFmpeg once and returns the singleton instance.
 * Uses a promise to handle concurrent calls and ensure the instance is fully loaded.
 */
export const loadFFmpeg = async (): Promise<FFmpeg> => {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const instance = new FFmpeg();
      
      const CORE_VERSION = '0.12.6';
      const FFMPEG_VERSION = '0.12.15';
      
      const coreBaseURL = `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/esm`;
      const workerURL = `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`;
      
      console.debug('EchoExtract: Initializing FFmpeg with local blob URLs...');
      
      // We must convert these to blob URLs because workers cannot be loaded cross-origin
      // especially in strict environments like cloud sandboxes. 
      // This "blobs" the scripts so they appear to come from the current origin.
      const [coreURL, wasmURL, workerBlobURL] = await Promise.all([
        toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
        toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        toBlobURL(workerURL, 'text/javascript')
      ]);
      
      await instance.load({
        coreURL,
        wasmURL,
        workerURL: workerBlobURL,
      });

      ffmpegInstance = instance;
      console.debug('EchoExtract: FFmpeg engine ready.');
      return instance;
    } catch (error) {
      loadPromise = null; // Reset promise to allow retry on next attempt
      console.error('EchoExtract: Failed to load FFmpeg engine:', error);
      throw error;
    }
  })();

  return loadPromise;
};

export const extractAudio = async (
  videoFile: File,
  onProgress: (progress: number) => void
): Promise<Blob> => {
  // Wait for the singleton load to finish or return existing instance
  const instance = await loadFFmpeg();
  
  const progressHandler = ({ progress }: { progress: number }) => {
    // FFmpeg progress can sometimes be slightly off 0.0-1.0 range
    const p = Math.min(100, Math.max(0, Math.round(progress * 100)));
    onProgress(p);
  };
  
  instance.on('progress', progressHandler);

  // Use a generic safe name for the internal filesystem to avoid filename issues
  const extension = videoFile.name.split('.').pop() || 'mp4';
  const inputName = `input.${extension}`;
  const outputName = 'output.mp3';

  try {
    console.debug('EchoExtract: Transferring file to virtual filesystem...');
    const fileData = await fetchFile(videoFile);
    await instance.writeFile(inputName, fileData);
    
    console.debug('EchoExtract: Running extraction command...');
    // Parameters:
    // -i: input file
    // -vn: disable video processing
    // -ab 192k: high quality audio bitrate
    // -ar 44100: standard sample rate
    // -f mp3: force mp3 output format
    await instance.exec([
      '-i', inputName, 
      '-vn', 
      '-ab', '192k', 
      '-ar', '44100', 
      '-f', 'mp3', 
      outputName
    ]);

    const data = await instance.readFile(outputName);
    const blob = new Blob([data as Uint8Array], { type: 'audio/mp3' });
    
    console.debug('EchoExtract: Extraction success. Cleaning up...');
    
    // Cleanup virtual files to save memory
    await instance.deleteFile(inputName);
    await instance.deleteFile(outputName);

    return blob;
  } catch (err) {
    console.error('EchoExtract: FFmpeg processing error:', err);
    throw new Error(`Extraction failed: ${err instanceof Error ? err.message : 'Unknown processing error'}`);
  } finally {
    // Always remove the listener to avoid memory leaks or duplicate events
    instance.off('progress', progressHandler);
  }
};
