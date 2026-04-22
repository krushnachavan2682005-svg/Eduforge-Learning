export const IMAGE_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
  ];

  export const VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/x-matroska',
    'video/avi',
  ];

  export const DOCUMENT_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  export const EXCEL_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];

  export const ALLOWED_MIME_TYPES = [
    ...IMAGE_MIME_TYPES,
    ...VIDEO_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
    ...EXCEL_MIME_TYPES
  ];

 