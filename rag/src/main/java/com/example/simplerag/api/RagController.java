package com.example.simplerag.api;

import com.example.simplerag.service.RagService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** HTTP 入口只接收和校验请求，业务链交给 RagService。 */
@RestController
@RequestMapping("/api")
public class RagController {
    private final RagService ragService;
    public RagController(RagService ragService) { this.ragService = ragService; }

    @PostMapping(value = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public UploadResponse upload(@RequestPart("file") MultipartFile file) {
        return ragService.upload(file);
    }

    @GetMapping("/documents/{documentId}/original")
    public ResponseEntity<OriginalDocumentResponse> original(@PathVariable String documentId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(ragService.original(documentId));
    }

    @PostMapping(value = "/search", consumes = MediaType.APPLICATION_JSON_VALUE)
    public SearchResponse search(@Valid @RequestBody SearchQuery request) {
        return ragService.search(request);
    }
}
