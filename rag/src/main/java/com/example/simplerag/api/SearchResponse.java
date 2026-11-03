package com.example.simplerag.api;

import java.util.List;
import java.util.Map;

/** 返回原文命中；rrf / rerank / rrf_fallback 区分实际排序方式。 */
public record SearchResponse(String query, List<Hit> results, String rankingMode) {
    public record Hit(String chunkId, String documentId, String fileName, int chunkIndex, String content,
                      double score, double rrfScore, String scoreType, String headingPath,
                      Map<String, Object> anchor, Map<String, Object> locator) {
        public Hit reranked(double relevanceScore) {
            return new Hit(chunkId, documentId, fileName, chunkIndex, content, relevanceScore, rrfScore,
                    "rerank", headingPath, anchor, locator);
        }
    }
}
