package com.example.simplerag.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.commonmark.node.BlockQuote;
import org.commonmark.node.Heading;
import org.commonmark.node.ListBlock;
import org.commonmark.node.ListItem;
import org.commonmark.node.Node;
import org.commonmark.node.Paragraph;
import org.commonmark.node.SourceSpan;
import org.commonmark.parser.IncludeSourceSpans;
import org.commonmark.parser.Parser;

/** 内容块切分：512/64 是目标，保留完整段落和完整重叠块，不硬截断。 */
public class MindPadTextSplitter {
    private final int chunkSize;
    private final int overlap;
    private final Parser markdown = Parser.builder().includeSourceSpans(IncludeSourceSpans.BLOCKS).build();

    public MindPadTextSplitter(int chunkSize, int overlap) {
        if (chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
            throw new IllegalArgumentException("chunkSize 必须大于 0，chunkOverlap 必须大于等于 0 且小于 chunkSize");
        }
        this.chunkSize = chunkSize;
        this.overlap = overlap;
    }

    public List<TextChunk> split(String text, boolean markdownView) {
        if (text == null || text.isBlank()) return List.of();
        String[] lines = text.split("\n", -1);
        List<Block> blocks = new ArrayList<>();
        if (markdownView) {
            List<String> headings = new ArrayList<>();
            collectMarkdown(markdown.parse(text), lines, headings, blocks);
        } else {
            int start = 0;
            for (int index = 0; index <= lines.length; index++) {
                if (index == lines.length || lines[index].isBlank()) {
                    if (start < index) blocks.add(new Block(join(lines, start, index), start + 1, index, List.of()));
                    start = index + 1;
                }
            }
        }
        if (blocks.isEmpty()) blocks.add(new Block(text.replaceAll("^\\n+|\\n+$", ""), 1, lines.length, List.of()));
        return pack(blocks, markdownView ? "markdown" : "text");
    }

    /** 列表与引用容器及其内部段落都参与；保留原实验的 CommonMark 行定位。 */
    private void collectMarkdown(Node parent, String[] lines, List<String> headings, List<Block> blocks) {
        for (Node node = parent.getFirstChild(); node != null; node = node.getNext()) {
            List<SourceSpan> spans = node.getSourceSpans();
            if (node instanceof Heading heading && !spans.isEmpty()) {
                List<String> titleLines = new ArrayList<>();
                for (SourceSpan span : spans) {
                    String line = lines[span.getLineIndex()];
                    titleLines.add(line.substring(span.getColumnIndex(), span.getColumnIndex() + span.getLength()));
                }
                if (titleLines.size() > 1 && titleLines.getLast().strip().matches("(?:=+|-+)")) {
                    titleLines.removeLast();
                } else {
                    String atx = titleLines.getFirst().strip().replaceFirst("^#{1,6}(?:[ \\t]+|$)", "");
                    titleLines.set(0, atx.replaceFirst("[ \\t]+#+[ \\t]*$", ""));
                }
                String title = heading.getFirstChild() == null ? "" : String.join("\n", titleLines).strip();
                int keep = Math.min(headings.size(), heading.getLevel() - 1);
                headings.subList(keep, headings.size()).clear();
                headings.add(title);
            } else if ((node instanceof Paragraph || node instanceof ListBlock
                    || node instanceof ListItem || node instanceof BlockQuote) && !spans.isEmpty()) {
                int start = spans.getFirst().getLineIndex();
                int end = spans.getLast().getLineIndex() + 1;
                String body = join(lines, start, end).replaceAll("^\\n+|\\n+$", "");
                if (!body.isBlank()) blocks.add(new Block(body, start + 1, end, List.copyOf(headings)));
            }
            collectMarkdown(node, lines, headings, blocks);
        }
    }

    private List<TextChunk> pack(List<Block> blocks, String view) {
        List<TextChunk> chunks = new ArrayList<>();
        List<Block> current = new ArrayList<>();
        int used = 0;
        for (Block block : blocks) {
            int cost = estimateTokens(block.text());
            if (!current.isEmpty() && used + cost > chunkSize) {
                current = emit(chunks, current, view);
                used = current.stream().mapToInt(item -> estimateTokens(item.text())).sum();
            }
            current.add(block);
            used += cost;
            if (cost > chunkSize * 1.4) {
                current = emit(chunks, current, view);
                used = current.stream().mapToInt(item -> estimateTokens(item.text())).sum();
            }
        }
        emit(chunks, current, view);
        return List.copyOf(chunks);
    }

    private List<Block> emit(List<TextChunk> chunks, List<Block> current, String view) {
        if (current.isEmpty()) return new ArrayList<>();
        String body = String.join("\n\n", current.stream().map(Block::text).toList());
        int start = current.getFirst().start();
        int end = current.getLast().end();
        Map<String, Object> anchor = Map.of("view", view, "lineStart", start, "lineEnd", end);
        Map<String, Object> locator = view.equals("text") ? Map.of("type", "line", "start", start, "end", end) : null;
        chunks.add(new TextChunk(chunks.size(), body, current.getFirst().headings(), anchor, locator, estimateTokens(body)));
        List<Block> kept = new ArrayList<>();
        int tokens = 0;
        if (overlap > 0) {
            for (int index = current.size() - 1; index >= 0; index--) {
                Block block = current.get(index);
                int cost = estimateTokens(block.text());
                if (!kept.isEmpty() && tokens + cost > overlap) break;
                kept.addFirst(block);
                tokens += cost;
            }
        }
        return kept;
    }

    public static int estimateTokens(String text) {
        int chinese = 0;
        int other = 0;
        for (int point : text.codePoints().toArray()) {
            if (point >= 0x4e00 && point <= 0x9fff) chinese++;
            else other++;
        }
        return Math.max(1, chinese + other / 4);
    }

    private static String join(String[] lines, int start, int end) {
        return String.join("\n", java.util.Arrays.copyOfRange(lines, start, end));
    }

    private record Block(String text, int start, int end, List<String> headings) { }
}
