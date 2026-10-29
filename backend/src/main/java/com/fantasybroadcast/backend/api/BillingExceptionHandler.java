package com.fantasybroadcast.backend.api;

import org.springframework.context.annotation.Profile;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

/** Return actionable billing errors without exposing provider responses or credentials. */
@RestControllerAdvice(assignableTypes = {SubscriptionController.class, BillingAdministrationController.class,
		LeaguePaymentController.class, CustomerLeagueController.class, LiveStateController.class})
@Profile("db & !test")
public class BillingExceptionHandler {
	@ExceptionHandler(ResponseStatusException.class)
	public ProblemDetail handle(ResponseStatusException exception) {
		return ProblemDetail.forStatusAndDetail(exception.getStatusCode(),
				exception.getReason() == null ? "Unable to complete this request." : exception.getReason());
	}
}
