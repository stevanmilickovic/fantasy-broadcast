package com.sextelecomleague.backend.api;

import com.sextelecomleague.backend.fpl.FplDraftClientException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(FplDraftClientException.class)
	public ResponseEntity<FplErrorResponse> handleFplDraftClientException(FplDraftClientException exception) {
		var status = HttpStatus.BAD_GATEWAY;
		return ResponseEntity.status(status)
				.body(new FplErrorResponse(
						exception.getMessage(),
						exception.getStatusCode(),
						exception.getUrl(),
						exception.getBodyPreview()));
	}

	public record FplErrorResponse(String message, Integer upstreamStatusCode, String upstreamUrl, String bodyPreview) {
	}
}
