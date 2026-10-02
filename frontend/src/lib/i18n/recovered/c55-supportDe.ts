import type { RecoveredCatalogue as SupportDictionary } from './recoveredCatalogue';

/**
 * LANG-CATALOG-IMPLEMENT-1 - Deutsch (`de`) Support surface dictionary.
 *
 * AUTHORED BY THE LOCALISATION LANE, NOT HERE. Every string below is the
 * approved value from `L-LANG-CATALOG-1 (R0)` / `03-CATALOGUE-DE.json`
 * (sha256 `015fae1cdbb1521f...`), transcribed mechanically in `en` key
 * order so the two files diff line for line. No value was invented, softened,
 * shortened or re-worded at implementation time, and no key was omitted:
 * completeness is asserted by test, not by inspection.
 *
 * IDENTIFIERS ARE NOT TRANSLATED, exactly as in `adminPl`/`supportPl`: screen
 * codes, probe statuses, pipeline modes, window labels and the `GN-` support
 * reference prefix are protocol tokens a person reads aloud and types back.
 * Their EXPLANATIONS are translated.
 *
 * A REGISTERED DICTIONARY IS NOT A SELECTABLE LOCALE. `SELECTABLE_LOCALES`
 * is unchanged at `['en', 'pl']`. Publishing a catalogue makes this locale
 * expressible; it does not make it offered, does not qualify it for Support,
 * and says nothing about source-intelligence maturity.
 *
 * AMB-DE-01 resolved in R2: Intelligence is `Lagebild` throughout, and it compounds (`Wirtschaftslagebild`, `Konfliktlagebild`).
 */

/**
 * A SUPPORT DICTIONARY IS NOT A SUPPORT LANGUAGE. These strings let the
 * Support surface RENDER in Deutsch; they do not make Deutsch a
 * deterministic Support language. Qualification stays with the backend
 * (`F_PUBLISHED_QUALIFIED = ['en', 'pl']`) and dictionary presence is never
 * the detector - SUPPORT-LANG-7-D16.
 */
export const supportDe: SupportDictionary = {
  meta: {
    title: 'Support — GlobalNews AI',
    description: 'Öffnen Sie eine Support-Anfrage und verfolgen Sie deren Antworten.',
  },
  heading: 'Support',
  intro: 'Stellen Sie eine Frage, melden Sie ein Problem oder senden Sie Feedback. Sie sehen jede Antwort hier — wir antworten nie anderswo.',
  signedOut: {
    title: 'Melden Sie sich an, um eine Support-Anfrage zu öffnen',
    body: 'Support-Anfragen gehören zu einem Konto, damit nur Sie die Antworten lesen können. GlobalNews AI selbst funktioniert ohne Konto.',
    signIn: 'Mit Google anmelden',
  },
  signedOutHelp: {
    title: 'Wenn Sie sich nicht anmelden können, beginnen Sie hier',
    intro: 'Eine Support-Anfrage braucht ein Konto, und wenn genau die Anmeldung scheitert, ist das Öffnen einer Anfrage für Sie noch nicht möglich. Dies sind die Ursachen, die das bei GlobalNews AI tatsächlich hervorrufen. Wenn keine davon auf Sie zutrifft, liegt der Fehler bei uns und nicht bei Ihnen.',
    cannotSignIn: {
      title: 'Die Anmeldung wird nicht abgeschlossen',
      body: 'Die Anmeldung läuft über Google und kommt in einem Umlauf zu uns zurück. Wenn Sie auf der Startseite von GlobalNews AI landen statt dort, wo Sie begonnen haben, wurde der Umlauf nicht abgeschlossen und keine Sitzung angelegt — es lohnt sich, es zuerst noch einmal über die Schaltfläche Anmelden zu versuchen, denn ein einzelner unterbrochener Versuch ist die häufigste Ursache.',
    },
    sessionIssue: {
      title: 'Sie waren angemeldet und sind es nun nicht mehr',
      body: 'Ihre Sitzung liegt in einem Cookie, das GlobalNews AI selbst setzt. Ein Browser, der Cookies für diese Seite blockiert oder löscht, ein inzwischen geschlossenes privates Fenster oder ein anderer Browser oder ein anderes Gerät erscheinen alle als Abmeldung — das Konto ist unberührt, die Sitzung ist schlicht nicht da. Cookies für diese Seite zu erlauben und sich erneut anzumelden stellt sie wieder her.',
    },
    accountAccess: {
      title: 'Sie sind mit dem falschen Konto angemeldet',
      body: 'GlobalNews AI hat kein eigenes Passwort; Sie sind, wen Google angibt. Wenn Sie bei mehreren Google-Konten angemeldet sind, ist das Konto, mit dem Sie hier landen, vielleicht nicht das, zu dem Ihre Anfragen gehören. Abmelden und erneut anmelden lässt Sie wählen, und Ihre Anfragen liegen unter dem Konto, das sie geöffnet hat.',
    },
    securityIssue: {
      title: 'Etwas am Zugriff kommt Ihnen falsch vor',
      body: 'Wenn Sie glauben, dass jemand anderes auf Ihr Konto zugegriffen hat, oder Ihnen etwas gezeigt wird, das Ihnen nicht gehört, behandeln Sie das als dringend und warten Sie nicht auf eine Antwort hier. Melden Sie sich überall von GlobalNews AI ab und sichern Sie dann das Google-Konto selbst, denn das ist die Tür — unseres folgt ihr nur.',
    },
    stillStuck: 'Wenn nichts davon Sie hineinbringt, liegt der Fehler bei uns und sollte gemeldet werden, sobald es geht — öffnen Sie von dieser Seite aus eine Anfrage, sobald Sie angemeldet sind, und schildern Sie, was Sie gesehen haben, einschließlich der Schritte oben, die Sie versucht haben.',
  },
  list: {
    heading: 'Ihre Anfragen',
    newRequest: 'Neue Anfrage',
    emptyTitle: 'Sie haben noch keine Anfrage geöffnet',
    emptyBody: 'Sobald Sie eine öffnen, erscheint sie hier, mit allen zugehörigen Antworten.',
    errorTitle: 'Ihre Anfragen konnten nicht geladen werden',
    errorBody: 'Die Anfrage ist fehlgeschlagen. Es wird nichts angezeigt statt einer unvollständigen Liste — falls Sie offene Anfragen haben, sind sie weiterhin vorhanden.',
    loading: 'Ihre Anfragen werden geladen…',
    retry: 'Erneut versuchen',
    messageCount: 'Nachrichten',
    opened: 'Geöffnet',
    lastActivity: 'Letzte Aktivität',
  },
  form: {
    heading: 'Neue Support-Anfrage',
    categoryLabel: 'Worum geht es?',
    categoryPlaceholder: 'Bitte auswählen',
    subjectLabel: 'Betreff',
    subjectPlaceholder: 'Eine kurze Zusammenfassung',
    messageLabel: 'Nachricht',
    messagePlaceholder: 'Was ist passiert, und was hatten Sie erwartet?',
    submit: 'Anfrage senden',
    submitting: 'Wird gesendet…',
    sendingNotice: 'Ihre Anfrage wird gesendet. Sie erscheint hier, sobald sie gespeichert ist.',
    cancel: 'Abbrechen',
    charactersRemaining: 'Zeichen übrig',
    tooShortSubject: 'Bitte geben Sie dem Betreff mindestens 3 Zeichen.',
    tooShortMessage: 'Bitte beschreiben Sie das Problem mit mindestens 10 Zeichen.',
    categoryRequired: 'Bitte wählen Sie aus, worum es geht.',
  },
  thread: {
    back: 'Alle Anfragen',
    reference: 'Referenz',
    replyLabel: 'Antworten',
    replyPlaceholder: 'Zu dieser Anfrage hinzufügen',
    send: 'Antwort senden',
    sending: 'Wird gesendet…',
    tooShortReply: 'Bitte schreiben Sie mindestens 2 Zeichen.',
    errorTitle: 'Diese Anfrage konnte nicht geladen werden',
    errorBody: 'Die Anfrage ist fehlgeschlagen. Es wird nichts angezeigt statt eines Teils der Konversation.',
    loading: 'Wird geladen…',
    resolvedNotice: 'Diese Anfrage ist gelöst. Das bezieht sich auf die Anfrage selbst — es ist keine Bestätigung, dass ein von Ihnen gemeldetes Problem behoben wurde, sofern das nicht in einer Antwort steht. Eine Antwort darauf öffnet sie wieder, und jemand sieht sie erneut an.',
  },
  errors: {
    sendFailedTitle: 'Ihre Nachricht wurde nicht gesendet',
    sendFailedBody: 'Es wurde nichts gesendet. Entweder kam dies zu kurz nach Ihrer letzten Nachricht, oder Sie haben bereits die maximale Zahl offener Anfragen — eine davon zu lösen oder zu schließen lässt Sie eine weitere öffnen.',
    genericTitle: 'Etwas ist schiefgelaufen',
    genericBody: 'Es wurde nichts gesendet. Bitte versuchen Sie es gleich noch einmal.',
  },
  categories: {
    NEWS_QUESTION: 'Eine Frage zu einer Meldung',
    BUG_REPORT: 'Etwas funktioniert nicht',
    CONTENT_REPORT: 'Inhalt melden',
    FEEDBACK: 'Feedback oder ein Vorschlag',
    ABUSE_REPORT: 'Missbrauch melden',
    ACCOUNT_PROBLEM: 'Ein Problem mit meinem Konto',
    OTHER: 'Etwas anderes',
  },
  statuses: {
    OPEN: 'Öffnen',
    AWAITING_USER: 'Wartet auf Sie',
    AWAITING_ADMIN: 'Bei unserem Team',
    RESOLVED: 'Gelöst',
  },
  authors: {
    USER: 'Sie',
    ADMIN: 'GlobalNews AI Support',
    SYSTEM_AI: 'GlobalNews AI Support-Agent · automatisiert',
  },
  automaticAnswers: {
    notice: 'Automatische Antworten werden nur auf Englisch und Polnisch verfasst. Ihre Anfrage geht stattdessen an einen Menschen.',
    ariaNotice: 'Automatische Antworten auf dieser Seite werden nur auf Englisch und Polnisch verfasst. Da Sie in einer anderen Sprache schreiben, gibt es überhaupt keine automatische Antwort — Ihre Anfrage geht direkt an einen Menschen, den langsameren und sichereren Weg. Ihre gewählte Sprache wurde nicht geändert.',
  },
};
