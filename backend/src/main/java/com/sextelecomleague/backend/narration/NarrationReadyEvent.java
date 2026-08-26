package com.sextelecomleague.backend.narration;

public record NarrationReadyEvent(long leagueId, int gameweek, long narrationId) {
}
