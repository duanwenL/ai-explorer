package com.example.simplerag.api;

/** 所有片段都完成入库以后返回；同名文件重新上传也有独立 ID。 */
public record UploadResponse(String documentId, String fileName, int chunkCount) {}
