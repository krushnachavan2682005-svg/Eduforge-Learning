import fp from "fastify-plugin";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ObjectCannedACL,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

const mimeMap: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function getExtension(filename: string) {
  return (filename.split(".").pop() ?? "").toLowerCase();
}

function guessMime(filename: string, fallback = "application/octet-stream") {
  return mimeMap[getExtension(filename)] || fallback;
}

export interface S3PluginOptions {
  bucketName: string;
  region?: string;
}

declare module "fastify" {
  interface FastifyInstance {
    s3Upload: (
      file: any,
      folder: string
    ) => Promise<{ key: string; url: string }>;
    s3UploadBuffer: (
      buffer: Buffer,
      path: string,
      options?: any
    ) => Promise<{ key: string; url: string }>;
    s3Presign: (
      key: string,
      expiresIn?: number,
      download?: boolean
    ) => Promise<string>;
    s3Delete: (key: string) => Promise<void>;
    s3DeleteMany: (keys: string[]) => Promise<void>;
    s3Url: (key: string) => string;
  }
}

export default fp<S3PluginOptions>(async (fastify, opts) => {
  const bucketName = opts.bucketName;
  const region = opts.region || "ap-south-1";

  const s3 = new S3Client({
    region,
    forcePathStyle: false,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
    },
  });

  fastify.decorate("s3Upload", async (file: any, folder: string) => {
    if (!file) throw new Error("No file provided");

    const extension = getExtension(file.filename || file.originalname || "");
    const filename = `${randomUUID()}.${extension || "bin"}`;
    const key = `${folder}/${filename}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.file,
        ContentType: file.mimetype || guessMime(filename),
        ACL: ObjectCannedACL.public_read,
      })
    );

    const url = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
    return { key, url };
  });

  fastify.decorate(
    "s3UploadBuffer",
    async (buffer: Buffer, path: string, options: any = {}) => {
      if (!buffer) throw new Error("No buffer provided");
      if (!path) throw new Error("No file path provided");

      const { contentType = guessMime(path) } = options;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: path,
          Body: buffer,
          ContentType: contentType,
        })
      );

      const url = `https://${bucketName}.s3.${region}.amazonaws.com/${path}`;
      return { key: path, url };
    }
  );

  fastify.decorate("s3Url", (key: string) => {
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  });

  fastify.decorate(
    "s3Presign",
    async (key: string, expiresIn = 3600, download = false) => {
      const fileName = encodeURIComponent(key.split("/").pop() || "file");
      const disposition = download
        ? `attachment; filename="${fileName}"`
        : `inline; filename="${fileName}"`;

      const command = new GetObjectCommand({
        Bucket: bucketName,
        Key: key,
        ResponseContentDisposition: disposition,
      });

      const signedUrl = await getSignedUrl(s3, command, { expiresIn });
      return signedUrl;
    }
  );

  fastify.decorate("s3Delete", async (key: string) => {
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: key }));
  });

  fastify.decorate("s3DeleteMany", async (keys: string[]) => {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: bucketName,
        Delete: { Objects: keys.map((Key) => ({ Key })) },
      })
    );
  });
});
