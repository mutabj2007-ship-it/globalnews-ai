import type { RecoveredCatalogue as SupportDictionary } from './recoveredCatalogue';

/**
 * LANG-CATALOG-IMPLEMENT-1 - Français (`fr`) Support surface dictionary.
 *
 * AUTHORED BY THE LOCALISATION LANE, NOT HERE. Every string below is the
 * approved value from `L-LANG-CATALOG-1 (R0)` / `02-CATALOGUE-FR.json`
 * (sha256 `7a79cebdda58586f...`), transcribed mechanically in `en` key
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
 * U+00A0 before the French high punctuation is emitted as an explicit \u00a0 escape so it is visible in review and cannot be lost to a whitespace-normalising edit.
 */

/**
 * A SUPPORT DICTIONARY IS NOT A SUPPORT LANGUAGE. These strings let the
 * Support surface RENDER in Français; they do not make Français a
 * deterministic Support language. Qualification stays with the backend
 * (`F_PUBLISHED_QUALIFIED = ['en', 'pl']`) and dictionary presence is never
 * the detector - SUPPORT-LANG-7-D16.
 */
export const supportFr: SupportDictionary = {
  meta: {
    title: 'Assistance — GlobalNews AI',
    description: 'Ouvrez une demande d\'assistance et suivez-en les réponses.',
  },
  heading: 'Assistance',
  intro: 'Posez une question, signalez un problème ou envoyez un retour. Vous verrez toutes les réponses ici — nous ne répondons jamais ailleurs.',
  signedOut: {
    title: 'Connectez-vous pour ouvrir une demande d\'assistance',
    body: 'Les demandes d\'assistance appartiennent à un compte afin que vous seul puissiez en lire les réponses. GlobalNews AI lui-même fonctionne sans compte.',
    signIn: 'Se connecter avec Google',
  },
  signedOutHelp: {
    title: 'Si vous ne parvenez pas à vous connecter, commencez ici',
    intro: 'Une demande d\'assistance nécessite un compte\u00a0: si c\'est justement la connexion qui échoue, ouvrir une demande ne vous est pas encore possible. Voici les causes qui produisent réellement cela sur GlobalNews AI. Si aucune n\'est la vôtre, la faute est de notre côté et non du vôtre.',
    cannotSignIn: {
      title: 'La connexion ne va pas jusqu\'au bout',
      body: 'La connexion passe par Google et nous revient en un seul aller-retour. Si vous vous retrouvez sur la page d\'accueil de GlobalNews AI au lieu de votre point de départ, l\'aller-retour ne s\'est pas terminé et aucune session n\'a été créée — réessayer une fois depuis le bouton Se connecter vaut la peine avant toute autre chose, car une seule tentative interrompue en est la cause la plus fréquente.',
    },
    sessionIssue: {
      title: 'Vous étiez connecté et vous ne l\'êtes plus',
      body: 'Votre session est conservée dans un cookie posé par GlobalNews AI lui-même. Un navigateur réglé pour bloquer ou effacer les cookies de ce site, une fenêtre privée depuis fermée, ou un autre navigateur ou appareil se présenteront tous comme une déconnexion — le compte est intact, la session n\'est simplement pas là. Autoriser les cookies pour ce site puis vous reconnecter la rétablit.',
    },
    accountAccess: {
      title: 'Vous êtes connecté avec le mauvais compte',
      body: 'GlobalNews AI n\'a pas de mot de passe propre\u00a0; vous êtes celui que Google déclare. Si vous êtes connecté à plusieurs comptes Google, celui avec lequel vous arrivez ici n\'est peut-être pas celui auquel vos demandes appartiennent. Vous déconnecter puis vous reconnecter vous permet de choisir, et vos demandes se trouveront sous le compte qui les a ouvertes.',
    },
    securityIssue: {
      title: 'Quelque chose vous semble anormal dans l\'accès',
      body: 'Si vous pensez qu\'une autre personne a accédé à votre compte, ou qu\'on vous montre quelque chose qui ne vous appartient pas, traitez cela comme urgent et n\'attendez pas de réponse ici. Déconnectez-vous de GlobalNews AI partout où vous êtes connecté, puis sécurisez le compte Google lui-même, car c\'est lui la porte — le nôtre ne fait que la suivre.',
    },
    stillStuck: 'Si rien de tout cela ne vous permet d\'entrer, la faute nous revient et vaut d\'être signalée dès que possible — ouvrez une demande depuis cette page une fois connecté et décrivez ce que vous avez vu, en précisant lesquelles des étapes ci-dessus vous avez essayées.',
  },
  list: {
    heading: 'Vos demandes',
    newRequest: 'Nouvelle demande',
    emptyTitle: 'Vous n\'avez encore ouvert aucune demande',
    emptyBody: 'Lorsque vous en ouvrirez une, elle apparaîtra ici, avec toutes ses réponses.',
    errorTitle: 'Vos demandes n\'ont pas pu être chargées',
    errorBody: 'La requête a échoué. Rien n\'est affiché plutôt qu\'une liste partielle — si vous avez des demandes ouvertes, elles sont toujours là.',
    loading: 'Chargement de vos demandes…',
    retry: 'Réessayer',
    messageCount: 'messages',
    opened: 'Ouverte',
    lastActivity: 'Dernière activité',
  },
  form: {
    heading: 'Nouvelle demande d\'assistance',
    categoryLabel: 'De quoi s\'agit-il\u00a0?',
    categoryPlaceholder: 'Choisissez une option',
    subjectLabel: 'Objet',
    subjectPlaceholder: 'Un bref résumé',
    messageLabel: 'Message',
    messagePlaceholder: 'Que s\'est-il passé, et à quoi vous attendiez-vous\u00a0?',
    submit: 'Envoyer la demande',
    submitting: 'Envoi…',
    sendingNotice: 'Envoi de votre demande. Elle apparaîtra ici une fois enregistrée.',
    cancel: 'Annuler',
    charactersRemaining: 'caractères restants',
    tooShortSubject: 'Veuillez donner à l\'objet au moins 3 caractères.',
    tooShortMessage: 'Veuillez décrire le problème en 10 caractères au minimum.',
    categoryRequired: 'Veuillez indiquer de quoi il s\'agit.',
  },
  thread: {
    back: 'Toutes les demandes',
    reference: 'Référence',
    replyLabel: 'Répondre',
    replyPlaceholder: 'Ajouter à cette demande',
    send: 'Envoyer la réponse',
    sending: 'Envoi…',
    tooShortReply: 'Veuillez écrire au moins 2 caractères.',
    errorTitle: 'Cette demande n\'a pas pu être chargée',
    errorBody: 'La requête a échoué. Rien n\'est affiché plutôt qu\'une partie de la conversation.',
    loading: 'Chargement…',
    resolvedNotice: 'Cette demande est résolue. Cela concerne la demande elle-même — ce n\'est pas la confirmation qu\'un problème que vous avez signalé a été corrigé, sauf si une réponse le dit. Y répondre la rouvrira et quelqu\'un l\'examinera de nouveau.',
  },
  errors: {
    sendFailedTitle: 'Votre message n\'a pas été envoyé',
    sendFailedBody: 'Rien n\'a été envoyé. Soit ce message est arrivé trop tôt après le précédent, soit vous avez déjà le nombre maximal de demandes ouvertes — en résoudre ou en clôturer une vous permettra d\'en ouvrir une autre.',
    genericTitle: 'Une erreur s\'est produite',
    genericBody: 'Rien n\'a été envoyé. Veuillez réessayer dans un instant.',
  },
  categories: {
    NEWS_QUESTION: 'Une question sur un article',
    BUG_REPORT: 'Quelque chose ne fonctionne pas',
    CONTENT_REPORT: 'Signaler un contenu',
    FEEDBACK: 'Un retour ou une suggestion',
    ABUSE_REPORT: 'Signaler un abus',
    ACCOUNT_PROBLEM: 'Un problème avec mon compte',
    OTHER: 'Autre chose',
  },
  statuses: {
    OPEN: 'Ouvrir',
    AWAITING_USER: 'En attente de votre réponse',
    AWAITING_ADMIN: 'Chez notre équipe',
    RESOLVED: 'Résolue',
  },
  authors: {
    USER: 'Vous',
    ADMIN: 'Assistance GlobalNews AI',
    SYSTEM_AI: 'Agent d\'assistance GlobalNews AI · automatisé',
  },
  automaticAnswers: {
    notice: 'Les réponses automatiques sont rédigées en anglais et en polonais uniquement. Votre demande est transmise à une personne à la place.',
    ariaNotice: 'Les réponses automatiques de cette page sont rédigées en anglais et en polonais uniquement. Comme vous écrivez dans une autre langue, il n\'y a aucune réponse automatique — votre demande est transmise directement à une personne, ce qui est la voie la plus lente et la plus sûre. La langue que vous avez choisie n\'a pas changé.',
  },
};
