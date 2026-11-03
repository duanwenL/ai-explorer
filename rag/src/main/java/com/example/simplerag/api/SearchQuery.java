package com.example.simplerag.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 省略 topK 时返回 8 条；JSON 小数到整数的强制转换由配置关闭。 */
public record SearchQuery(
        @NotBlank(message = "query 不能为空")
        @Size(max = 2000, message = "query 最多允许 2000 个字符") String query,
        @Min(value = 1, message = "topK 不能小于 1")
        @Max(value = 20, message = "topK 不能大于 20") Integer topK) {
    public static final int DEFAULT_TOP_K = 8;
    public static final int MAX_TOP_K = 20;
}
