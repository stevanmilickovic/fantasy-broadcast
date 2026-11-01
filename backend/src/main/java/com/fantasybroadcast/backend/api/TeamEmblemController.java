package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.SessionService;
import com.fantasybroadcast.backend.customer.TeamEmblemService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Positive;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/leagues/{leagueId}/teams")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class TeamEmblemController {
	private final SessionService sessions;
	private final TeamEmblemService emblems;

	public TeamEmblemController(SessionService sessions, TeamEmblemService emblems) {
		this.sessions = sessions;
		this.emblems = emblems;
	}

	@GetMapping("/emblems")
	public ResponseEntity<List<TeamEmblemService.TeamEmblem>> teams(HttpServletRequest request, @PathVariable @Positive long leagueId) {
		return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(emblems.teams(sessions.require(request), leagueId));
	}

	@PutMapping(value = "/{entryId}/emblem", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	public void upload(HttpServletRequest request, @PathVariable @Positive long leagueId,
			@PathVariable @Positive long entryId, @RequestParam("image") MultipartFile image) throws IOException {
		emblems.upload(sessions.require(request), leagueId, entryId, image);
	}

	@DeleteMapping("/{entryId}/emblem")
	public void delete(HttpServletRequest request, @PathVariable @Positive long leagueId, @PathVariable @Positive long entryId) {
		emblems.delete(sessions.require(request), leagueId, entryId);
	}

	@GetMapping(value = "/{entryId}/emblem/{version}.png", produces = MediaType.IMAGE_PNG_VALUE)
	public ResponseEntity<byte[]> image(HttpServletRequest request, @PathVariable @Positive long leagueId,
			@PathVariable @Positive long entryId, @PathVariable String version) {
		var image = emblems.image(sessions.require(request), leagueId, entryId, version);
		return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG)
				.cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate().immutable())
				.eTag("\"" + version + "\"").header("X-Content-Type-Options", "nosniff").body(image);
	}
}
