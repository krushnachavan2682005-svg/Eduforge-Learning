const S3_FOLDER = {
  COURSR_FOLDER: (client_id: string, id: string) =>
    `lms/client/${client_id}/cource/${id}/image`,
  
};

export default S3_FOLDER;
