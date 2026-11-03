package com.example.simplerag.api;

import java.util.List;
import com.example.simplerag.config.RagProperties;
import com.example.simplerag.config.QdrantProperties;
import com.example.simplerag.config.RerankProperties;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 页面配置白名单，不能序列化整份 Environment 或暴露密钥。 */
@RestController
public class PageConfigurationController {
    private final RagProperties rag;
    private final MultipartProperties multipart;
    private final Environment environment;
    private final QdrantProperties qdrant;
    private final RerankProperties rerank;
    public PageConfigurationController(RagProperties rag, MultipartProperties multipart, Environment environment,
                                       QdrantProperties qdrant, RerankProperties rerank) {
        this.rag = rag;
        this.multipart = multipart;
        this.environment = environment;
        this.qdrant = qdrant;
        this.rerank = rerank;
    }

    @GetMapping("/api/config")
    public PageConfiguration configuration() {
        return new PageConfiguration(
                environment.getRequiredProperty("spring.ai.openai.embedding.options.model"),
                environment.getRequiredProperty("spring.ai.openai.embedding.options.dimensions", Integer.class),
                qdrant.collectionName(), rag.chunkSize(), rag.chunkOverlap(), rag.embeddingBatchSize(),
                multipart.getMaxFileSize().toBytes(), rag.maxChunks(), rag.maxTextCharacters(),
                SearchQuery.DEFAULT_TOP_K, SearchQuery.MAX_TOP_K,
                List.of("txt", "md", "docx", "pdf"), "dense_bm25_rrf", rerank.configured(), rerank.model());
    }

    public record PageConfiguration(String embeddingModel, int embeddingDimensions, String collectionName,
                                    int chunkSize, int chunkOverlap, int embeddingBatchSize, long maxFileBytes,
                                    int maxChunks, int maxTextCharacters, int defaultTopK, int maxTopK,
                                    List<String> supportedExtensions, String retrievalMode,
                                    boolean rerankConfigured, String rerankModel) {}
}
