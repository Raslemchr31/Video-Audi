
export enum AppStatus {
  IDLE = 'IDLE',
  DECODING = 'DECODING',
  ENCODING = 'ENCODING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface ExtractionState {
  status: AppStatus;
  progress: number;
  error?: string;
  mp3Url?: string;
  fileName?: string;
}
