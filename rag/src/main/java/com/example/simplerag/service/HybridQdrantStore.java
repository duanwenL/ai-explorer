package com.example.simplerag.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.example.simplerag.api.SearchResponse;
import com.example.simplerag.config.QdrantProperties;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/** 命名 dense + Qdrant 原生 BM25，RRF 在数据库执行；不覆盖不兼容集合。 */
@Component
public class HybridQdrantStore {
    private static final String KB_ID = "1";
    private static final TypeReference<Map<String, Object>> OBJECT_MAP = new TypeReference<>() { };
    private final QdrantProperties properties;
    private final ObjectMapper mapper;
    private final RestClient http;
    private boolean initialized;

    public HybridQdrantStore(QdrantProperties properties, ObjectMapper mapper, RestClient.Builder builder) {
        this.properties = properties;
        this.mapper = mapper;
        var client = builder.clone().baseUrl(properties.url());
        if (properties.apiKey() != null && !properties.apiKey().isBlank()) client.defaultHeader("api-key", properties.apiKey());
        this.http = client.build();
    }

    public synchronized void ensureCollection() {
        if (initialized) return;
        JsonNode schema;
        try {
            schema = http.get().uri(collectionPath()).retrieve().body(JsonNode.class);
        } catch (HttpClientErrorException.NotFound notFound) {
            ObjectNode body = mapper.createObjectNode();
            body.putObject("vectors").putObject("dense").put("size", properties.dimensions()).put("distance", "Cosine").put("on_disk", true);
            body.putObject("sparse_vectors").putObject("bm25").put("modifier", "idf");
            body.put("on_disk_payload", true);
            body.putObject("quantization_config").putObject("scalar").put("type", "int8").put("always_ram", true);
            body.putObject("hnsw_config").put("m", 16).put("ef_construct", 128);
            try {
                http.put().uri(collectionPath()).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().toBodilessEntity();
            } catch (HttpClientErrorException.Conflict conflict) {
                // 并发创建后只重新校验，不覆盖或删除数据。
            }
            schema = http.get().uri(collectionPath()).retrieve().body(JsonNode.class);
        }
        if (schema == null) throw new IllegalStateException("Qdrant collection 响应为空");
        JsonNode params = schema.path("result").path("config").path("params");
        JsonNode dense = params.path("vectors").path("dense");
        if (dense.path("size").asInt() != properties.dimensions() || !dense.path("distance").asText().equalsIgnoreCase("Cosine")
                || !params.path("sparse_vectors").path("bm25").path("modifier").asText().equals("idf")) {
            throw new IllegalStateException("Qdrant 集合不是当前模型维度的 dense/BM25 集合，请设置新的 QDRANT_COLLECTION");
        }
        for (String field : List.of("kb_id", "doc_id", "version")) {
            ObjectNode index = mapper.createObjectNode().put("field_name", field);
            if (field.equals("kb_id")) index.putObject("field_schema").put("type", "keyword").put("is_tenant", true);
            else index.put("field_schema", "integer");
            http.put().uri(collectionPath() + "/index?wait=true").contentType(MediaType.APPLICATION_JSON).body(index).retrieve().toBodilessEntity();
        }
        initialized = true;
    }

    public void add(List<IndexedChunk> chunks) {
        if (chunks.isEmpty()) return;
        ObjectNode body = mapper.createObjectNode();
        var points = body.putArray("points");
        for (IndexedChunk item : chunks) {
            validateVector(item.vector());
            TextChunk chunk = item.chunk();
            ObjectNode point = points.addObject().put("id", item.id());
            var vector = point.putObject("vector");
            vector.set("dense", mapper.valueToTree(item.vector()));
            vector.putObject("bm25").put("text", chunk.lexicalInput()).put("model", "qdrant/bm25");
            var payload = point.putObject("payload");
            payload.put("kb_id", KB_ID).put("doc_id", item.documentId()).put("version", 1).put("chunk_index", chunk.index())
                    .put("text", chunk.text()).put("heading_path", String.join(" > ", chunk.headingPath()))
                    .put("doc_name", item.fileName()).put("chunk_type", "text");
            payload.set("anchor", mapper.valueToTree(chunk.anchor()));
            payload.set("locator", mapper.valueToTree(chunk.locator()));
        }
        http.put().uri(collectionPath() + "/points?wait=true").contentType(MediaType.APPLICATION_JSON).body(body).retrieve().toBodilessEntity();
    }

    public void delete(List<String> ids) {
        if (ids.isEmpty()) return;
        http.post().uri(collectionPath() + "/points/delete?wait=true").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("points", ids)).retrieve().toBodilessEntity();
    }

    public List<SearchResponse.Hit> search(float[] queryVector, String query, int recall) {
        validateVector(queryVector);
        ObjectNode body = mapper.createObjectNode();
        var prefetch = body.putArray("prefetch");
        ObjectNode dense = prefetch.addObject().put("using", "dense").put("limit", recall);
        dense.set("query", mapper.valueToTree(queryVector));
        dense.set("filter", kbFilter());
        ObjectNode lexical = prefetch.addObject().put("using", "bm25").put("limit", recall);
        lexical.putObject("query").put("text", query).put("model", "qdrant/bm25");
        lexical.set("filter", kbFilter());
        body.putObject("query").put("fusion", "rrf");
        body.put("limit", recall).put("with_payload", true);
        body.set("filter", kbFilter());
        JsonNode response = http.post().uri(collectionPath() + "/points/query").contentType(MediaType.APPLICATION_JSON).body(body).retrieve().body(JsonNode.class);
        if (response == null || !response.path("result").path("points").isArray()) throw new IllegalStateException("Qdrant 检索响应缺少 points");
        List<SearchResponse.Hit> hits = new ArrayList<>();
        for (JsonNode point : response.path("result").path("points")) {
            JsonNode payload = point.path("payload");
            double score = point.path("score").asDouble(Double.NaN);
            if (!payload.path("text").isTextual() || !payload.path("chunk_index").canConvertToInt()
                    || payload.path("doc_id").isMissingNode() || !Double.isFinite(score)) throw new IllegalStateException("Qdrant 片段缺少来源/正文或分数非法");
            Map<String, Object> anchor = payload.path("anchor").isObject() ? mapper.convertValue(payload.path("anchor"), OBJECT_MAP) : Map.of();
            Map<String, Object> locator = payload.path("locator").isObject() ? mapper.convertValue(payload.path("locator"), OBJECT_MAP) : null;
            hits.add(new SearchResponse.Hit(point.path("id").asText(), payload.path("doc_id").asText(), payload.path("doc_name").asText(),
                    payload.path("chunk_index").asInt(), payload.path("text").asText(), score, score, "rrf", payload.path("heading_path").asText(), anchor, locator));
        }
        return List.copyOf(hits);
    }

    public void validateVector(float[] vector) {
        if (vector == null || vector.length != properties.dimensions()) throw new IllegalStateException("向量 API 返回维度与当前配置不一致");
        for (float value : vector) {
            if (!Float.isFinite(value)) throw new IllegalStateException("向量 API 返回非有限数值");
        }
    }

    private ObjectNode kbFilter() {
        ObjectNode filter = mapper.createObjectNode();
        filter.putArray("must").addObject().put("key", "kb_id").putObject("match").putArray("any").add(KB_ID);
        return filter;
    }

    private String collectionPath() { return "/collections/" + properties.collectionName(); }

    public record IndexedChunk(String id, long documentId, String fileName, TextChunk chunk, float[] vector) { }
}
