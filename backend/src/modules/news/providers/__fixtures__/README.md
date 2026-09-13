# Feed fixtures — REAL CAPTURES, and how each was obtained

Captured 2026-08-31. These exist so the parser is tested against bytes a real
publisher actually served, not against shapes I imagined. The two differ
deliberately: they exercise different real-world constructs.

## ktpress-feed.sample.xml — BYTE-ACCURATE
Captured from `https://www.ktpress.rw/feed/`, served as plain text and copied
verbatim. Trimmed to the first three `<item>` elements and closed, so it stays a
well-formed document; nothing inside the retained items was altered.

Exercises: WordPress RSS 2.0, CDATA in `dc:creator` / `category` / `description`,
HTML markup inside a CDATA description, numeric HTML entities (`&#8211;`,
`&#8217;`, `&#8220;`), namespaced elements (`dc:`, `wfw:`, `slash:`, `sy:`,
`atom:`), multiple `<category>` per item, `<guid isPermaLink="false">`, an empty
channel `<description>`, and tab/newline-heavy whitespace.

## gus-feed.sample.xml — STRUCTURALLY ACCURATE, WHITESPACE NORMALIZED
Captured from `https://stat.gov.pl/rss/en/3/3.xml`. Chrome rendered it through
its XML viewer rather than as plain text, so this is the document tree Chrome
displayed: element structure, attributes and text content are the publisher's,
but inter-element whitespace was re-flowed by the viewer. Recorded here rather
than presented as raw bytes.

Exercises: CDATA wrapping `<title>` and `<pubDate>` **with surrounding
whitespace inside the CDATA** (so values must be trimmed), a self-closing
`<description/>` on the channel, an item whose description CDATA is empty, and
an item with no `<category>` at all.

## taarifa-feed.sample.xml — STRUCTURALLY ACCURATE, TRUNCATED CONTENT
Captured 2026-08-31 from `https://taarifa.rw/feed/` through the sandbox's
fetch path, which returns the document inside a text envelope rather than as
raw socket bytes. Element structure, attributes, namespace declarations,
`pubDate` values, links, titles and `description` text are the publisher's.
Two changes are recorded here rather than hidden: only the first two `<item>`
elements were retained (and the document re-closed), and each
`<content:encoded>` body was shortened to a couple of paragraphs — the field
the connector reads is `<description>`, and those are intact. Character-level
byte fidelity of the CDATA text is NOT independently verified; treat
`ktpress-feed.sample.xml` as the byte-accurate reference.

Exercises constructs the other two fixtures do not: a `<content:encoded>`
sibling that must NOT be mistaken for `<description>`, a self-closing
namespaced `<media:thumbnail .../>`, an element carrying its own default
`xmlns=` redeclaration (`<post-id xmlns="com-wordpress:feed-additions:1">`),
a `<comments>` element whose name shares a prefix with `<content:encoded>`,
and `&#8217;` / `&#8230;` numeric entities inside CDATA.
