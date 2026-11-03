package com.example.simplerag.api;

/** 切分前完整提取文本；不含磁盘路径，不是片段拼接或原始排版。 */
public record OriginalDocumentResponse(String documentId, String fileName, String content) {}
