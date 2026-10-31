package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.LeagueChatService;
import com.fantasybroadcast.backend.customer.LeagueChatService.Message;
import com.fantasybroadcast.backend.customer.LeagueChatService.MessagePage;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer/leagues/{leagueId}/chat")
@CrossOrigin(origins = "${BROADCAST_ALLOWED_ORIGIN:http://localhost:5173}")
public class LeagueChatController {
	private final SessionService sessions;
	private final LeagueChatService chat;
	public LeagueChatController(SessionService sessions, LeagueChatService chat) { this.sessions = sessions; this.chat = chat; }
	@GetMapping
	public MessagePage messages(HttpServletRequest request, @PathVariable @Positive long leagueId,
			@RequestParam(required = false) @Positive Long before, @RequestParam(required = false) @Positive Long after) {
		return chat.messages(sessions.require(request), leagueId, before, after);
	}
	@PostMapping
	public Message send(HttpServletRequest request, @PathVariable @Positive long leagueId, @Valid @RequestBody Send body) {
		return chat.send(sessions.require(request), leagueId, body.body(), body.sendId());
	}
	public record Send(@NotBlank @Size(max = 1000) String body, @NotBlank @Size(max = 36) String sendId) { }
}
