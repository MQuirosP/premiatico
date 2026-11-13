import multer from 'multer';
import { ValidationError } from '../core/errors.js';

export function createMemoryUpload(options: {
  maxFileSizeBytes: number;
  allowedMimeTypes: ReadonlySet<string>;
  invalidMimeMessage: string;
}) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: options.maxFileSizeBytes },
    fileFilter: (_req, file, cb) => {
      if (!options.allowedMimeTypes.has(file.mimetype)) {
        cb(new ValidationError(options.invalidMimeMessage));
        return;
      }
      cb(null, true);
    },
  });
}
