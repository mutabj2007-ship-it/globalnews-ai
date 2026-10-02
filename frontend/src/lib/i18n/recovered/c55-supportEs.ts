import type { RecoveredCatalogue as SupportDictionary } from './recoveredCatalogue';

/**
 * LANG-CATALOG-IMPLEMENT-1 - Español (`es`) Support surface dictionary.
 *
 * AUTHORED BY THE LOCALISATION LANE, NOT HERE. Every string below is the
 * approved value from `L-LANG-CATALOG-1 (R0)` / `04-CATALOGUE-ES.json`
 * (sha256 `dfd708038745ba2b...`), transcribed mechanically in `en` key
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
 * Spanish supplies the CLDR `many` category, which English does not have; `pf()` is what lets that widen the field rather than fail the type.
 */

/**
 * A SUPPORT DICTIONARY IS NOT A SUPPORT LANGUAGE. These strings let the
 * Support surface RENDER in Español; they do not make Español a
 * deterministic Support language. Qualification stays with the backend
 * (`F_PUBLISHED_QUALIFIED = ['en', 'pl']`) and dictionary presence is never
 * the detector - SUPPORT-LANG-7-D16.
 */
export const supportEs: SupportDictionary = {
  meta: {
    title: 'Soporte — GlobalNews AI',
    description: 'Abra una solicitud de soporte y siga sus respuestas.',
  },
  heading: 'Soporte',
  intro: 'Haga una pregunta, informe de un problema o envíe comentarios. Verá todas las respuestas aquí: nunca respondemos en otro sitio.',
  signedOut: {
    title: 'Inicie sesión para abrir una solicitud de soporte',
    body: 'Las solicitudes de soporte pertenecen a una cuenta para que solo usted pueda leer las respuestas. GlobalNews AI en sí funciona sin cuenta.',
    signIn: 'Iniciar sesión con Google',
  },
  signedOutHelp: {
    title: 'Si no puede iniciar sesión, empiece por aquí',
    intro: 'Una solicitud de soporte necesita una cuenta, así que si lo que falla es precisamente el inicio de sesión, abrir una solicitud todavía no está a su alcance. Estas son las causas que realmente producen esto en GlobalNews AI. Si ninguna es la suya, el fallo es nuestro y no suyo.',
    cannotSignIn: {
      title: 'El inicio de sesión no se completa',
      body: 'El inicio de sesión pasa por Google y vuelve a nosotros en una sola ida y vuelta. Si acaba en la página de inicio de GlobalNews AI en lugar de donde empezó, la ida y vuelta no terminó y no se creó ninguna sesión: merece la pena intentarlo una vez más desde el botón Iniciar sesión antes que nada, porque un único intento interrumpido es la causa más frecuente.',
    },
    sessionIssue: {
      title: 'Tenía la sesión iniciada y ya no la tiene',
      body: 'Su sesión se guarda en una cookie que establece el propio GlobalNews AI. Un navegador configurado para bloquear o borrar las cookies de este sitio, una ventana privada ya cerrada, u otro navegador o dispositivo se presentarán todos como sesión cerrada: la cuenta está intacta, la sesión sencillamente no está. Permitir las cookies de este sitio y volver a iniciar sesión la restablece.',
    },
    accountAccess: {
      title: 'Ha iniciado sesión con la cuenta equivocada',
      body: 'GlobalNews AI no tiene contraseña propia; usted es quien Google dice que es. Si ha iniciado sesión en más de una cuenta de Google, aquella con la que llega aquí puede no ser aquella a la que pertenecen sus solicitudes. Cerrar sesión y volver a entrar le permite elegir, y sus solicitudes estarán bajo la cuenta que las abrió.',
    },
    securityIssue: {
      title: 'Algo del acceso le parece incorrecto',
      body: 'Si cree que otra persona ha accedido a su cuenta, o que se le está mostrando algo que no le pertenece, trátelo como urgente y no espere una respuesta aquí. Cierre sesión en GlobalNews AI en todos los sitios donde la tenga iniciada y asegure después la propia cuenta de Google, porque esa es la puerta: la nuestra solo la sigue.',
    },
    stillStuck: 'Si nada de esto le permite entrar, el fallo es nuestro y conviene informarlo en cuanto pueda: abra una solicitud desde esta página una vez que haya iniciado sesión y cuente qué vio, indicando cuáles de los pasos anteriores probó.',
  },
  list: {
    heading: 'Sus solicitudes',
    newRequest: 'Nueva solicitud',
    emptyTitle: 'Todavía no ha abierto ninguna solicitud',
    emptyBody: 'Cuando abra una, aparecerá aquí, con todas sus respuestas adjuntas.',
    errorTitle: 'No se han podido cargar sus solicitudes',
    errorBody: 'La solicitud falló. No se muestra nada en lugar de una lista parcial: si tiene solicitudes abiertas, siguen ahí.',
    loading: 'Cargando sus solicitudes…',
    retry: 'Reintentar',
    messageCount: 'mensajes',
    opened: 'Abierta',
    lastActivity: 'Última actividad',
  },
  form: {
    heading: 'Nueva solicitud de soporte',
    categoryLabel: '¿Sobre qué trata esto?',
    categoryPlaceholder: 'Elija una',
    subjectLabel: 'Asunto',
    subjectPlaceholder: 'Un breve resumen',
    messageLabel: 'Mensaje',
    messagePlaceholder: '¿Qué ocurrió y qué esperaba?',
    submit: 'Enviar solicitud',
    submitting: 'Enviando…',
    sendingNotice: 'Enviando su solicitud. Aparecerá aquí una vez guardada.',
    cancel: 'Cancelar',
    charactersRemaining: 'caracteres restantes',
    tooShortSubject: 'Dé al asunto al menos 3 caracteres.',
    tooShortMessage: 'Describa el problema con al menos 10 caracteres.',
    categoryRequired: 'Elija sobre qué trata esto.',
  },
  thread: {
    back: 'Todas las solicitudes',
    reference: 'Referencia',
    replyLabel: 'Responder',
    replyPlaceholder: 'Añadir a esta solicitud',
    send: 'Enviar respuesta',
    sending: 'Enviando…',
    tooShortReply: 'Escriba al menos 2 caracteres.',
    errorTitle: 'No se ha podido cargar esta solicitud',
    errorBody: 'La solicitud falló. No se muestra nada en lugar de parte de una conversación.',
    loading: 'Cargando…',
    resolvedNotice: 'Esta solicitud está resuelta. Eso se refiere a la solicitud en sí: no es la confirmación de que un problema que usted notificó se haya corregido, salvo que una respuesta lo diga. Responder a ella la reabrirá y alguien volverá a revisarla.',
  },
  errors: {
    sendFailedTitle: 'Su mensaje no se envió',
    sendFailedBody: 'No se envió nada. O este mensaje llegó demasiado pronto tras el anterior, o ya tiene el número máximo de solicitudes abiertas: resolver o cerrar una le permitirá abrir otra.',
    genericTitle: 'Algo ha salido mal',
    genericBody: 'No se envió nada. Vuelva a intentarlo en un momento.',
  },
  categories: {
    NEWS_QUESTION: 'Una pregunta sobre una noticia',
    BUG_REPORT: 'Algo no funciona',
    CONTENT_REPORT: 'Denunciar contenido',
    FEEDBACK: 'Comentarios o una sugerencia',
    ABUSE_REPORT: 'Denunciar un abuso',
    ACCOUNT_PROBLEM: 'Un problema con mi cuenta',
    OTHER: 'Otra cosa',
  },
  statuses: {
    OPEN: 'Abrir',
    AWAITING_USER: 'Esperándole a usted',
    AWAITING_ADMIN: 'Con nuestro equipo',
    RESOLVED: 'Resuelta',
  },
  authors: {
    USER: 'Usted',
    ADMIN: 'Soporte de GlobalNews AI',
    SYSTEM_AI: 'Agente de soporte de GlobalNews AI · automatizado',
  },
  automaticAnswers: {
    notice: 'Las respuestas automáticas se redactan solo en inglés y polaco. Su solicitud pasa en su lugar a una persona.',
    ariaNotice: 'Las respuestas automáticas de esta página se redactan solo en inglés y polaco. Como está escribiendo en otro idioma, no hay ninguna respuesta automática — su solicitud pasa directamente a una persona, que es la vía más lenta y más segura. El idioma que ha seleccionado no ha cambiado.',
  },
};
