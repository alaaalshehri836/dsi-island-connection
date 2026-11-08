# DSI Island — Part 2: *The Connection*

An interactive pixel-art cinematic website (no video files) for the DSI university booth. The explorer from
Part 1 steps through the glowing DSI portal into an archipelago of separate islands, which become **one
connected world** through **Data Sharing** and **Interoperability**. It runs about 41 s, is narrated and
scored, and is built for vertical 9:16 screens while working on any aspect ratio.

* Part 1 (*The Discovery*) is a separate project: https://github.com/alaaalshehri836/dsi-island-discovery ·
  https://dsi-island-discovery.vercel.app
* Part 2 begins on Part 1's exact final frame. The camera, explorer pose and position, portal and lighting
  are the same values (`finalCam(1)` / `FINAL` in `js/director.js`; see `docs/final_frame.json`).

## Run locally
Static site: vanilla ES modules, no build step, no dependencies. It needs an HTTP server:
```bash
python3 -m http.server 8080
```
Open http://localhost:8080 and click **CONTINUE ADVENTURE**. That click also enables audio.

| URL | What |
|---|---|
| `index.html` | the experience |
| `index.html?voice=male` | alternative narrator (British male voice) |
| `index.html?t=23.2` | freeze any moment of the film (for review/screenshots) |

## Deploy
Connected to Vercel: every push to `main` redeploys. Settings: framework **Other**, no build command,
output directory `.` (see `vercel.json`), no environment variables. `tools/` is excluded from the
deployment (`.vercelignore`).

## Story
| Scene | Time (s) | What happens | Narration / on-screen text |
|---|---|---|---|
| 01 The portal opens | 0–8.8 | Part 1's final frame → over-the-shoulder push → close-up → the explorer reaches in, the portal flares → the camera flies through a pixel light tunnel → rising establishing shot of the archipelago | "Every island has its own world…" |
| 02 Separate worlds | 8.8–16 | aerial view → labelled reveals of the University, Hospital, Library and Data Center islands → close-up of the explorer → a data packet tries to cross the water gap and falls | "But what if these worlds could share what they know?" |
| 03 Data sharing | 16–21.5 | glowing packets with light trails travel from the University to the Hospital receiver. The data **moves**, but the Hospital shows "?" | DATA SHARING · "Data sharing allows information to move between systems." |
| 04 Interoperability | 21.5–28.5 | close-up: the incoming data does not fit the Hospital system. The DSI **shared standard** reshapes both, it clicks in, ✓ **understood**. Every island lights up, then glowing bridges form a network | INTEROPERABILITY · "Interoperability helps different systems understand and use that information." |
| 05 One connected world | 28.5–41 | crane up from the explorer at the centre to the whole network → DSI logo + DATA SHARING & INTEROPERABILITY → invitation | "Different systems. Shared data. One connected world." · invitation |

**Invitation (exact):** DATA SHARING & INTEROPERABILITY BOOTH · قاعة الجوهرة · WEDNESDAY, NOVEMBER 11 ·
9:00 AM – 2:00 PM · MEET US AT DSI!. The Arabic venue name is drawn right-to-left with a 3 KB subset of
Noto Kufi Arabic (SIL OFL 1.1, `assets/fonts/`).

## Project structure
```
index.html, css/style.css, vercel.json
js/        engine shared with Part 1: renderer.js, assets.js, audio.js, pixelfont.js, util.js,
           world.js + director.js (Part 1 island, used for the opening scene)
js/part2/  main2.js (composition, UI, loop) · director2.js (timeline) · world2.js (archipelago) ·
           renderer2.js (water / island / bridge ground shader)
assets/sprites/  explorer_sheet + portraits (the same explorer as Part 1, one 3D model), environment_atlas
                 (Part 1 island, portal, palms...), part2_atlas (buildings, beacons, data packets, badges),
                 explorer_reference_sheet.png
assets/audio/    part2/narration/{female,male}/p01–p06.mp3 + narration.json · part2/music/score_part2.mp3 ·
                 part2/sfx (portal_open, warp, data_send, data_receive, data_fail, match, bridge_form, amb_digital) ·
                 sfx/ (ambience loops, footsteps, chime, click shared with Part 1)
assets/fonts/    Noto Kufi Arabic subset + OFL licence
tools/           asset generators (Python): sprites/, gen_narration.py --part 2, gen_audio_part2.py
docs/            Part 1 final frame reference (start of Part 2)
```

## Credits & licensing
* All visuals were generated procedurally for this project. There are no third-party images.
* Music and sound effects are original, synthesised in `tools/`.
* Narration was generated with Kokoro-82M (Apache-2.0), voice `af_heart` (same settings as Part 1), with an
  alternative `bm_george`.
* Font: Noto Kufi Arabic, SIL Open Font License 1.1.
