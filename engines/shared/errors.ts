export type ToolErrorCode =
  | 'INVALID_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE'
  | 'PROCESSING_FAILED'
  | 'BROWSER_MEMORY_ERROR'
  | 'PDF_READ_ERROR'
  | 'PASSWORD_PROTECTED'
  | 'UNKNOWN_ERROR';

export class ToolError extends Error {
  public readonly code: ToolErrorCode;
  public readonly humanMessage: string;

  constructor(code: ToolErrorCode, customMessage?: string) {
    const humanMessage = customMessage || ERROR_MESSAGES[code];
    super(humanMessage);
    this.name = 'ToolError';
    this.code = code;
    this.humanMessage = humanMessage;
  }
}

export const ERROR_MESSAGES: Record<ToolErrorCode, string> = {
  INVALID_FILE: 'This file is not a valid JPEG image.',
  UNSUPPORTED_FORMAT: 'Only JPG and JPEG files are supported.',
  FILE_TOO_LARGE: 'This file is too large. Maximum size is 50 MB.',
  PROCESSING_FAILED: "We couldn't convert this image. Please try again.",
  BROWSER_MEMORY_ERROR: 'This image is too large for your browser to process.',
  PDF_READ_ERROR: 'Unable to parse the PDF document. The file may be password-protected or corrupted.',
  PASSWORD_PROTECTED: 'This PDF is password-protected. Please provide an unlocked PDF.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',
};

export function getHumanErrorMessage(errorOrCode: ToolErrorCode | unknown): string {
  if (typeof errorOrCode === 'string' && errorOrCode in ERROR_MESSAGES) {
    return ERROR_MESSAGES[errorOrCode as ToolErrorCode];
  }
  if (errorOrCode instanceof ToolError) {
    return errorOrCode.message || ERROR_MESSAGES[errorOrCode.code] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }
  if (errorOrCode instanceof Error) {
    return errorOrCode.message || ERROR_MESSAGES.UNKNOWN_ERROR;
  }
  return ERROR_MESSAGES.UNKNOWN_ERROR;
}
