package com.example.simplerag.config;

import java.time.Duration;

import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** 可选重排 API；没有显式凭据时保持 RRF 顺序。 */
@Validated
@ConfigurationProperties("rag.rerank")
public record RerankProperties(String baseUrl, String apiKey, String model, @NotNull Duration timeout) {
    public boolean configured() {
        return baseUrl != null && !baseUrl.isBlank() && apiKey != null && !apiKey.isBlank()
                && model != null && !model.isBlank();
    }
}
