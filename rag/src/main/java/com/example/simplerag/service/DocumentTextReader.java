package com.example.simplerag.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Set;

import com.example.simplerag.api.RagException;
import com.example.simplerag.config.RagProperties;
import org.apache.tika.Tika;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.metadata.TikaCoreProperties;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.parser.ParseContext;
import org.apache.tika.parser.ocr.TesseractOCRConfig;
import org.apache.tika.parser.pdf.PDFParserConfig;
import org.apache.tika.sax.BodyContentHandler;
import org.apache.tika.exception.WriteLimitReachedException;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/** TXT/MD 严格 UTF-8；DOCX/PDF 用 Tika 提取文字，关闭 OCR 并限制输出。 */
@Component
public class DocumentTextReader {
    private static final Set<String> SUPPORTED_EXTENSIONS = Set.of("txt", "md", "docx", "pdf");
    private final RagProperties properties;
    private final MultipartProperties multipartProperties;

    public DocumentTextReader(RagProperties properties, MultipartProperties multipartProperties) {
        this.properties = properties;
        this.multipartProperties = multipartProperties;
    }

    public ParsedDocument read(MultipartFile file) {
        if (file.isEmpty()) throw new RagException(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "上传文件不能为空");
        long maxFileBytes = multipartProperties.getMaxFileSize().toBytes();
        if (file.getSize() > maxFileBytes) throw new RagException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "文件超过允许的上传大小");
        String originalName = file.getOriginalFilename();
        String fileName = originalName == null ? "" : StringUtils.getFilename(originalName.replace('\\', '/'));
        fileName = fileName == null ? "" : fileName.strip().replaceAll("[\\p{Cntrl}]", "_");
        String extension = StringUtils.getFilenameExtension(fileName);
        if (extension == null || !SUPPORTED_EXTENSIONS.contains(extension.toLowerCase(Locale.ROOT))) {
            throw new RagException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_FILE_TYPE", "仅支持 UTF-8 的 TXT、Markdown、DOCX 和文字型 PDF");
        }
        extension = extension.toLowerCase(Locale.ROOT);
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException exception) {
            throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "FILE_READ_FAILED", "无法读取上传文件，请重新上传");
        }
        if (bytes.length > maxFileBytes) throw new RagException(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "文件超过允许的上传大小");
        String text = extension.equals("txt") || extension.equals("md") ? readUtf8(bytes) : readOfficeOrPdf(bytes, fileName, extension);
        text = text.replace("\r\n", "\n").replace('\r', '\n');
        if (text.isBlank()) {
            throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "NO_TEXT", "文件没有可检索文字；扫描版 PDF 需要 OCR，本项目暂不支持");
        }
        if (text.length() > properties.maxTextCharacters()) {
            throw new RagException(HttpStatus.PAYLOAD_TOO_LARGE, "TEXT_TOO_LARGE", "解析后的文字过多，请拆分文档后上传");
        }
        return new ParsedDocument(fileName, text);
    }

    private String readUtf8(byte[] bytes) {
        try {
            String text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
            if (text.startsWith("\uFEFF")) text = text.substring(1);
            if (text.indexOf('\0') >= 0) throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_TEXT", "文本包含二进制空字符，请检查文件格式");
            return text;
        } catch (java.nio.charset.CharacterCodingException exception) {
            throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_ENCODING", "TXT 和 Markdown 请保存为 UTF-8 编码后上传");
        }
    }

    private String readOfficeOrPdf(byte[] bytes, String fileName, String extension) {
        try {
            String actualType = new Tika().detect(bytes, fileName);
            String expectedType = extension.equals("pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            if (!actualType.equals(expectedType)) throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_DOCUMENT", "文件实际内容与扩展名不匹配或文件已损坏");
            var handler = new BodyContentHandler(properties.maxTextCharacters());
            var metadata = new Metadata();
            metadata.set(TikaCoreProperties.RESOURCE_NAME_KEY, fileName);
            var context = new ParseContext();
            var pdfConfig = new PDFParserConfig();
            pdfConfig.setOcrStrategy(PDFParserConfig.OCR_STRATEGY.NO_OCR);
            pdfConfig.setExtractInlineImages(false);
            context.set(PDFParserConfig.class, pdfConfig);
            var ocrConfig = new TesseractOCRConfig();
            ocrConfig.setSkipOcr(true);
            context.set(TesseractOCRConfig.class, ocrConfig);
            try (var input = new ByteArrayInputStream(bytes)) {
                new AutoDetectParser().parse(input, handler, metadata, context);
            }
            return handler.toString();
        } catch (RagException exception) {
            throw exception;
        } catch (Exception exception) {
            if (WriteLimitReachedException.isWriteLimitReached(exception)) {
                throw new RagException(HttpStatus.PAYLOAD_TOO_LARGE, "TEXT_TOO_LARGE", "解析后的文字过多，请拆分文档后上传");
            }
            throw new RagException(HttpStatus.UNPROCESSABLE_ENTITY, "PARSE_FAILED", "无法解析文件；请确认文件未损坏、未加密，PDF 需要包含可提取文字");
        }
    }

    public record ParsedDocument(String fileName, String text) { }
}
