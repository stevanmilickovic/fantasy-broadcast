package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.customer.BroadcastScheduleService;
import com.fantasybroadcast.backend.customer.BroadcastScheduleService.BroadcastSchedule;
import com.fantasybroadcast.backend.customer.CurrentUser;
import com.fantasybroadcast.backend.customer.SessionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.Instant;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@Profile("db & !test")
@RequestMapping("/api/customer")
public class BroadcastScheduleController {

	private final SessionService sessionService;
	private final BroadcastScheduleService schedules;

	public BroadcastScheduleController(SessionService sessionService, BroadcastScheduleService schedules) {
		this.sessionService = sessionService;
		this.schedules = schedules;
	}

	@GetMapping("/admin/broadcast-schedules")
	public List<BroadcastSchedule> all(HttpServletRequest request) { return schedules.allForAdmin(currentUser(request)); }
	@PostMapping("/admin/broadcast-schedules")
	public BroadcastSchedule create(HttpServletRequest httpRequest, @Valid @RequestBody ScheduleRequest request) { return schedules.create(currentUser(httpRequest), request.startsAt(), request.endsAt()); }
	@PutMapping("/admin/broadcast-schedules/{scheduleId}")
	public BroadcastSchedule update(HttpServletRequest httpRequest, @PathVariable @Positive long scheduleId, @Valid @RequestBody ScheduleRequest request) { return schedules.update(currentUser(httpRequest), scheduleId, request.startsAt(), request.endsAt()); }
	@DeleteMapping("/admin/broadcast-schedules/{scheduleId}")
	public void delete(HttpServletRequest request, @PathVariable @Positive long scheduleId) { schedules.delete(currentUser(request), scheduleId); }
	@PostMapping("/admin/broadcast-schedules/generate-today")
	public List<BroadcastSchedule> generateToday(HttpServletRequest request) { return schedules.generateForToday(currentUser(request)); }
	@GetMapping("/broadcast-schedules/active")
	public List<BroadcastSchedule> active(HttpServletRequest request) { return schedules.activeFor(currentUser(request)); }

	private CurrentUser currentUser(HttpServletRequest request) { return sessionService.require(request); }
	public record ScheduleRequest(@NotNull Instant startsAt, @NotNull Instant endsAt) { }
}
