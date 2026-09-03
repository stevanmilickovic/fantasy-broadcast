package com.fantasybroadcast.backend.email;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailSender;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class BroadcastEmailService {

	private final BroadcastEmailProperties properties;
	private final ObjectProvider<MailSender> mailSender;

	public BroadcastEmailService(BroadcastEmailProperties properties, ObjectProvider<MailSender> mailSender) {
		this.properties = properties;
		this.mailSender = mailSender;
	}

	public void send(String to, String subject, String text) {
		if (!properties.isEnabled()) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Email is not configured.");
		}
		var sender = mailSender.getIfAvailable();
		if (sender == null) {
			throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "SMTP sender is not available.");
		}
		var message = new SimpleMailMessage();
		message.setFrom(properties.getFrom());
		message.setTo(to);
		message.setSubject(subject);
		message.setText(text);
		sender.send(message);
	}
}
