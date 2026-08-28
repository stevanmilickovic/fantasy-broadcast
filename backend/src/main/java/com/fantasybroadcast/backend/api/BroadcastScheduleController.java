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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

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
	public List<BroadcastSchedule> all(@RequestHeader("Authorization") String authorization) { return schedules.allForAdmin(currentUser(authorization)); }
	@PostMapping("/admin/broadcast-schedules")
	public BroadcastSchedule create(@RequestHeader("Authorization") String authorization, @Valid @RequestBody ScheduleRequest request) { return schedules.create(currentUser(authorization), request.startsAt(), request.endsAt()); }
	@PutMapping("/admin/broadcast-schedules/{scheduleId}")
	public BroadcastSchedule update(@RequestHeader("Authorization") String authorization, @PathVariable @Positive long scheduleId, @Valid @RequestBody ScheduleRequest request) { return schedules.update(currentUser(authorization), scheduleId, request.startsAt(), request.endsAt()); }
	@DeleteMapping("/admin/broadcast-schedules/{scheduleId}")
	public void delete(@RequestHeader("Authorization") String authorization, @PathVariable @Positive long scheduleId) { schedules.delete(currentUser(authorization), scheduleId); }
	@PostMapping("/admin/broadcast-schedules/generate-today")
	public List<BroadcastSchedule> generateToday(@RequestHeader("Authorization") String authorization) { return schedules.generateForToday(currentUser(authorization)); }
	@GetMapping("/broadcast-schedules/active")
	public List<BroadcastSchedule> active(@RequestHeader("Authorization") String authorization) { return schedules.activeFor(currentUser(authorization)); }

	private CurrentUser currentUser(String authorization) { return sessionService.require(authorization); }
	public record ScheduleRequest(@NotNull Instant startsAt, @NotNull Instant endsAt) { }
}
