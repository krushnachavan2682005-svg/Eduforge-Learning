const S3_FOLDER = {
  COURSR_FOLDER: (organization_id: string, id: string) =>
    `lms/client/${organization_id}/cource/${id}/image`,
  
};

export default S3_FOLDER;
