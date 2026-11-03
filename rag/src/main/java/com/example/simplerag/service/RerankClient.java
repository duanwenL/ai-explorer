package com.example.simplerag.service;

import java.util.ArrayList;
import java.util.List;

import com.example.simplerag.api.SearchResponse;
import com.example.simplerag.config.RerankProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/** 可选 /rerank，失败保留 RRF 并返回真实状态。 */
@Component
public class RerankClient {
    private static final Logger log = LoggerFactory.getLogger(RerankClient.class);
    private final RerankProperties properties;
    private final ObjectMapper mapper;
    private final RestClient http;

    public RerankClient(RerankProperties properties, ObjectMapper mapper, RestClient.Builder builder) {
        this.properties = properties;
        this.mapper = mapper;
        if (properties.timeout().isZero() || properties.timeout().isNegative()) throw new IllegalArgumentException("重排超时必须大于 0");
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(java.time.Duration.ofSeconds(5));
        factory.setReadTimeout(properties.timeout());
        this.http = builder.clone().requestFactory(factory).build();
    }

    public Outcome rerank(String query, List<SearchResponse.Hit> hits) {
        if (!properties.configured() || hits.isEmpty()) return new Outcome(hits, false, false);
        var body = mapper.createObjectNode().put("model", properties.model()).put("query", query).put("top_n", hits.size());
        var documents = body.putArray("documents");
        for (var hit : hits) {
            String text = hit.content();
            documents.add(text.isEmpty() ? " " : text.substring(0, Math.min(text.length(), 1800)));
        }
        try {
            String endpoint = properties.baseUrl().replaceAll("/+$", "") + "/rerank";
            JsonNode root = http.post().uri(endpoint).header("Authorization", "Bearer " + properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
            JsonNode results = root == null ? null : root.path("results");
            if (results == null || !results.isArray()) results = root == null ? null : root.path("data");
            if (results == null || !results.isArray() || results.isEmpty()) return fallback(hits);
            List<SearchResponse.Hit> ordered = new ArrayList<>();
            boolean[] used = new boolean[hits.size()];
            for (JsonNode item : results) {
                int index = item.path("index").asInt(-1);
                double score = item.has("relevance_score") ? item.path("relevance_score").asDouble(Double.NaN) : item.path("score").asDouble(Double.NaN);
                if (!item.path("index").isIntegralNumber() || !item.path("index").canConvertToInt()
                        || index < 0 || index >= hits.size() || used[index] || !Double.isFinite(score)) continue;
                used[index] = true;
                ordered.add(hits.get(index).reranked(score));
            }
            if (ordered.isEmpty()) return fallback(hits);
            for (int index = 0; index < hits.size(); index++) {
                if (!used[index]) ordered.add(hits.get(index));
            }
            return new Outcome(List.copyOf(ordered), true, false);
        } catch (RuntimeException exception) {
            log.warn("重排未生效，保留 RRF 顺序，异常类型:{}", exception.getClass().getSimpleName());
            return new Outcome(hits, false, true);
        }
    }

    private Outcome fallback(List<SearchResponse.Hit> hits) {
        log.warn("重排响应不可用，保留 RRF 顺序");
        return new Outcome(hits, false, true);
    }

    public record Outcome(List<SearchResponse.Hit> hits, boolean applied, boolean fallback) { }
}
