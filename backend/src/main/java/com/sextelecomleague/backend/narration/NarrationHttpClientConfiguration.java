package com.sextelecomleague.backend.narration;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
class NarrationHttpClientConfiguration {

	@Bean
	RestClient.Builder narrationRestClientBuilder() {
		return RestClient.builder();
	}
}
