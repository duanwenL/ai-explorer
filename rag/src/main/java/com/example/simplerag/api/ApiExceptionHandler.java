package com.example.simplerag.api;

import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

/** 将异常转换为稳定的安全 JSON，不泄露上游原始响应和密钥。 */
@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(RagException.class)
    public ResponseEntity<ErrorResponse> businessError(RagException exception) {
        return ResponseEntity.status(exception.status())
                .body(new ErrorResponse(exception.code(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> invalidFields(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .distinct().collect(Collectors.joining("；"));
        return ResponseEntity.badRequest().body(new ErrorResponse("INVALID_REQUEST", message));
    }

    @ExceptionHandler({MissingServletRequestPartException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<ErrorResponse> malformedRequest() {
        return ResponseEntity.badRequest().body(new ErrorResponse("INVALID_REQUEST",
                "请求格式不正确：上传需要 file 字段；检索需要 JSON 格式的 query 和整数 topK"));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> uploadTooLarge() {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                .body(new ErrorResponse("FILE_TOO_LARGE", "文件或上传请求超过允许的大小"));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ErrorResponse> unsupportedMediaType() {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .body(new ErrorResponse("INVALID_CONTENT_TYPE", "上传请使用 multipart/form-data，检索请使用 application/json"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> unexpectedError(Exception exception) {
        if (exception instanceof org.springframework.web.ErrorResponse error && error.getStatusCode().is4xxClientError()) {
            return ResponseEntity.status(error.getStatusCode())
                    .body(new ErrorResponse("INVALID_REQUEST", "请求路径、方法或参数不正确"));
        }
        log.error("未预期的请求异常，类型:{}", exception.getClass().getSimpleName());
        return ResponseEntity.internalServerError()
                .body(new ErrorResponse("INTERNAL_ERROR", "服务发生内部错误，请检查本机服务日志"));
    }

    public record ErrorResponse(String code, String message) {}
}
