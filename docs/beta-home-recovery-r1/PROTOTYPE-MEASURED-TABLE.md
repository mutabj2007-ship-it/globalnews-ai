# PROTOTYPE MEASURED TABLE — DESKTOP PREMIUM VISUAL PASS §3 + §11

Source of truth: `PO-DESKTOP-HOME-BETA-LAUNCH.jpg`, 1280 x 853.
Every number below was read out of the pixels (edge-run detection on column/row
medians; colours are the median of a 5x5 patch, or the brightest pixel inside a
glyph box where the target is text). Nothing here was estimated by eye.

## 1. PAGE FRAME

| Item | Measured |
|---|---|
| Viewport | 1280 x 853 |
| Content left edge | x = 30 |
| Content right edge | x = 1257 |
| Left column | x 30 -> 865  (836 wide) |
| Column gap | 25 px |
| Right rail | x 890 -> 1257  (368 wide) |
| Header height | 62 px (fill rows 0..61) |

## 2. HERO (header bottom 62 -> section heading 355)

| Item | Measured |
|---|---|
| Headline line 1 cap box | y 87 -> 117 (cap height 30) -> font-size ~42 px, weight 800 |
| Headline line pitch | 45 px (line-height ~1.07) |
| Sub-headline | y 187 -> 197, font-size ~15 px |
| Search field | x 31 -> 537 (506 wide), y 218 -> 259 (42 tall) |
| Search submit circle | ~28 px diameter, inset ~8 px from field right |
| Action tiles | y 271 -> 330 (60 tall); tile 1 x 30 -> 224 (194 wide); gap 11 px |
| Whole hero block | ~293 px tall |

## 3. SECTION HEADINGS

| Item | Measured |
|---|---|
| "What's happening now" cap box | y 360 -> 379 (cap 20) -> font-size ~27 px, weight 700 |
| Standfirst | y 384 -> 396 -> font-size ~12.5 px |
| Heading -> first card | 406 - 380 = 26 px |

## 4. STORY CARDS

| Item | Measured |
|---|---|
| Card runs | (30,231) (242,443) (453,653) (665,865) |
| Card width | 201-202 px |
| Card gap | 10 px (pitch 211.7) |
| Card top / bottom | y 406 -> 618 |
| Card height | 212 px |
| Image band | y 406 -> 498, full-bleed -> 91 px tall |
| Image : text | 91 : 121  =  43% : 57% |
| Corner radius | ~12 px |
| Inner padding | 12-13 px |
| Category chip | x 41 -> 96, y 417 -> 435 -> 55 x 18, radius ~5 |
| Elapsed-time label | right-aligned, ~13 px inset, y ~425 |
| Headline | 2 lines, font ~15 px / line-height ~16.5 px, starts y ~505 |
| Standfirst | 3 lines, font ~11.5 px / line-height ~14 px |
| Meta row | font ~10.5 px, baseline y ~604 |

## 5. TOPIC CARDS

| Item | Measured |
|---|---|
| Card runs | (30,166) (176,311) (320,455) (465,600) (609,745) (755,891) |
| Card width | 136 px |
| Card gap | 9 px (pitch 145) |
| Card top / bottom | y 678 -> 797 |
| Card height | 119 px |
| Icon | bare glyph, ~25 x 26 px, inset 15 px left / 13 px top. NO tile box. |
| Label | font ~15 px, weight 700 |
| Description | 2 lines, font ~11.5 px |
| Arrow | filled circle 24 px diameter, inset ~9 px from right and bottom |

## 6. RIGHT RAIL

| Item | Measured |
|---|---|
| Map card | x 890 -> 1257, y 356 -> 595  (368 x 240) |
| Map card title | font ~15 px, weight 600, y ~377 |
| Map inner box | inset 13 px, height ~153 px, radius ~8 |
| Legend row | y ~574; dots 10 px diameter with glow; labels ~12 px |
| Open-in icon | ~18 px square outline, top-right |
| Card gap (map -> ask) | 13 px |
| Ask card | x 911 -> 1257, y 609 -> 799  (347 x 191) |
| Ask prompt rows | 32 px tall, 8 px gap, radius ~8 |

NOTE — the prototype draws the Ask card inset 21 px from the map card's left
edge. Both cards are otherwise the same rail. Reproducing that asymmetry would
read as a layout defect in a live product, so both cards are aligned to x = 890
and this is the ONE geometry normalisation in this pass. Declared, not silent.

## 7. PREMIUM CARD

| Item | Measured |
|---|---|
| Card | x 1020 -> 1252, y 75 -> 309  (232 x 234) |
| Crown | ~36 x 32 px, gold, glowing |
| Title | 2 lines, font ~16 px, weight 700 |
| Capability rows | pitch 28 px; check ring ~17 px diameter |
| CTA | x 1041 -> 1235, y 270 -> 305  (194 x 35), radius ~10 |
| Footnote | ~10 px, centred, below the CTA |

## 8. COLOUR SAMPLES (§11 — sampled, not substituted)

### Page / chrome
| Token | Sampled |
|---|---|
| Page background | `#010a19` (also `#020b1a`, `#010c1c`) |
| Header fill | `#03152d` |
| Header bottom rule | `#003a6a` |
| Footer fill | `#02101d` |

### Hero
| Token | Sampled |
|---|---|
| Hero deep navy | `#001729` |
| Hero mid navy | `#041d3b` |
| Hero lift near globe | `#023454` / `#0c3043` |
| Headline white | `#ffffff` |
| Accent "what's" (sky) | `#5abff5` |
| Accent "changing." (aqua) | `#5df9e1` -> `#61fcea` |
| Sub-headline | `#e3f4ff` |
| Search fill | `#17335b` -> `#112750` |
| Search border | `#102950` |
| Tile 1 blue | `#0a6bd6` -> `#0c42a2` |
| Tile 2 violet | `#412d9f` -> `#1f328a` |
| Tile 3 emerald | `#0b8d6a` -> `#038866` |

### Story cards
| Token | Sampled |
|---|---|
| Card fill top | `#082038` |
| Card fill bottom | `#02152b` |
| Card hairline | `#010d1d` — DARKER than the fill, not a bright outline |
| Headline text | `#fffeff` |
| Standfirst text | `#b3c5db` |
| Meta text | `#c5d5ec` |

### Category chips
| Category | Fill | Border | Text |
|---|---|---|---|
| Energy | `#033a3e` | `#054e55` | `#8ce1da` |
| Security | `#2d1728` | `#3d131d` | `#de979f` |
| Economy | `#302977` | `#251872` | `#fcfbff` |
| Humanitarian | solid `#ecae4c` | `#f5b94b` | dark |

### Topic cards (gradient top-left -> bottom-right)
| Topic | From | To | Icon |
|---|---|---|---|
| World | `#032f6f` | `#061831` | `#6ce6ff` |
| Economy | `#1a1a4a` | `#09182d` | `#b296fc` |
| Energy | `#003831` | `#051f25` | `#1ffcc9` |
| Security | `#391525` | `#141522` | `#ff8d97` |
| Humanitarian | `#4a2d14` | `#161a20` | `#ffc762` |
| Markets | `#131c2b` | `#091626` | `#a8bfd1` |

### Rail
| Token | Sampled |
|---|---|
| Map card fill | `#05172d` |
| Map inner box | `#021124` |
| Ask card fill | `#031428` |
| Ask row fill | `#12263f` |
| Ask row border | `#122840` |
| Legend Energy | `#36e8c4` |
| Legend Conflict | `#f2666f` |
| Legend Humanitarian | `#ffca53` |
| Legend Economy | `#a36ef0` |

### Premium
| Token | Sampled |
|---|---|
| Card fill | `#090d19` with warm top-left glow `#483c23` |
| Crown / title gold | `#ffe198` |
| CTA gold | `#ebc267` -> `#dcae55` |
| CTA label | `#452f0a` |

## 9. THE THREE FINDINGS THAT DRIVE THIS PASS

1. **Borders.** The prototype's card hairline (`#010d1d`) is DARKER than the
   card fill (`#082038`). Separation comes from the fill and an outer shadow,
   not from a bright rule. The shipped implementation uses
   `border-[1.5px] border-white/[0.13]` — a bright outline. That single choice
   is most of the "internal engineering dashboard" reading in §2.
2. **Saturation.** Every shipped surface sits in the grey-navy family
   (`#0e1a2a`). Every sampled prototype surface is markedly bluer and, on the
   topic cards, markedly more chromatic (`#032f6f`, `#003831`, `#391525`).
3. **Type scale.** Section headings measure ~27 px against a shipped ~20 px;
   story headlines ~15 px; topic labels ~15 px. §8 is a measurement, not taste.
