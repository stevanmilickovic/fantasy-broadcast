package com.fantasybroadcast.backend.fpl;

public class FplDraftClientException extends RuntimeException {

	private final Integer statusCode;
	private final String url;
	private final String bodyPreview;

	public FplDraftClientException(String message) {
		super(message);
		this.statusCode = null;
		this.url = null;
		this.bodyPreview = null;
	}

	public FplDraftClientException(String message, Throwable cause) {
		super(message, cause);
		this.statusCode = null;
		this.url = null;
		this.bodyPreview = null;
	}

	public FplDraftClientException(String message, int statusCode, String url, String bodyPreview) {
		super(message);
		this.statusCode = statusCode;
		this.url = url;
		this.bodyPreview = bodyPreview;
	}

	public Integer getStatusCode() {
		return statusCode;
	}

	public String getUrl() {
		return url;
	}

	public String getBodyPreview() {
		return bodyPreview;
	}
}
