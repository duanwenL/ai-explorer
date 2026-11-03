package com.example.simplerag.config;

import java.nio.file.Path;

import com.example.simplerag.service.FullDocumentStore;
import com.example.simplerag.service.MindPadTextSplitter;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.web.client.RestClientCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

/** 注册切分器、本机原文存储和模型 HTTP 超时。 */
@Configuration
@EnableConfigurationProperties({RagProperties.class, QdrantProperties.class, RerankProperties.class})
public class RagConfiguration {
    @Bean
    public FullDocumentStore fullDocumentStore(
            @Value("${RAG_DOCUMENTS_DIRECTORY:${rag.documents-directory:./data/documents}}") String directory,
            QdrantProperties qdrant, ObjectMapper mapper) {
        return new FullDocumentStore(Path.of(directory).resolve(qdrant.collectionName()), mapper);
    }

    @Bean
    public MindPadTextSplitter textSplitter(RagProperties properties) {
        return new MindPadTextSplitter(properties.chunkSize(), properties.chunkOverlap());
    }

    @Bean
    public RestClientCustomizer embeddingHttpTimeouts(RagProperties properties) {
        if (properties.connectTimeout().isNegative() || properties.connectTimeout().isZero()
                || properties.readTimeout().isNegative() || properties.readTimeout().isZero()) {
            throw new IllegalArgumentException("rag 中的连接和读取超时必须大于 0");
        }
        return builder -> {
            var requestFactory = new SimpleClientHttpRequestFactory();
            requestFactory.setConnectTimeout(properties.connectTimeout());
            requestFactory.setReadTimeout(properties.readTimeout());
            builder.requestFactory(requestFactory);
        };
    }
}
