export const uploadFileSchema = {
  consumes: ['multipart/form-data'],
  body: {
    type: 'object',
    required: ['form-data'],
    properties: {
      'form-data': {
        type: 'string',
        format: 'binary',
        description: 'File to upload'
      }
    }
  },
};
