/**
 * File Provider Abstraction
 *
 * This interface defines how ACOMS.OS interacts with file storage.
 * The actual storage backend (SharePoint, S3, Azure Blob, local disk)
 * is hidden behind this interface so it can be swapped without
 * changing any other code.
 *
 * NOT IMPLEMENTED IN STAGE 1 — this is the placeholder architecture.
 * Stage 3 will implement the first real provider.
 */

export interface FileMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedById: string;
  // Which module/record this file belongs to
  module: string; // e.g. "employees", "assets", "plant"
  recordId: string;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  providerReference: string; // The provider's internal reference (e.g. SharePoint URL, S3 key)
}

export interface FileProvider {
  /**
   * Upload a file and associate it with a record.
   */
  upload(
    file: Buffer,
    fileName: string,
    module: string,
    recordId: string,
    uploadedById: string
  ): Promise<UploadResult>;

  /**
   * Download a file by its ID.
   */
  download(fileId: string): Promise<Buffer>;

  /**
   * List all files associated with a record.
   */
  listByRecord(module: string, recordId: string): Promise<FileMetadata[]>;

  /**
   * Delete a file by its ID.
   */
  delete(fileId: string): Promise<void>;
}
