import type { RecoveredCatalogue as SupportDictionary } from './recoveredCatalogue';

/**
 * LANG-CATALOG-IMPLEMENT-1 - Português (`pt`) Support surface dictionary.
 *
 * AUTHORED BY THE LOCALISATION LANE, NOT HERE. Every string below is the
 * approved value from `L-LANG-CATALOG-1-R2` / `05-CATALOGUE-PT-R2.json`
 * (sha256 `42635c869c82c8a9...`), transcribed mechanically in `en` key
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
 * R2 SUPERSEDES the R0 and R1 Portuguese files. Canonical locale is `pt` - not pt-BR, not pt-PT. Six exonym literals remain an EXPLICIT PRODUCT DECISION (AMB-PT-R1-04) and are gated in ptRegionalGate.ts; they are NOT settled by the values below.
 */

/**
 * A SUPPORT DICTIONARY IS NOT A SUPPORT LANGUAGE. These strings let the
 * Support surface RENDER in Português; they do not make Português a
 * deterministic Support language. Qualification stays with the backend
 * (`F_PUBLISHED_QUALIFIED = ['en', 'pl']`) and dictionary presence is never
 * the detector - SUPPORT-LANG-7-D16.
 */
export const supportPt: SupportDictionary = {
  meta: {
    title: 'Suporte — GlobalNews AI',
    description: 'Abra uma solicitação de suporte e acompanhe suas respostas.',
  },
  heading: 'Suporte',
  intro: 'Faça uma pergunta, relate um problema ou envie feedback. Você verá todas as respostas aqui — nunca respondemos em outro lugar.',
  signedOut: {
    title: 'Entre para abrir uma solicitação de suporte',
    body: 'As solicitações de suporte pertencem a uma conta para que apenas você possa ler as respostas. O GlobalNews AI em si funciona sem conta.',
    signIn: 'Entrar com o Google',
  },
  signedOutHelp: {
    title: 'Se você não consegue entrar, comece por aqui',
    intro: 'Uma solicitação de suporte precisa de uma conta, então se o que falha é justamente o login, abrir uma solicitação ainda não está disponível para você. Estas são as causas que realmente produzem isso no GlobalNews AI. Se nenhuma delas é a sua, a falha é nossa e não sua.',
    cannotSignIn: {
      title: 'O login não se completa',
      body: 'O login passa pelo Google e volta para nós em uma única ida e volta. Se você terminar na página inicial do GlobalNews AI em vez de onde começou, a ida e volta não se completou e nenhuma sessão foi criada — vale tentar mais uma vez pelo botão Entrar antes de qualquer outra coisa, porque uma única tentativa interrompida é a causa mais comum.',
    },
    sessionIssue: {
      title: 'A sua sessão estava iniciada e agora não está',
      body: 'Sua sessão fica em um cookie definido pelo próprio GlobalNews AI. Um navegador configurado para bloquear ou limpar os cookies deste site, uma janela privada já fechada, ou outro navegador ou dispositivo se apresentarão todos como sessão encerrada — a conta está intacta, a sessão simplesmente não está lá. Permitir cookies para este site e entrar novamente a restaura.',
    },
    accountAccess: {
      title: 'A sua sessão está iniciada na conta errada',
      body: 'O GlobalNews AI não tem credenciais próprias; você é quem o Google diz que você é. Se tiver a sessão iniciada em mais de uma conta Google, aquela com que você chega aqui pode não ser aquela à qual suas solicitações pertencem. Sair e entrar novamente permite escolher, e suas solicitações estarão sob a conta que as abriu.',
    },
    securityIssue: {
      title: 'Algo no acesso lhe parece errado',
      body: 'Se você acredita que outra pessoa obteve acesso à sua conta, ou que está vendo algo que não lhe pertence, trate isso como urgente e não espere por uma resposta aqui. Saia do GlobalNews AI em todos os lugares onde tiver a sessão iniciada e depois proteja a própria conta Google, porque é ela a porta — a nossa apenas a segue.',
    },
    stillStuck: 'Se nada disso permitir sua entrada, a falha é nossa e vale relatar assim que possível — abra uma solicitação nesta página depois de entrar e conte o que você viu, incluindo quais dos passos acima você tentou.',
  },
  list: {
    heading: 'Suas solicitações',
    newRequest: 'Nova solicitação',
    emptyTitle: 'Você ainda não abriu nenhuma solicitação',
    emptyBody: 'Quando você abrir uma, ela aparecerá aqui, com todas as respostas anexadas.',
    errorTitle: 'Não foi possível carregar suas solicitações',
    errorBody: 'O pedido falhou. Nada é exibido em vez de uma lista parcial — se você tem solicitações abertas, elas continuam lá.',
    loading: 'Carregando suas solicitações…',
    retry: 'Tentar novamente',
    messageCount: 'mensagens',
    opened: 'Aberta',
    lastActivity: 'Última atividade',
  },
  form: {
    heading: 'Nova solicitação de suporte',
    categoryLabel: 'Sobre o que é isto?',
    categoryPlaceholder: 'Escolha uma',
    subjectLabel: 'Assunto',
    subjectPlaceholder: 'Um resumo breve',
    messageLabel: 'Mensagem',
    messagePlaceholder: 'O que aconteceu e o que você esperava?',
    submit: 'Enviar solicitação',
    submitting: 'Enviando…',
    sendingNotice: 'Enviando sua solicitação. Ela aparecerá aqui assim que for guardada.',
    cancel: 'Cancelar',
    charactersRemaining: 'caracteres restantes',
    tooShortSubject: 'Dê ao assunto pelo menos 3 caracteres.',
    tooShortMessage: 'Descreva o problema com pelo menos 10 caracteres.',
    categoryRequired: 'Escolha sobre o que é isto.',
  },
  thread: {
    back: 'Todas as solicitações',
    reference: 'Referência',
    replyLabel: 'Responder',
    replyPlaceholder: 'Adicionar a esta solicitação',
    send: 'Enviar resposta',
    sending: 'Enviando…',
    tooShortReply: 'Escreva pelo menos 2 caracteres.',
    errorTitle: 'Não foi possível carregar esta solicitação',
    errorBody: 'O pedido falhou. Nada é exibido em vez de parte de uma conversa.',
    loading: 'Carregando…',
    resolvedNotice: 'Esta solicitação está resolvida. Isso se refere à solicitação em si — não é a confirmação de que um problema que você relatou foi corrigido, a menos que uma resposta diga isso. Responder a ela a reabrirá e alguém a examinará novamente.',
  },
  errors: {
    sendFailedTitle: 'Sua mensagem não foi enviada',
    sendFailedBody: 'Nada foi enviado. Ou esta mensagem veio cedo demais após a anterior, ou você já tem o número máximo de solicitações abertas — resolver ou encerrar uma permitirá abrir outra.',
    genericTitle: 'Algo deu errado',
    genericBody: 'Nada foi enviado. Tente novamente em instantes.',
  },
  categories: {
    NEWS_QUESTION: 'Uma pergunta sobre uma notícia',
    BUG_REPORT: 'Algo não está funcionando',
    CONTENT_REPORT: 'Denunciar conteúdo',
    FEEDBACK: 'Feedback ou uma sugestão',
    ABUSE_REPORT: 'Denunciar abuso',
    ACCOUNT_PROBLEM: 'Um problema com minha conta',
    OTHER: 'Outra coisa',
  },
  statuses: {
    OPEN: 'Abrir',
    AWAITING_USER: 'Aguardando você',
    AWAITING_ADMIN: 'Do nosso lado',
    RESOLVED: 'Resolvida',
  },
  authors: {
    USER: 'Você',
    ADMIN: 'Suporte do GlobalNews AI',
    SYSTEM_AI: 'Agente de suporte do GlobalNews AI · automatizado',
  },
  automaticAnswers: {
    notice: 'As respostas automáticas são escritas apenas em inglês e polonês. O pedido segue, em vez disso, para uma pessoa.',
    ariaNotice: 'As respostas automáticas desta página são escritas apenas em inglês e polonês. Como está escrevendo em outro idioma, não há qualquer resposta automática — o pedido segue diretamente para uma pessoa, que é a via mais lenta e mais segura. O idioma selecionado não foi alterado.',
  },
};
