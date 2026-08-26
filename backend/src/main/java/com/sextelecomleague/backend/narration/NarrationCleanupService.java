package com.sextelecomleague.backend.narration;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@Profile("db & !test")
public class NarrationCleanupService {
	private static final Logger log = LoggerFactory.getLogger(NarrationCleanupService.class);

	private final NarrationProperties properties;
	private final BroadcastNarrationRepository repository;

	public NarrationCleanupService(NarrationProperties properties, BroadcastNarrationRepository repository) {
		this.properties = properties;
		this.repository = repository;
	}

	@Scheduled(fixedDelayString = "${broadcast.narration.storage.cleanup-interval:5m}")
	public void cleanupExpiredAudio() {
		var storageRoot = Path.of(properties.getStorage().getTempDirectory()).toAbsolutePath().normalize();
		for (var narration : repository.expiredAudioNarrations(Instant.now())) {
			deleteAudioFile(storageRoot, narration.audioPath());
			repository.markExpired(narration.id());
		}
	}

	private void deleteAudioFile(Path storageRoot, String audioPathValue) {
		if (audioPathValue == null || audioPathValue.isBlank()) return;
		var audioPath = Path.of(audioPathValue).toAbsolutePath().normalize();
		if (!audioPath.startsWith(storageRoot)) {
			log.warn("Skipping narration cleanup outside storage root: {}", audioPath);
			return;
		}
		try {
			Files.deleteIfExists(audioPath);
		}
		catch (IOException exception) {
			log.warn("Failed to delete expired narration audio: {}", audioPath, exception);
		}
	}
}
