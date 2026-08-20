import { FastifyInstance } from "fastify";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

class UploadService {
  async uploadFile(fastify: FastifyInstance, file: any, folder?: string) {
    if (!file) throw new Error("No file provided");

    // const env = process.env.NODE_ENV || "development";

    const folderName = folder ? `lms/${folder}` : `lms`;

    const originalName = file.filename || "file.bin";
    const ext = originalName.includes(".")
      ? originalName.split(".").pop()
      : "bin";

    const uniqueName = `${randomUUID()}.${ext}`;
    const key = `${folderName}/${originalName.split(".")[0]}/${uniqueName}`;

    const chunks: Buffer[] = [];
    for await (const chunk of file.file as Readable) {
      chunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(chunks);
    await fastify.s3UploadBuffer(fileBuffer, key, {
      ContentType: file.mimetype,
    });

    const cleanUrl = fastify.s3Url(key);
    const presignedUrl = await fastify.s3Presign(key, 3600, false);

    return {
      message: "File uploaded successfully",
      data: {
        key,
        url: cleanUrl,
        presignedUrl: presignedUrl,
      },
    };
  }

  async generatePresignedUrl(
    fastify: FastifyInstance,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    return fastify.s3Presign(key, expiresIn, false);
  }
}

export default new UploadService();
