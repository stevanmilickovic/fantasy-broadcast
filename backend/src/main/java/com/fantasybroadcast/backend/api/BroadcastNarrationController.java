package com.fantasybroadcast.backend.api;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import com.fantasybroadcast.backend.narration.BroadcastNarrationRepository;
import com.fantasybroadcast.backend.narration.NarrationProperties;

import org.springframework.context.annotation.Profile;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Profile("db & !test")
@RequestMapping("/api/broadcast-narrations")
@CrossOrigin(origins = "http://localhost:5173")
public class BroadcastNarrationController {

	private final BroadcastNarrationRepository repository;
	private final NarrationProperties properties;

	public BroadcastNarrationController(BroadcastNarrationRepository repository, NarrationProperties properties) {
		this.repository = repository;
		this.properties = properties;
	}

	@GetMapping("/{id}/audio")
	public ResponseEntity<FileSystemResource> audio(@PathVariable long id) {
		var narration = repository.findById(id).orElse(null);
		if (narration == null || narration.audioPath() == null || narration.audioPath().isBlank()) {
			return ResponseEntity.notFound().build();
		}
		if (narration.expiresAt() != null && narration.expiresAt().isBefore(Instant.now())) {
			return ResponseEntity.status(HttpStatus.GONE).build();
		}

		var storageRoot = Path.of(properties.getStorage().getTempDirectory()).toAbsolutePath().normalize();
		var audioPath = Path.of(narration.audioPath()).toAbsolutePath().normalize();
		if (!audioPath.startsWith(storageRoot)) {
			return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
		}
		if (!Files.isRegularFile(audioPath)) {
			return ResponseEntity.noContent().build();
		}

		return ResponseEntity.ok()
				.contentType(MediaType.valueOf("audio/mpeg"))
				.header(HttpHeaders.CACHE_CONTROL, "private, max-age=300")
				.body(new FileSystemResource(audioPath));
	}
}
