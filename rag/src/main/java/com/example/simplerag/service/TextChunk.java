package com.example.simplerag.service;

import java.util.List;
import java.util.Map;

/** 正文、标题与定位分开保存；tokenCount 是切分估算值，不用于计费。 */
public record TextChunk(int index, String text, List<String> headingPath,
                        Map<String, Object> anchor, Map<String, Object> locator, int tokenCount) {
    public String embeddingInput(String fileName) {
        String heading = String.join(" > ", headingPath);
        String prefix = heading.isEmpty() ? fileName : fileName + " > " + heading;
        return prefix + "\n" + text;
    }

    public String lexicalInput() {
        String heading = String.join(" > ", headingPath);
        String input = (heading.isEmpty() ? text : heading + "\n" + text).strip();
        return input.isEmpty() ? " " : input;
    }
}
