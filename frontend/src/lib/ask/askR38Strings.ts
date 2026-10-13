/**
 * MASTER CTO R38 — copy for the Product Owner UX repair: the story dialog while stored stories are
 * held (U-2), the job entry that says listings are not connected BEFORE asking anything (U-3), the
 * place view's Ask draft (U-4), My updates' manual re-ask wording (U-5) and Saved's request vs
 * answer status (U-6). EN is the reviewed copy; PL / FR / DE / ES / PT / AR are Claude Code drafts
 * pending Claude L, like the other R3 drafts.
 */
export interface AskR38Strings {
  /* U-2 — Explain a story while stored stories are held */
  readonly storyHeldNotice: string;
  readonly storyDescribeLabel: string;
  readonly storyDescribePlaceholder: string;
  readonly storyAskAbout: string;
  readonly storyDraft: (described: string) => string;
  readonly storyNothingSent: string;
  readonly storyReplaceDraft: string;
  /* U-3 — jobs: unavailable stated first; a general career question instead */
  /** The entry cue and the job-context entry: a career QUESTION, never a vacancy search. */
  readonly jobsCue: string;
  readonly jobsNotConnected: string;
  readonly jobsCareerIntro: string;
  readonly jobsRoleLabel: string;
  readonly jobsPlaceLabel: string;
  readonly jobsStageQuestion: string;
  readonly jobsNothingSent: string;
  /* U-4 — place view */
  readonly placeAskAbout: (place: string) => string;
  readonly placeAskNote: string;
  /* U-5 — My updates */
  readonly updatesAskAgain: string;
  readonly updatesManualNote: string;
  /* U-6 — Saved */
  readonly savedRequestCompleted: string;
  readonly savedOpenToSee: string;
}

const EN: AskR38Strings = {
  storyHeldNotice: 'Stored stories can’t be listed here while source permissions are reviewed. Describe the story in your own words and Ask will explain what it can.',
  storyDescribeLabel: 'The story, in your own words',
  storyDescribePlaceholder: 'For example: the new fuel prices in Kigali',
  storyAskAbout: 'Ask about this story',
  storyDraft: (described) => `Explain this story: ${described}`,
  storyNothingSent: 'This only fills in the Ask box. Nothing is sent until you press Send.',
  storyReplaceDraft: 'Replace the Ask box text with this',
  jobsCue: 'Ask about jobs and careers',
  jobsNotConnected: 'Job listings aren’t connected to Ask yet, so Ask can’t search for vacancies.',
  jobsCareerIntro: 'You can ask a general question about working in a role or place, answered from news and public sources.',
  jobsRoleLabel: 'Role or field (optional)',
  jobsPlaceLabel: 'City or country',
  jobsStageQuestion: 'Write my question',
  jobsNothingSent: 'This only fills in the Ask box. Nothing is sent until you press Send.',
  placeAskAbout: (place) => `Ask about ${place}`,
  placeAskNote: 'Opens Ask with an unsent question. Ask answers only from reporting it is allowed to use, so it may not find recent reports for this place.',
  updatesAskAgain: 'Ask again',
  updatesManualNote: 'Nothing is checked automatically. “Ask again” runs this question once more when you choose, uses 1 question, and is compared with your last saved answer.',
  savedRequestCompleted: 'Request completed',
  savedOpenToSee: 'Open to see what is available',
};

const PL: AskR38Strings = {
  storyHeldNotice: 'Zapisane materiały nie mogą być tu wyświetlane do czasu weryfikacji praw do źródeł. Opisz historię własnymi słowami, a Ask wyjaśni, co może.',
  storyDescribeLabel: 'Historia, własnymi słowami',
  storyDescribePlaceholder: 'Na przykład: nowe ceny paliw w Kigali',
  storyAskAbout: 'Zapytaj o tę historię',
  storyDraft: (described) => `Wyjaśnij tę historię: ${described}`,
  storyNothingSent: 'To tylko wypełnia pole Ask. Nic nie zostanie wysłane, dopóki nie naciśniesz Wyślij.',
  storyReplaceDraft: 'Zastąp tekst w polu Ask tym pytaniem',
  jobsCue: 'Zapytaj o pracę i karierę',
  jobsNotConnected: 'Oferty pracy nie są jeszcze podłączone do Ask, więc Ask nie może wyszukiwać wakatów.',
  jobsCareerIntro: 'Możesz zadać ogólne pytanie o pracę w danym zawodzie lub miejscu — odpowiedź opiera się na wiadomościach i źródłach publicznych.',
  jobsRoleLabel: 'Zawód lub dziedzina (opcjonalnie)',
  jobsPlaceLabel: 'Miasto lub kraj',
  jobsStageQuestion: 'Napisz moje pytanie',
  jobsNothingSent: 'To tylko wypełnia pole Ask. Nic nie zostanie wysłane, dopóki nie naciśniesz Wyślij.',
  placeAskAbout: (place) => `Zapytaj o: ${place}`,
  placeAskNote: 'Otwiera Ask z niewysłanym pytaniem. Ask odpowiada tylko na podstawie materiałów, z których może korzystać, więc może nie znaleźć nowych doniesień o tym miejscu.',
  updatesAskAgain: 'Zapytaj ponownie',
  updatesManualNote: 'Nic nie jest sprawdzane automatycznie. „Zapytaj ponownie” uruchamia to pytanie jeszcze raz, gdy zdecydujesz, zużywa 1 pytanie i porównuje wynik z ostatnią zapisaną odpowiedzią.',
  savedRequestCompleted: 'Zapytanie zakończone',
  savedOpenToSee: 'Otwórz, aby zobaczyć, co jest dostępne',
};

const FR: AskR38Strings = {
  storyHeldNotice: 'Les articles enregistrés ne peuvent pas être listés ici pendant l’examen des droits des sources. Décrivez l’histoire avec vos mots et Ask expliquera ce qu’il peut.',
  storyDescribeLabel: 'L’histoire, avec vos mots',
  storyDescribePlaceholder: 'Par exemple : les nouveaux prix du carburant à Kigali',
  storyAskAbout: 'Poser une question sur cette histoire',
  storyDraft: (described) => `Explique cette histoire : ${described}`,
  storyNothingSent: 'Cela remplit seulement la zone Ask. Rien n’est envoyé avant que vous appuyiez sur Envoyer.',
  storyReplaceDraft: 'Remplacer le texte de la zone Ask par celui-ci',
  jobsCue: 'Questions sur l’emploi et les carrières',
  jobsNotConnected: 'Les offres d’emploi ne sont pas encore connectées à Ask : Ask ne peut pas chercher de postes.',
  jobsCareerIntro: 'Vous pouvez poser une question générale sur le travail dans un métier ou un lieu, à partir de l’actualité et de sources publiques.',
  jobsRoleLabel: 'Métier ou domaine (facultatif)',
  jobsPlaceLabel: 'Ville ou pays',
  jobsStageQuestion: 'Rédiger ma question',
  jobsNothingSent: 'Cela remplit seulement la zone Ask. Rien n’est envoyé avant que vous appuyiez sur Envoyer.',
  placeAskAbout: (place) => `Poser une question sur ${place}`,
  placeAskNote: 'Ouvre Ask avec une question non envoyée. Ask ne répond qu’à partir des articles qu’il est autorisé à utiliser ; il peut ne pas trouver d’articles récents sur ce lieu.',
  updatesAskAgain: 'Redemander',
  updatesManualNote: 'Rien n’est vérifié automatiquement. « Redemander » relance cette question quand vous le choisissez, utilise 1 question et compare le résultat à votre dernière réponse enregistrée.',
  savedRequestCompleted: 'Demande terminée',
  savedOpenToSee: 'Ouvrir pour voir ce qui est disponible',
};

const DE: AskR38Strings = {
  storyHeldNotice: 'Gespeicherte Meldungen können hier nicht angezeigt werden, solange Quellenrechte geprüft werden. Beschreiben Sie die Geschichte mit eigenen Worten, Ask erklärt, was es kann.',
  storyDescribeLabel: 'Die Geschichte, mit eigenen Worten',
  storyDescribePlaceholder: 'Zum Beispiel: die neuen Kraftstoffpreise in Kigali',
  storyAskAbout: 'Nach dieser Geschichte fragen',
  storyDraft: (described) => `Erkläre diese Geschichte: ${described}`,
  storyNothingSent: 'Das füllt nur das Ask-Feld. Nichts wird gesendet, bis Sie auf Senden tippen.',
  storyReplaceDraft: 'Text im Ask-Feld hiermit ersetzen',
  jobsCue: 'Fragen zu Arbeit und Karriere',
  jobsNotConnected: 'Stellenangebote sind noch nicht mit Ask verbunden, daher kann Ask keine offenen Stellen suchen.',
  jobsCareerIntro: 'Sie können eine allgemeine Frage zur Arbeit in einem Beruf oder an einem Ort stellen, beantwortet aus Nachrichten und öffentlichen Quellen.',
  jobsRoleLabel: 'Beruf oder Bereich (optional)',
  jobsPlaceLabel: 'Stadt oder Land',
  jobsStageQuestion: 'Meine Frage formulieren',
  jobsNothingSent: 'Das füllt nur das Ask-Feld. Nichts wird gesendet, bis Sie auf Senden tippen.',
  placeAskAbout: (place) => `Nach ${place} fragen`,
  placeAskNote: 'Öffnet Ask mit einer nicht gesendeten Frage. Ask antwortet nur aus Berichten, die es verwenden darf, und findet daher eventuell keine neuen Berichte zu diesem Ort.',
  updatesAskAgain: 'Erneut fragen',
  updatesManualNote: 'Nichts wird automatisch geprüft. „Erneut fragen“ stellt diese Frage noch einmal, wenn Sie es wählen, verbraucht 1 Frage und vergleicht mit Ihrer letzten gespeicherten Antwort.',
  savedRequestCompleted: 'Anfrage abgeschlossen',
  savedOpenToSee: 'Öffnen, um zu sehen, was verfügbar ist',
};

const ES: AskR38Strings = {
  storyHeldNotice: 'Las noticias guardadas no se pueden mostrar aquí mientras se revisan los permisos de las fuentes. Describe la historia con tus palabras y Ask explicará lo que pueda.',
  storyDescribeLabel: 'La historia, con tus palabras',
  storyDescribePlaceholder: 'Por ejemplo: los nuevos precios del combustible en Kigali',
  storyAskAbout: 'Preguntar sobre esta historia',
  storyDraft: (described) => `Explica esta historia: ${described}`,
  storyNothingSent: 'Esto solo rellena el cuadro de Ask. No se envía nada hasta que pulses Enviar.',
  storyReplaceDraft: 'Sustituir el texto del cuadro de Ask por este',
  jobsCue: 'Preguntar sobre empleo y carreras',
  jobsNotConnected: 'Las ofertas de empleo aún no están conectadas a Ask, así que Ask no puede buscar vacantes.',
  jobsCareerIntro: 'Puedes hacer una pregunta general sobre trabajar en un puesto o lugar, respondida con noticias y fuentes públicas.',
  jobsRoleLabel: 'Puesto o área (opcional)',
  jobsPlaceLabel: 'Ciudad o país',
  jobsStageQuestion: 'Escribir mi pregunta',
  jobsNothingSent: 'Esto solo rellena el cuadro de Ask. No se envía nada hasta que pulses Enviar.',
  placeAskAbout: (place) => `Preguntar sobre ${place}`,
  placeAskNote: 'Abre Ask con una pregunta sin enviar. Ask solo responde con noticias que puede usar, así que puede no encontrar noticias recientes de este lugar.',
  updatesAskAgain: 'Volver a preguntar',
  updatesManualNote: 'Nada se comprueba automáticamente. «Volver a preguntar» repite esta pregunta cuando lo decides, usa 1 pregunta y se compara con tu última respuesta guardada.',
  savedRequestCompleted: 'Solicitud completada',
  savedOpenToSee: 'Abrir para ver lo disponible',
};

const PT: AskR38Strings = {
  storyHeldNotice: 'As notícias guardadas não podem ser listadas aqui enquanto as permissões das fontes são revistas. Descreva a história por palavras suas e o Ask explicará o que puder.',
  storyDescribeLabel: 'A história, por palavras suas',
  storyDescribePlaceholder: 'Por exemplo: os novos preços dos combustíveis em Kigali',
  storyAskAbout: 'Perguntar sobre esta história',
  storyDraft: (described) => `Explica esta história: ${described}`,
  storyNothingSent: 'Isto só preenche a caixa do Ask. Nada é enviado até tocar em Enviar.',
  storyReplaceDraft: 'Substituir o texto da caixa do Ask por este',
  jobsCue: 'Perguntar sobre emprego e carreiras',
  jobsNotConnected: 'As ofertas de emprego ainda não estão ligadas ao Ask, por isso o Ask não pode procurar vagas.',
  jobsCareerIntro: 'Pode fazer uma pergunta geral sobre trabalhar numa função ou num lugar, respondida com notícias e fontes públicas.',
  jobsRoleLabel: 'Função ou área (opcional)',
  jobsPlaceLabel: 'Cidade ou país',
  jobsStageQuestion: 'Escrever a minha pergunta',
  jobsNothingSent: 'Isto só preenche a caixa do Ask. Nada é enviado até tocar em Enviar.',
  placeAskAbout: (place) => `Perguntar sobre ${place}`,
  placeAskNote: 'Abre o Ask com uma pergunta por enviar. O Ask só responde com notícias que pode usar, por isso pode não encontrar notícias recentes deste lugar.',
  updatesAskAgain: 'Perguntar de novo',
  updatesManualNote: 'Nada é verificado automaticamente. «Perguntar de novo» repete esta pergunta quando escolher, usa 1 pergunta e compara com a sua última resposta guardada.',
  savedRequestCompleted: 'Pedido concluído',
  savedOpenToSee: 'Abrir para ver o que está disponível',
};

const AR: AskR38Strings = {
  storyHeldNotice: 'لا يمكن عرض القصص المحفوظة هنا أثناء مراجعة أذونات المصادر. صِف القصة بكلماتك وسيشرح Ask ما يستطيع.',
  storyDescribeLabel: 'القصة بكلماتك',
  storyDescribePlaceholder: 'مثلاً: أسعار الوقود الجديدة في كيغالي',
  storyAskAbout: 'اسأل عن هذه القصة',
  storyDraft: (described) => `اشرح هذه القصة: ${described}`,
  storyNothingSent: 'هذا يملأ مربع Ask فقط. لا يُرسل شيء حتى تضغط إرسال.',
  storyReplaceDraft: 'استبدل نص مربع Ask بهذا',
  jobsCue: 'اسأل عن العمل والمسار المهني',
  jobsNotConnected: 'عروض العمل غير مرتبطة بـ Ask بعد، لذلك لا يستطيع Ask البحث عن وظائف شاغرة.',
  jobsCareerIntro: 'يمكنك طرح سؤال عام عن العمل في مهنة أو مكان، تُجاب عنه من الأخبار والمصادر العامة.',
  jobsRoleLabel: 'المهنة أو المجال (اختياري)',
  jobsPlaceLabel: 'المدينة أو البلد',
  jobsStageQuestion: 'اكتب سؤالي',
  jobsNothingSent: 'هذا يملأ مربع Ask فقط. لا يُرسل شيء حتى تضغط إرسال.',
  placeAskAbout: (place) => `اسأل عن ${place}`,
  placeAskNote: 'يفتح Ask بسؤال غير مُرسل. يجيب Ask فقط من التقارير المسموح له باستخدامها، لذا قد لا يجد تقارير حديثة عن هذا المكان.',
  updatesAskAgain: 'اسأل مجدداً',
  updatesManualNote: 'لا يُفحص شيء تلقائياً. «اسأل مجدداً» يعيد هذا السؤال عندما تختار، ويستهلك سؤالاً واحداً، ويُقارن بآخر إجابة محفوظة لك.',
  savedRequestCompleted: 'اكتمل الطلب',
  savedOpenToSee: 'افتح لترى ما هو متاح',
};

const BY_LOCALE: Readonly<Record<string, AskR38Strings>> = { en: EN, pl: PL, fr: FR, de: DE, es: ES, pt: PT, ar: AR };

export function askR38Strings(locale: string): AskR38Strings {
  return BY_LOCALE[locale] ?? EN;
}
