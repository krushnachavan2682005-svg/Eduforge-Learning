import { Multipart, MultipartFile, MultipartValue } from "@fastify/multipart";
import { ALLOWED_MIME_TYPES } from "../constants/mimeType";
import { FastifyRequest } from "fastify";

interface UploadOptions {
  folder: string;
  maxSize?: number;
  allowedTypes?: string[];
}

export const handleFileUpload = async (
  req: FastifyRequest,
  options: UploadOptions,
) => {
  const data = await req.file();
  console.log("data", data);

  if (!data) {
    return {
      status: 400,
      body: {
        success: false,
        message: "No file uploaded",
      },
    };
  }

  const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;
  if (!allowedTypes.includes(data.mimetype)) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Invalid file type",
      },
    };
  }

  const buffer = await data.toBuffer();
  const maxSize = options.maxSize ?? 5 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return {
      status: 400,
      body: {
        success: false,
        message: "File size too large. Max allowed is 5MB.",
      },
    };
  }

  const result = await (req.server as any).s3Upload(
    {
      filename: data.filename,
      file: buffer,
      mimetype: data.mimetype,
      originalname: data.filename,
    },
    options.folder,
  );

  const presignedUrl = await (req.server as any).s3Presign(result.key, 3600);

  return {
    status: 200,
    body: {
      success: true,
      message: "File uploaded successfully",
      data: {
        url: presignedUrl,
        key: result.key,
        filename: data.filename,
        mimetype: data.mimetype,
      },
    },
  };
};

export const handleFormDataFileUpload = async (
  file: MultipartFile,
  req: FastifyRequest,
  options: UploadOptions,
) => {
  if (!file) {
    return {
      status: 400,
      body: {
        success: false,
        message: "No file uploaded",
      },
    };
  }

  const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;
  if (!allowedTypes.includes(file.mimetype)) {
    return {
      status: 400,
      body: {
        success: false,
        message: "Invalid file type",
      },
    };
  }

  const buffer = await file.toBuffer();
  const maxSize = options.maxSize ?? 5 * 1024 * 1024;
  if (buffer.length > maxSize) {
    return {
      status: 400,
      body: {
        success: false,
        message: "File size too large. Max allowed is 5MB.",
      },
    };
  }

  const result = await (req.server as any).s3Upload(
    {
      filename: file.filename,
      file: buffer,
      mimetype: file.mimetype,
      originalname: file.filename,
    },
    options.folder,
  );

  const presignedUrl = await (req.server as any).s3Presign(result.key, 3600);

  return {
    status: 200,
    body: {
      success: true,
      message: "File uploaded successfully",
      data: {
        url: presignedUrl,
        key: result.key,
        filename: file.filename,
        mimetype: file.mimetype,
        file: buffer,
      },
    },
  };
};

export const handleMultipleFileUpload = async (
  req: FastifyRequest,
  options: UploadOptions,
) => {
  const parts = req.parts();
  const allowedTypes = options.allowedTypes || ALLOWED_MIME_TYPES;
  const maxSize = options.maxSize ?? 5 * 1024 * 1024;

  const uploadedFiles: any[] = [];
  let fileFound = false;

  for await (const part of parts) {
    // ✅ Only handle FILE parts
    if (part.type === "file") {
      const file = part as MultipartFile;
      fileFound = true;

      if (!allowedTypes.includes(file.mimetype)) {
        return {
          status: 400,
          body: {
            success: false,
            message: `Invalid file type for ${file.filename}`,
          },
        };
      }

      const buffer = await file.toBuffer();

      if (buffer.length > maxSize) {
        return {
          status: 400,
          body: {
            success: false,
            message: `File size too large for ${file.filename}. Max allowed is 5MB.`,
          },
        };
      }

      const result = await (req.server as any).s3Upload(
        {
          filename: file.filename,
          file: buffer,
          mimetype: file.mimetype,
        },
        options.folder,
      );

      const url = await (req.server as any).s3Presign(result.key, 3600);

      uploadedFiles.push({
        url,
        key: result.key,
        filename: file.filename,
        mimetype: file.mimetype,
      });
    }
  }

  if (!fileFound) {
    return {
      status: 400,
      body: { success: false, message: "No files uploaded" },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      message: "Files uploaded successfully",
      data: uploadedFiles,
    },
  };
};
