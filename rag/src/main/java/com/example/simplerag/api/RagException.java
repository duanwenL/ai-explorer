package com.example.simplerag.api;

import org.springframework.http.HttpStatus;

/** 可以安全返回给调用方的业务错误；不拼接上游原始响应。 */
public class RagException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    public RagException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
    public HttpStatus status() { return status; }
    public String code() { return code; }
}
