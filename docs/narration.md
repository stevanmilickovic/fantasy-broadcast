# AI Narration Setup

The narration system is backend-owned. Browsers never call OpenAI or ElevenLabs directly.

## How It Works

```text
FPL poll detects fantasy events
  -> backend filters narratable events
  -> backend creates/dedupes narration jobs
  -> text and optional audio are generated
  -> event release is staged briefly
  -> SSE sends the visual notification and matching narration together
```

The default release delay is 1 minute. If narration is ready inside that window, the viewer sees the notification and hears the voice together. If voice is not ready or is disabled, the notification still appears with text-only commentary when available. Set `BROADCAST_NARRATION_RELEASE_DELAY` to a shorter value when testing a faster presentation.

## Global Configuration

These environment variables are system-wide switches and provider settings:

```bash
BROADCAST_NARRATION_ENABLED=true
BROADCAST_NARRATION_AUDIO_ENABLED=false

OPENAI_API_KEY=...
OPENAI_NARRATION_MODEL=gpt-5-nano
OPENAI_NARRATION_TIMEOUT_SECONDS=20

ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_TIMEOUT_SECONDS=30
```

Leave `BROADCAST_NARRATION_AUDIO_ENABLED=false` while tuning text. Turn it on only when testing paid TTS generation.

## Per-League Settings

Narration must also be enabled per league in the admin screen:

- `AI text`: allows generated text narration for that league.
- `Voice`: allows TTS audio for that league.

Voice requires AI text. If AI text is disabled, voice is treated as disabled.

## Budget Controls

Current knobs:

```bash
BROADCAST_NARRATION_MAX_TEXT_CHARACTERS=220
BROADCAST_NARRATION_MAX_PER_LEAGUE_GAMEWEEK=40
BROADCAST_NARRATION_MONTHLY_TTS_CHARACTERS=100000
BROADCAST_NARRATION_RELEASE_DELAY=5s
BROADCAST_NARRATION_AUDIO_TTL=30m
BROADCAST_NARRATION_CLEANUP_INTERVAL=5m
```

OpenAI text cost should be low for short lines. ElevenLabs character usage is the main budget driver, so tune `BROADCAST_NARRATION_MONTHLY_TTS_CHARACTERS` and `BROADCAST_NARRATION_MAX_PER_LEAGUE_GAMEWEEK` first.

## Testing Order

1. Start with text-only:

   ```bash
   BROADCAST_NARRATION_ENABLED=true
   BROADCAST_NARRATION_AUDIO_ENABLED=false
   OPENAI_API_KEY=...
   ```

2. Enable `AI text` for one test league in the admin screen.
3. Open a real broadcast for that league.
4. Check generated rows in `broadcast_narration`.
5. Tune prompt/length if the text is too long, flat, or inaccurate.
6. Add ElevenLabs settings and enable global audio:

   ```bash
   BROADCAST_NARRATION_AUDIO_ENABLED=true
   ELEVENLABS_API_KEY=...
   ELEVENLABS_VOICE_ID=...
   ```

7. Enable `Voice` for the same test league.
8. Confirm MP3 files appear in the temp narration directory and audio plays in the broadcast.

## Tuning

Start with these changes, in this order:

1. Adjust `BROADCAST_NARRATION_MAX_TEXT_CHARACTERS`.
2. Adjust `BROADCAST_NARRATION_RELEASE_DELAY` if audio arrives late.
3. Update the OpenAI prompt in `OpenAiCommentaryTextGenerator`.
4. Adjust `NarrationEventSelector` if too many or too few events are narrated.
5. Change ElevenLabs voice/model settings after the text style is stable.

## Operational Notes

- Narration is generated once per fantasy event, not per viewer.
- Deduplication uses `league_id + gameweek + source_event_id`.
- Temporary audio is served through `/api/broadcast-narrations/{id}/audio`.
- Expired audio files are deleted by the cleanup job.
- Provider failures mark narration rows as `FAILED`; broadcasts continue without voice.
- Monthly TTS budget exhaustion falls back to text-only commentary.
