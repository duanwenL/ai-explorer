package com.example.simplerag.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import com.example.simplerag.config.QdrantProperties;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingRequest;
import org.springframework.stereotype.Component;

/** Spring AI 向量边界：对齐响应 index，并验证数量、维度与有限数值。 */
@Component
public class TextEmbeddingClient {
    private final EmbeddingModel model;
    private final int dimensions;

    public TextEmbeddingClient(EmbeddingModel model, QdrantProperties properties) {
        this.model = model;
        this.dimensions = properties.dimensions();
    }

    public List<float[]> embed(List<String> inputs) {
        if (inputs.isEmpty()) return List.of();
        var response = model.call(new EmbeddingRequest(inputs, null));
        if (response == null || response.getResults() == null) {
            throw new IllegalStateException("向量 API 没有返回结果");
        }
        List<float[]> vectors = new ArrayList<>(Collections.nCopies(inputs.size(), null));
        for (var result : response.getResults()) {
            int index = result.getIndex();
            float[] vector = result.getOutput();
            if (index < 0 || index >= inputs.size() || vectors.get(index) != null
                    || vector == null || vector.length != dimensions) {
                throw new IllegalStateException("向量 API 返回的 index、数量或维度不正确");
            }
            for (float value : vector) {
                if (!Float.isFinite(value)) throw new IllegalStateException("向量 API 返回非有限数值");
            }
            vectors.set(index, vector);
        }
        if (vectors.contains(null)) throw new IllegalStateException("向量 API 响应缺少输入对应的向量");
        return List.copyOf(vectors);
    }
}
