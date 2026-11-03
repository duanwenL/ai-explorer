package com.example.simplerag.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Qdrant 的 HTTP 命名向量、BM25 和 RRF 配置；凭据只留在服务端。 */
@Validated
@ConfigurationProperties("rag.qdrant")
public record QdrantProperties(
        @NotBlank @Pattern(regexp = "https?://.+") String url,
        String apiKey,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9][A-Za-z0-9_.-]{0,200}") String collectionName,
        @Min(1) @Max(65536) int dimensions) {
}
