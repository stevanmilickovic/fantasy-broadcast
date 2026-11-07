# Homepage preview logos

Place these transparent PNG files here:

- `north-bank.png` — North Bank FC
- `toulouse.png` — Expected Toulouse
- `fuchs.png` — No Fuchs Given
- `wanderers.png` — Bonus Point Wanderers

The homepage uses the same emblem component and reveal animation as league broadcasts.
Missing images are hidden until you add them. Commit the PNGs so frontend builds and
deployments include them.

To resize and compress them using the exact backend upload processor, run from the
repository root (Java 21 and Maven access are required):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-demo-logos.ps1
```

This replaces the four named PNGs in this folder with optimized versions. To keep
your original artwork, supply a separate source folder instead:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\prepare-demo-logos.ps1 -SourceDirectory "C:\path\to\originals"
```

Only the four filenames above are processed; missing files are skipped. All inputs
are validated before any images are written. The upload rules apply: PNG only,
at most 5 MB, 4096 pixels per side and 16 megapixels. Output preserves transparency
and aspect ratio on a square canvas up to 512 pixels, reduced further if necessary
to stay within 200 KB. Review and commit the output after processing.
