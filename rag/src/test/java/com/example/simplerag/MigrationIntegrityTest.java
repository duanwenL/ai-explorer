package com.example.simplerag;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import static org.assertj.core.api.Assertions.assertThat;

/** 删除旧项目之前的只读迁移核验；默认关闭，删除之后不再依赖旧目录。 */
@EnabledIfSystemProperty(named = "rag.migration-audit", matches = "true")
class MigrationIntegrityTest {
    private final Path source = Path.of("/Users/smzdm/IdeaProjects/simple-rag");
    private final Path target = Path.of(System.getProperty("user.dir"));

    @Test
    void allProductionJavaAndUnchangedStaticFilesArePreserved() throws Exception {
        List<String> differences = new ArrayList<>();
        try (var files = Files.walk(source.resolve("src/main"))) {
            for (Path oldFile : files.filter(Files::isRegularFile).toList()) {
                String relative = source.relativize(oldFile).toString();
                if (relative.equals("src/main/resources/application.yml")
                        || relative.equals("src/main/resources/static/index.html")) continue;
                Path newFile = target.resolve(relative);
                if (!Files.isRegularFile(newFile) || Files.mismatch(oldFile, newFile) != -1) {
                    differences.add(relative);
                }
            }
        }
        assertThat(differences).as("除已明确调整的名称和配置外，业务实现必须完整保留").isEmpty();
    }

    @Test
    void sourceTestsAndPrivateDocumentsHaveAllBeenMigrated() throws Exception {
        for (String directory : List.of("src/test", "data/documents")) {
            try (var files = Files.walk(source.resolve(directory))) {
                for (Path oldFile : files.filter(Files::isRegularFile).toList()) {
                    Path newFile = target.resolve(source.relativize(oldFile));
                    assertThat(newFile).as("旧项目文件必须已存在于新模块：%s", source.relativize(oldFile)).isRegularFile();
                    if (directory.equals("data/documents")) {
                        assertThat(Files.mismatch(oldFile, newFile)).as("资料必须逐字节一致：%s", oldFile.getFileName()).isEqualTo(-1);
                    }
                }
            }
        }
    }

    @Test
    void historicalDocumentationIsPreservedVerbatim() throws Exception {
        for (String name : List.of("README.md", "VERIFICATION.md")) {
            assertThat(Files.mismatch(source.resolve(name), target.resolve("docs/legacy").resolve(name)))
                    .as("历史文档必须完整保留：%s", name).isEqualTo(-1);
        }
        assertThat(Files.mismatch(source.resolve("examples/demo.md"), target.resolve("examples/demo.md"))).isEqualTo(-1);
        for (String name : List.of("package.json", "vitest.config.js", "eslint.config.js", "bun.lock", "requests.http")) {
            assertThat(target.resolve(name)).isRegularFile();
        }
    }
}
