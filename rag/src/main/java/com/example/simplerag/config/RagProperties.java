package com.example.simplerag.config;

import java.time.Duration;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 切分、批量和同步入库的限制；汉字计 1，其余每 4 个 Unicode 码点计 1。 */
@Validated
@ConfigurationProperties(prefix = "rag")
public record RagProperties(
        @Min(16) @Max(2000) int chunkSize,
        @Min(0) @Max(1999) int chunkOverlap,
        @Min(1) @Max(100) int embeddingBatchSize,
        @Min(1) @Max(2000) int maxChunks,
        @Min(1) @Max(2_000_000) int maxTextCharacters,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout) {
}
