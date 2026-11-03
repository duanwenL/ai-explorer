package com.example.simplerag.service;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

import com.example.simplerag.api.OriginalDocumentResponse;
import com.example.simplerag.api.RagException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;

/** 单独保存切分前全文，不能用有重叠的检索片段反向拼接。 */
public class FullDocumentStore {
    private static final Logger log = LoggerFactory.getLogger(FullDocumentStore.class);
    private final Path directory;
    private final ObjectMapper mapper;

    public FullDocumentStore(Path directory, ObjectMapper mapper) {
        this.directory = directory.toAbsolutePath().normalize();
        this.mapper = mapper;
    }

    public void save(long documentId, DocumentTextReader.ParsedDocument document) {
        Path temporary = null;
        try {
            Files.createDirectories(directory);
            Path target = directory.resolve(documentId + ".json");
            if (Files.exists(target)) throw new IOException("document ID already exists");
            temporary = Files.createTempFile(directory, documentId + "-", ".tmp");
            mapper.writeValue(temporary.toFile(), new OriginalDocumentResponse(Long.toString(documentId),
                    document.fileName(), document.text()));
            try {
                Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE);
            } catch (AtomicMoveNotSupportedException unsupported) {
                Files.move(temporary, target);
            }
        } catch (IOException exception) {
            log.warn("完整原文保存失败，documentId:{}，异常类型:{}", documentId, exception.getClass().getSimpleName());
            throw new RagException(HttpStatus.INTERNAL_SERVER_ERROR, "ORIGINAL_SAVE_FAILED",
                    "完整原文保存失败，尚未调用模型或写入向量；请检查本机原文数据目录权限和磁盘空间");
        } finally {
            if (temporary != null) {
                try {
                    Files.deleteIfExists(temporary);
                } catch (IOException exception) {
                    log.warn("原文临时文件清理失败，documentId:{}", documentId);
                }
            }
        }
    }

    public OriginalDocumentResponse read(String documentId) {
        try {
            if (documentId == null || !documentId.matches("[1-9][0-9]{0,18}")) throw new NumberFormatException();
            Long.parseLong(documentId);
        } catch (NumberFormatException invalid) {
            throw new RagException(HttpStatus.BAD_REQUEST, "INVALID_DOCUMENT_ID", "文档 ID 必须是有效的正整数");
        }
        try (var input = Files.newInputStream(directory.resolve(documentId + ".json"))) {
            var document = mapper.readValue(input, OriginalDocumentResponse.class);
            if (document == null || !documentId.equals(document.documentId()) || document.fileName() == null
                    || document.content() == null || document.content().isBlank()) throw new IOException("invalid original document");
            return document;
        } catch (NoSuchFileException missing) {
            throw new RagException(HttpStatus.NOT_FOUND, "ORIGINAL_NOT_FOUND",
                    "此文档未保存完整原文或原文已丢失，请重新上传后查看。旧文档的检索片段仍可使用。");
        } catch (IOException exception) {
            log.warn("完整原文读取失败，documentId:{}，异常类型:{}", documentId, exception.getClass().getSimpleName());
            throw new RagException(HttpStatus.INTERNAL_SERVER_ERROR, "ORIGINAL_READ_FAILED", "完整原文读取失败，请检查本机原文数据目录和文件状态");
        }
    }

    public void delete(long documentId) {
        try {
            Files.deleteIfExists(directory.resolve(documentId + ".json"));
        } catch (IOException exception) {
            log.warn("失败上传的完整原文清理失败，documentId:{}", documentId);
        }
    }
}
