package com.sextelecomleague.backend.narration;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Validated
@ConfigurationProperties(prefix = "broadcast.narration")
public class NarrationProperties {

	private boolean enabled = false;
	private boolean audioEnabled = false;

	@Valid
	private OpenAi openai = new OpenAi();

	@Valid
	private ElevenLabs elevenLabs = new ElevenLabs();

	@Valid
	private Limits limits = new Limits();

	@Valid
	private Storage storage = new Storage();

	public boolean isEnabled() {
		return enabled;
	}

	public void setEnabled(boolean enabled) {
		this.enabled = enabled;
	}

	public boolean isAudioEnabled() {
		return audioEnabled;
	}

	public void setAudioEnabled(boolean audioEnabled) {
		this.audioEnabled = audioEnabled;
	}

	public OpenAi getOpenai() {
		return openai;
	}

	public void setOpenai(OpenAi openai) {
		this.openai = openai;
	}

	public ElevenLabs getElevenLabs() {
		return elevenLabs;
	}

	public void setElevenLabs(ElevenLabs elevenLabs) {
		this.elevenLabs = elevenLabs;
	}

	public Limits getLimits() {
		return limits;
	}

	public void setLimits(Limits limits) {
		this.limits = limits;
	}

	public Storage getStorage() {
		return storage;
	}

	public void setStorage(Storage storage) {
		this.storage = storage;
	}

	public static class OpenAi {
		private String apiKey;

		@NotBlank
		private String baseUrl = "https://api.openai.com/v1";

		@NotBlank
		private String model = "gpt-5-nano";

		@Min(1)
		private int timeoutSeconds = 20;

		public String getApiKey() {
			return apiKey;
		}

		public void setApiKey(String apiKey) {
			this.apiKey = apiKey;
		}

		public String getBaseUrl() {
			return baseUrl;
		}

		public void setBaseUrl(String baseUrl) {
			this.baseUrl = trimTrailingSlash(baseUrl);
		}

		public String getModel() {
			return model;
		}

		public void setModel(String model) {
			this.model = model;
		}

		public int getTimeoutSeconds() {
			return timeoutSeconds;
		}

		public void setTimeoutSeconds(int timeoutSeconds) {
			this.timeoutSeconds = timeoutSeconds;
		}
	}

	public static class ElevenLabs {
		private String apiKey;

		@NotBlank
		private String baseUrl = "https://api.elevenlabs.io/v1";

		@NotBlank
		private String modelId = "eleven_multilingual_v2";

		private String voiceId;

		@Min(1)
		private int timeoutSeconds = 30;

		public String getApiKey() {
			return apiKey;
		}

		public void setApiKey(String apiKey) {
			this.apiKey = apiKey;
		}

		public String getBaseUrl() {
			return baseUrl;
		}

		public void setBaseUrl(String baseUrl) {
			this.baseUrl = trimTrailingSlash(baseUrl);
		}

		public String getModelId() {
			return modelId;
		}

		public void setModelId(String modelId) {
			this.modelId = modelId;
		}

		public String getVoiceId() {
			return voiceId;
		}

		public void setVoiceId(String voiceId) {
			this.voiceId = voiceId;
		}

		public int getTimeoutSeconds() {
			return timeoutSeconds;
		}

		public void setTimeoutSeconds(int timeoutSeconds) {
			this.timeoutSeconds = timeoutSeconds;
		}
	}

	public static class Limits {
		@Min(1)
		private int maxTextCharacters = 220;

		@Min(1)
		private int maxNarrationsPerLeagueGameweek = 40;

		@Min(1)
		private long monthlyTtsCharacterBudget = 100_000;

		public int getMaxTextCharacters() {
			return maxTextCharacters;
		}

		public void setMaxTextCharacters(int maxTextCharacters) {
			this.maxTextCharacters = maxTextCharacters;
		}

		public int getMaxNarrationsPerLeagueGameweek() {
			return maxNarrationsPerLeagueGameweek;
		}

		public void setMaxNarrationsPerLeagueGameweek(int maxNarrationsPerLeagueGameweek) {
			this.maxNarrationsPerLeagueGameweek = maxNarrationsPerLeagueGameweek;
		}

		public long getMonthlyTtsCharacterBudget() {
			return monthlyTtsCharacterBudget;
		}

		public void setMonthlyTtsCharacterBudget(long monthlyTtsCharacterBudget) {
			this.monthlyTtsCharacterBudget = monthlyTtsCharacterBudget;
		}
	}

	public static class Storage {
		@NotBlank
		private String tempDirectory = "${java.io.tmpdir}/stk-broadcast/narrations";

		@NotNull
		private Duration audioTtl = Duration.ofMinutes(30);

		@NotNull
		private Duration cleanupInterval = Duration.ofMinutes(5);

		public String getTempDirectory() {
			return tempDirectory;
		}

		public void setTempDirectory(String tempDirectory) {
			this.tempDirectory = tempDirectory;
		}

		public Duration getAudioTtl() {
			return audioTtl;
		}

		public void setAudioTtl(Duration audioTtl) {
			this.audioTtl = audioTtl;
		}

		public Duration getCleanupInterval() {
			return cleanupInterval;
		}

		public void setCleanupInterval(Duration cleanupInterval) {
			this.cleanupInterval = cleanupInterval;
		}
	}

	private static String trimTrailingSlash(String value) {
		if (value == null || value.isBlank()) {
			return value;
		}
		return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
	}
}
