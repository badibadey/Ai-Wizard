declare module 'formidable' {
    import { IncomingMessage } from 'http';
    
    export class IncomingForm {
      parse(req: IncomingMessage, callback: (err: any, fields: any, files: any) => void): void;
    }
    
    export interface File {
      filepath: string;
      originalFilename: string;
      mimetype: string;
    }
  }