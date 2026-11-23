# SayDo

**Say your to-dos the way you'd tell a friend, in English, Hindi or Hinglish.** SayDo turns "pay the electricity bill before the 10th, call mom Sunday evening, and every second Saturday get the car washed" into three tasks with the right dates, times and repeat rules.

Live: _add the Vercel link here_ · How well it works: _link_/#how-it-works

## What it does

- **Hold to speak, or type.** Speech recognition runs in the browser. Firefox, which has none, records audio and sends it to Whisper on Groq's free tier.
- **See what was understood as you speak.** Dates and times are highlighted yellow, repeats green and priority pink in the live transcript.
- **Check before saving.** Every task appears on a card with its date, time, repeat rule and priority, ready to fix with a tap.
- **Talk to your list.** "What's on today?", "mark milk done", "move the bill to Friday", "delete the plumber task".
- **Daily briefing.** One tap reads out today's tasks, what's overdue and what's important, using the device's own voice.
- **Repeats done right.** "Every second Saturday" is stored as a calendar rule (`FREQ=MONTHLY;BYDAY=2SA`); ticking a repeating task moves it to its next date.
- **Private by default.** Tasks are kept in the browser. Words leave the device only when the AI parser is needed.

## How it's built

```
speech ──▶ on-device parser ──▶ confident? ──yes──▶ review cards ──▶ saved
                                  │
                                  no
                                  ▼
                         /api/parse (Gemini free tier → Groq backup)
                         strict schema check · code works out repeat dates
```

- **On-device parser** (`src/core/parse.ts`): rules for English and Hinglish on top of [chrono-node](https://github.com/wanasit/chrono). It splits a phrase into tasks, reads dates, times, repeats and priority, and scores its own confidence. It runs in about 3 ms and costs nothing.
- **Routing** (`src/core/router.ts`): anything under 0.7 confidence (Devanagari, passive wording, very long phrases) goes to the AI parser.
- **AI parser** (`api/parse.ts`): a Vercel Edge Function that asks Gemini for JSON, falls back to Groq if Gemini fails or is out of quota, validates the reply with zod, and recomputes repeat dates in code so the model never does calendar arithmetic.
- **Zero cost:** free tiers only, no card on either account. If both are unavailable, the on-device result is used and the app says so.

## Evals

Two hand-checked test sets, scored as if spoken on Monday 23 Nov 2026, 10:00 in India. A task counts as right only if its wording, date, time, repeat rule and priority all match.

| Set | Phrases | On device | Handled on device |
| --- | --- | --- | --- |
| Test set (used while building the parser) | 96 | 97.9% | 93.8% (100% right when confident) |
| Unseen set (written afterwards, never used for tuning) | 40 | 95% | 100% (95% right when confident) |

The unseen set is the honest number. Its two misses are real gaps: "repot" isn't in the verb list, so two tasks stayed joined, and "6 baje uthna" (wake up at 6) was read as 6 pm. Full results, including every miss, are on the app's How well it works page.

```bash
npm run eval          # on-device parser, both sets → public/evals/device.json
npm run eval:fails    # list every miss
npm run eval:ai -- https://your-app.vercel.app   # AI parser via the deployed API → public/evals/ai.json
```

## Run it

```bash
npm install
npm run dev
```

For the AI parser and Firefox speech, deploy to Vercel and set `GEMINI_API_KEY` (aistudio.google.com) and `GROQ_API_KEY` (console.groq.com). Both are free.

Built by [Shrey Gupta](https://shreygupta-three.vercel.app).
