package com.example.simplerag.service;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import com.example.simplerag.api.RagException;
import com.example.simplerag.api.OriginalDocumentResponse;
import com.example.simplerag.api.SearchQuery;
import com.example.simplerag.api.SearchResponse;
import com.example.simplerag.api.UploadResponse;
import com.example.simplerag.config.RagProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/** 上传与混合检索主链；此阶段只检索原文，不生成聊天答案。 */
@Service
public class RagService {
    private static final Logger log = LoggerFactory.getLogger(RagService.class);
    private static final double MIN_RERANK_SCORE = 0.5;
    private final DocumentTextReader textReader;
    private final MindPadTextSplitter textSplitter;
    private final TextEmbeddingClient embeddings;
    private final HybridQdrantStore store;
    private final RerankClient rerank;
    private final RagProperties properties;
    private final FullDocumentStore originals;

    public RagService(DocumentTextReader textReader, MindPadTextSplitter textSplitter, TextEmbeddingClient embeddings,
                      HybridQdrantStore store, RerankClient rerank, RagProperties properties, FullDocumentStore originals) {
        this.textReader = textReader;
        this.textSplitter = textSplitter;
        this.embeddings = embeddings;
        this.store = store;
        this.rerank = rerank;
        this.properties = properties;
        this.originals = originals;
    }

    public UploadResponse upload(MultipartFile file) {
        var parsed = textReader.read(file);
        boolean markdown = parsed.fileName().toLowerCase(java.util.Locale.ROOT).endsWith(".md");
        List<TextChunk> chunks = textSplitter.split(parsed.text(), markdown);
        if (chunks.isEmpty()) throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "NO_TEXT", "文件没有可检索的有效片段");
        if (chunks.size() > properties.maxChunks()) {
            throw new RagException(HttpStatus.PAYLOAD_TOO_LARGE, "TOO_MANY_CHUNKS", "文档切分后超过 " + properties.maxChunks() + " 个片段，请拆分文档后上传");
        }
        long documentId = UUID.randomUUID().getMostSignificantBits() & Long.MAX_VALUE;
        List<String> ids = chunks.stream().map(chunk -> PointIds.forChunk(documentId, 1, chunk.index())).toList();
        originals.save(documentId, parsed);
        List<HybridQdrantStore.IndexedChunk> points = new ArrayList<>();
        try {
            store.ensureCollection();
            for (int from = 0; from < chunks.size(); from += properties.embeddingBatchSize()) {
                int to = Math.min(from + properties.embeddingBatchSize(), chunks.size());
                List<TextChunk> batch = chunks.subList(from, to);
                var vectors = embeddings.embed(batch.stream().map(chunk -> chunk.embeddingInput(parsed.fileName())).toList());
                for (int index = from; index < to; index++) {
                    points.add(new HybridQdrantStore.IndexedChunk(ids.get(index), documentId, parsed.fileName(), chunks.get(index), vectors.get(index - from)));
                }
            }
        } catch (RuntimeException exception) {
            originals.delete(documentId);
            log.warn("文档向量准备失败，documentId:{}，异常类型:{}", documentId, exception.getClass().getSimpleName());
            throw new RagException(HttpStatus.BAD_GATEWAY, "UPLOAD_FAILED", "向量生成或集合校验失败，尚未写入片段；请检查模型 API、额度和 Qdrant");
        }
        try {
            store.add(points);
        } catch (RuntimeException writeFailure) {
            log.warn("文档入库失败，documentId:{}，异常类型:{}", documentId, writeFailure.getClass().getSimpleName());
            try {
                store.delete(ids);
                originals.delete(documentId);
            } catch (RuntimeException cleanupFailure) {
                log.error("文档残留清理失败，documentId:{}，异常类型:{}", documentId, cleanupFailure.getClass().getSimpleName());
                throw new RagException(HttpStatus.BAD_GATEWAY, "UPLOAD_CLEANUP_FAILED", "上传未完成且残留片段清理失败；请检查 Qdrant，本次文档 ID：" + documentId);
            }
            throw new RagException(HttpStatus.BAD_GATEWAY, "UPLOAD_FAILED", "向量入库失败，本次片段已执行清理；请检查 Qdrant");
        }
        log.info("文档入库完成，documentId:{}，chunkCount:{}", documentId, chunks.size());
        return new UploadResponse(Long.toString(documentId), parsed.fileName(), chunks.size());
    }

    public OriginalDocumentResponse original(String documentId) { return originals.read(documentId); }

    public SearchResponse search(SearchQuery request) {
        String query = request.query().strip();
        int topK = request.topK() == null ? SearchQuery.DEFAULT_TOP_K : request.topK();
        List<SearchResponse.Hit> hits;
        try {
            store.ensureCollection();
            float[] vector = embeddings.embed(List.of(query)).getFirst();
            hits = store.search(vector, query, topK * 4);
        } catch (RuntimeException exception) {
            log.warn("文档检索失败，异常类型:{}", exception.getClass().getSimpleName());
            throw new RagException(HttpStatus.BAD_GATEWAY, "SEARCH_FAILED", "检索失败，请检查模型 API、额度和 Qdrant");
        }
        var ranked = rerank.rerank(query, hits);
        var finalHits = ranked.hits().stream().filter(hit -> !ranked.applied() || hit.score() >= MIN_RERANK_SCORE).limit(topK).toList();
        String mode = ranked.applied() ? "rerank" : "rrf";
        if (ranked.fallback()) mode = "rrf_fallback";
        return new SearchResponse(query, finalHits, mode);
    }
}
