package com.fantasybroadcast.backend.api;

import com.fantasybroadcast.backend.fpl.FplDraftClientException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

	@ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
	public ResponseEntity<ApiErrorResponse> handleOversizedUpload() {
		return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
				.body(new ApiErrorResponse("Choose a PNG image no larger than 5 MB."));
	}

	@ExceptionHandler(FplDraftClientException.class)
	public ResponseEntity<FplErrorResponse> handleFplDraftClientException(FplDraftClientException exception) {
		var status = HttpStatus.BAD_GATEWAY;
		return ResponseEntity.status(status)
				.body(new FplErrorResponse(
						"FPL data is temporarily unavailable. Please try again.",
						exception.getStatusCode(),
						exception.getUrl()));
	}

	@ExceptionHandler(ResponseStatusException.class)
	public ResponseEntity<ApiErrorResponse> handleResponseStatusException(ResponseStatusException exception) {
		return ResponseEntity.status(exception.getStatusCode())
				.body(new ApiErrorResponse(exception.getReason() == null ? "The request could not be completed." : exception.getReason()));
	}

	public record FplErrorResponse(String message, Integer upstreamStatusCode, String upstreamUrl) {
	}

	public record ApiErrorResponse(String message) {
	}
}
