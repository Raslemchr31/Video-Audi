
import React, { useState } from 'react';
import { 
  Upload, 
  Download, 
  Music, 
  FileVideo, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { AppStatus, ExtractionState } from './types';
import { processVideoToMp3 } from './services/mp3Encoder';

const App: React.FC = () => {
  const [state, setState] = useState<ExtractionState>({
    status: AppStatus.IDLE,
    progress: 0
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState({ status: AppStatus.DECODING, progress: 0, fileName: file.name });

    try {
      const result = await processVideoToMp3(file, (stage, progress) => {
        setState(prev => ({
          ...prev,
          status: stage === 'DECODING' ? AppStatus.DECODING : AppStatus.ENCODING,
          progress
        }));
      });

      const url = URL.createObjectURL(result.blob);
      setState({
        status: AppStatus.SUCCESS,
        progress: 100,
        mp3Url: url,
        fileName: result.fileName
      });
    } catch (err) {
      console.error(err);
      setState({
        status: AppStatus.ERROR,
        progress: 0,
        error: "Could not process this video. Ensure it's a valid video file."
      });
    }
  };

  const reset = () => {
    if (state.mp3Url) URL.revokeObjectURL(state.mp3Url);
    setState({ status: AppStatus.IDLE, progress: 0 });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center p-4 bg-indigo-500/10 rounded-3xl mb-6">
          <Music className="w-10 h-10 text-indigo-400" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">
          Video<span className="gradient-text">ToMP3</span>
        </h1>
        <p className="text-slate-400">Simple. Local. High-Quality.</p>
      </div>

      <main className="w-full max-w-xl">
        {state.status === AppStatus.IDLE && (
          <label className="group relative flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-slate-800 rounded-[2.5rem] cursor-pointer hover:border-indigo-500/50 hover:bg-slate-900/40 transition-all duration-500 glass">
            <div className="flex flex-col items-center text-center px-6">
              <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                <Upload className="w-8 h-8 text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload your video</h3>
              <p className="text-slate-500 text-sm">Drag and drop or click to browse</p>
            </div>
            <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
          </label>
        )}

        {(state.status === AppStatus.DECODING || state.status === AppStatus.ENCODING) && (
          <div className="glass rounded-[2.5rem] p-10 text-center space-y-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative inline-flex">
              <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
              <Loader2 className="w-16 h-16 text-indigo-400 animate-spin relative" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold capitalize">
                {state.status.toLowerCase()}...
              </h3>
              <p className="text-slate-400 text-sm truncate max-w-xs mx-auto">
                {state.fileName}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-slate-500 uppercase tracking-widest">
                <span>Progress</span>
                <span>{state.progress}%</span>
              </div>
              <div className="h-3 w-full bg-slate-800/50 rounded-full overflow-hidden p-0.5">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 progress-glow"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
            </div>
            
            <p className="text-xs text-slate-500 italic">
              Don't close the tab. Processing is happening locally.
            </p>
          </div>
        )}

        {state.status === AppStatus.SUCCESS && (
          <div className="glass rounded-[2.5rem] p-10 space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-xl font-bold truncate">Extraction Ready</h3>
                <p className="text-slate-400 text-sm truncate">{state.fileName}</p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <a 
                href={state.mp3Url} 
                download={state.fileName}
                className="flex items-center justify-center gap-3 bg-white text-[#020617] font-bold py-5 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5 text-lg"
              >
                <Download className="w-6 h-6" />
                Download MP3
              </a>
              
              <button 
                onClick={reset}
                className="flex items-center justify-center gap-2 text-slate-400 hover:text-white font-medium py-3 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Start over
              </button>
            </div>
          </div>
        )}

        {state.status === AppStatus.ERROR && (
          <div className="glass border-red-500/20 rounded-[2.5rem] p-10 text-center space-y-6">
            <div className="inline-flex p-4 bg-red-500/10 rounded-full">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-red-400">Something went wrong</h3>
            <p className="text-slate-400">{state.error}</p>
            <button 
              onClick={reset}
              className="w-full bg-slate-800 py-4 rounded-2xl font-bold hover:bg-slate-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </main>

      <footer className="mt-12 text-slate-600 text-xs">
        Native Audio Processing • No Servers Involved
      </footer>
    </div>
  );
};

export default App;
