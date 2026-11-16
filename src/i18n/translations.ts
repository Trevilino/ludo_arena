export type Language = 'fr' | 'en';

export interface Translations {
  // Brand & Nav
  brandSubtitle: string;
  nav: {
    arena: string;
    tournaments: string;
    tournamentsShort: string;
    leaderboard: string;
    leaderboardShort: string;
    inventory: string;
    social: string;
  };
  header: {
    level: string;
    rank: string;
    audioOn: string;
    audioMuted: string;
    muteSound: string;
    enableSound: string;
    addCoins: string;
  };
  // Arena Lobby
  lobby: {
    kicker: string;
    title: string;
    subtitle: string;
    projectedPot: string;
    freePlay: string;
    stepFormat: string;
    stepBuyIn: string;
    stepDifficulty: string;
    selected: string;
    modes: {
      quick4pTitle: string;
      quick4pDesc: string;
      duel2pTitle: string;
      duel2pDesc: string;
      passPlayTitle: string;
      passPlayDesc: string;
    };
    diffStandard: string;
    diffPro: string;
    shortcutsHint: string;
    spaceKey: string;
    toRoll: string;
    toMove: string;
    startMatch: string;
    insufficientCoins: string;
    rules: {
      deployTitle: string;
      deployDesc: string;
      captureTitle: string;
      captureDesc: string;
      homeTitle: string;
      homeDesc: string;
    };
    home: {
      vsComputer: string;
      vsComputerSub: string;
      duel1v1: string;
      duel1v1Sub: string;
      passPlay: string;
      passPlaySub: string;
      tournaments: string;
      tournamentsSub: string;
      online: string;
      onlineSub: string;
      playNow: string;
      cancel: string;
    };
    local: {
      title: string;
      playerCount: string;
      playersShort: string;
      seatHuman: string;
      seatBot: string;
      seatOff: string;
      playerPlaceholder: string;
      defaultPlayer: string;
      botLabel: string;
      validationError: string;
    };
    online: {
      title: string;
      tabCreate: string;
      tabJoin: string;
      yourName: string;
      namePlaceholder: string;
      roomSize: string;
      createBtn: string;
      codeLabel: string;
      codePlaceholder: string;
      joinBtn: string;
      roomCode: string;
      copyCode: string;
      copyLink: string;
      copied: string;
      fillBots: string;
      hostBadge: string;
      botBadge: string;
      waitingSeat: string;
      readyBadge: string;
      offlineBadge: string;
      startMatch: string;
      leaveRoom: string;
      waitingHost: string;
      needPlayers: string;
      stakeLabel: string;
      freeOption: string;
      potPreview: string;
      tabPublic: string;
      quickMatchBtn: string;
      visibilityLabel: string;
      privateRoom: string;
      publicRoom: string;
      noPublicRooms: string;
      refreshList: string;
      joinShort: string;
      playersRatio: string;
      tableChat: string;
      chatPlaceholder: string;
      customStakeLabel: string;
      customStakePlaceholder: string;
      applyStake: string;
    };
  };
  // Focused Game Board
  board: {
    menuBtn: string;
    hideHud: string;
    showHud: string;
    pot: string;
    practiceTable: string;
    turnLabel: string;
    humanBadge: string;
    aiBadge: string;
    youTag: string;
    homeProgress: string;
    emptySeat: string;
    pauseTitle: string;
    pauseDesc: string;
    resume: string;
    restart: string;
    exitLobby: string;
    matchComplete: string;
    winsTitle: string;
    winPotDesc: string;
    winPracticeDesc: string;
    playAgain: string;
    returnLobby: string;
    footerTip: string;
    status: {
      yourTurn: string;
      playerTurn: string;
      aiThinking: string;
      rolling: string;
      threeSixes: string;
      noMoves: string;
      selectOneToken: string;
      selectManyTokens: string;
      autoDeploying: string;
      autoMoving: string;
      aiChoseRoll: string;
      bonusCapture: string;
      captureReturning: string;
      bonusHome: string;
      bonusSix: string;
      rollsAgain: string;
      claimedCrown: string;
    };
    events: {
      tableSeated: string;
      matchStarted: string;
      playersCount: string;
      captured: string;
      reachedHome: string;
      landedSafe: string;
      deployed: string;
      advanced: string;
      rolled: string;
      threeSixesLog: string;
      wonMatch: string;
    };
    titles: {
      quick4p: string;
      duel2p: string;
      passPlay: string;
      onlineRoom: string;
      duelVs: string;
    };
  };
  // Right Telemetry Panel
  telemetry: {
    activeTable: string;
    arenaSummary: string;
    ready: string;
    turn: string;
    prizePool: string;
    activeSeat: string;
    lobby: string;
    safeRunes: string;
    forfeitRule: string;
    matchLog: string;
    tableChat: string;
    emptyLog: string;
    arenaSource: string;
    messagePlaceholder: string;
    quickPhrases: string[];
    botReplies: string[];
  };
  // Tournaments
  tournaments: {
    kicker: string;
    title: string;
    subtitle: string;
    weeklyJackpot: string;
    allCups: string;
    statuses: {
      live: string;
      registering: string;
      upcoming: string;
    };
    entryFee: string;
    prizePool: string;
    seats: string;
    launchCup: string;
    enterCup: string;
    coinsUnit: string;
    insufficientCoins: string;
    items: Record<string, { title: string; subtitle: string; startsIn: string }>;
  };
  // Leaderboard
  leaderboard: {
    kicker: string;
    title: string;
    subtitle: string;
    yourStanding: string;
    scopes: {
      global: string;
      friends: string;
      weekly: string;
    };
    searchPlaceholder: string;
    colRank: string;
    colCompetitor: string;
    colElo: string;
    colWinRate: string;
    colEarnings: string;
    emptyFilter: string;
    youTag: string;
    winsShort: string;
  };
  // Boutique / Shop
  inventory: {
    kicker: string;
    title: string;
    subtitle: string;
    tabs: {
      coins: string;
      all: string;
      dice: string;
      token: string;
      board: string;
    };
    categories: {
      dice: string;
      token: string;
      board: string;
    };
    rarities: {
      Standard: string;
      Rare: string;
      Mythic: string;
    };
    equipped: string;
    equip: string;
    unlock: string;
    coinShop: {
      buyTitle: string;
      buySubtitle: string;
      sellTitle: string;
      sellSubtitle: string;
      customAmount: string;
      paymentMethod: string;
      payoutMethod: string;
      payoutDestination: string;
      payoutPlaceholder: string;
      buyBtn: string;
      sellBtn: string;
      instantNote: string;
      manualNote: string;
      sellNote: string;
      minSellHint: string;
      disabledMsg: string;
      signInRequired: string;
      ordersTitle: string;
      emptyOrders: string;
      orderBuyLabel: string;
      orderSellLabel: string;
      statusPending: string;
      statusCompleted: string;
      statusRejected: string;
      buySuccessInstant: string;
      buySuccessPending: string;
      sellSuccessPending: string;
      insufficientCoins: string;
      missingDestination: string;
    };
    items: Record<string, { name: string; description: string }>;
  };
  // Social
  social: {
    kicker: string;
    title: string;
    subtitle: string;
    placeholder: string;
    addRival: string;
    alreadyAdded: string;
    addedSuccess: string;
    duelBtn: string;
    statusOnline: string;
    statusInMatch: string;
    statusAway: string;
    vsYou: string;
  };
  // Coin Modal
  vault: {
    title: string;
    balance: string;
    dailyTitle: string;
    dailyDesc: string;
    claimed: string;
    claimBtn: string;
    refillTitle: string;
    refillDesc: string;
    addBtn: string;
  };
  auth: {
    signInGoogle: string;
    signInShort: string;
    signOut: string;
    accountBtn: string;
    accountTitle: string;
    connectedBadge: string;
    guestBadge: string;
    guestDesc: string;
    authError: string;
    statsElo: string;
    statsWins: string;
    statsMatches: string;
    statsEarnings: string;
    tabWallet: string;
    tabPurchases: string;
    tabRooms: string;
    emptyWallet: string;
    emptyPurchases: string;
    emptyRooms: string;
    outcomes: {
      win: string;
      loss: string;
      joined: string;
      abandoned: string;
    };
    roles: {
      host: string;
      guest: string;
      solo: string;
    };
  };
}

export const TRANSLATIONS: Record<Language, Translations> = {
  fr: {
    brandSubtitle: 'Cyber-Luxe',
    nav: {
      arena: 'Arène',
      tournaments: 'Tournois',
      tournamentsShort: 'Tournois',
      leaderboard: 'Classement',
      leaderboardShort: 'Rangs',
      inventory: 'Boutique',
      social: 'Social',
    },
    header: {
      level: 'NIV',
      rank: 'Rang',
      audioOn: 'Son activé',
      audioMuted: 'Son coupé',
      muteSound: 'Couper le son',
      enableSound: 'Activer le son',
      addCoins: 'Ajouter des pièces',
    },
    lobby: {
      kicker: 'Salon Compétitif',
      title: 'Configurez votre table',
      subtitle:
        'Choisissez le format, la mise et le niveau de l’IA. Plateau Ludo King classique dans une interface Cyber-Luxe.',
      projectedPot: 'Cagnotte prévue',
      freePlay: 'Partie libre',
      stepFormat: '01. Format de match',
      stepBuyIn: '02. Mise d’entrée',
      stepDifficulty: '03. Niveau de l’IA',
      selected: 'Choisi',
      modes: {
        quick4pTitle: 'Arène 4 Joueurs',
        quick4pDesc: 'Vous contre 3 stratèges IA',
        duel2pTitle: 'Duel Cyber 1v1',
        duel2pDesc: 'Rouge BG vs Jaune HD',
        passPlayTitle: 'Local 4 Joueurs',
        passPlayDesc: '4 joueurs sur le même écran',
      },
      diffStandard: 'IA Standard',
      diffPro: 'IA Grand Maître',
      shortcutsHint: 'Raccourcis clavier :',
      spaceKey: 'Espace',
      toRoll: 'pour lancer le dé',
      toMove: 'pour choisir un pion.',
      startMatch: 'Lancer le match',
      insufficientCoins: 'Pièces insuffisantes',
      rules: {
        deployTitle: 'Sortir sur un 6',
        deployDesc: 'Obtenez un 6 pour déployer un pion de la base et rejouer immédiatement.',
        captureTitle: 'Captures tactiques',
        captureDesc: 'Tombez sur un pion adverse hors case étoile pour le renvoyer à sa base.',
        homeTitle: 'Entrée exacte au centre',
        homeDesc: 'Menez vos 4 pions dans votre colonne colorée jusqu’à la couronne centrale.',
      },
      home: {
        vsComputer: 'Vs Ordinateur',
        vsComputerSub: '4 Joueurs · IA',
        duel1v1: 'Duel 1v1',
        duel1v1Sub: '2 Joueurs',
        passPlay: 'Pass & Play',
        passPlaySub: 'Local · 2 à 4 Joueurs',
        tournaments: 'Tournois',
        tournamentsSub: 'Coupes & Gains',
        online: 'En ligne · Amis',
        onlineSub: 'Salle privée',
        playNow: 'Jouer',
        cancel: 'Annuler',
      },
      local: {
        title: 'Pass & Play Local',
        playerCount: 'Joueurs',
        playersShort: 'J',
        seatHuman: 'Humain',
        seatBot: 'IA',
        seatOff: 'Off',
        playerPlaceholder: 'Nom du joueur',
        defaultPlayer: 'Joueur',
        botLabel: 'Bot',
        validationError: 'Activez au moins 2 joueurs (dont 1 humain).',
      },
      online: {
        title: 'Salle Privée En Ligne',
        tabCreate: 'Créer une salle',
        tabJoin: 'Rejoindre',
        yourName: 'Votre pseudo',
        namePlaceholder: 'Ex: Kaelen',
        roomSize: 'Format de table',
        createBtn: 'Créer la salle',
        codeLabel: 'Code de la salle',
        codePlaceholder: 'EX: A7K9P2',
        joinBtn: 'Rejoindre la salle',
        roomCode: 'Code à partager',
        copyCode: 'Copier code',
        copyLink: 'Copier lien',
        copied: 'Copié !',
        fillBots: 'Compléter les places libres avec des IA',
        hostBadge: 'Hôte',
        botBadge: 'IA',
        waitingSeat: 'En attente d’un joueur...',
        readyBadge: 'Prêt',
        offlineBadge: 'Hors ligne',
        startMatch: 'Lancer la partie',
        leaveRoom: 'Quitter la salle',
        waitingHost: 'En attente du lancement par l’hôte...',
        needPlayers: 'Invitez au moins 1 ami ou activez les IA.',
        stakeLabel: 'Mise par joueur',
        freeOption: 'Gratuit',
        potPreview: 'Cagnotte au gagnant',
        tabPublic: 'Salles Publiques',
        quickMatchBtn: 'Match Rapide',
        visibilityLabel: 'Visibilité du salon',
        privateRoom: 'Privé (code)',
        publicRoom: 'Public',
        noPublicRooms: 'Aucun salon public en attente pour le moment. Lancez un Match Rapide ou créez le vôtre !',
        refreshList: 'Actualiser',
        joinShort: 'Rejoindre',
        playersRatio: '{count}/{max} joueurs',
        tableChat: 'Chat de table',
        chatPlaceholder: 'Message aux joueurs...',
        customStakeLabel: 'Mise personnalisée',
        customStakePlaceholder: 'Ex: 350',
        applyStake: 'Appliquer',
      },
    },
    board: {
      menuBtn: 'Menu',
      hideHud: 'Cacher le menu et le tour',
      showHud: 'Afficher le menu et le tour',
      pot: 'Cagnotte',
      practiceTable: 'Table d’entraînement',
      turnLabel: 'Tour en cours',
      humanBadge: 'HUMAIN',
      aiBadge: 'IA',
      youTag: 'Vous',
      homeProgress: 'au centre',
      emptySeat: 'Vide',
      pauseTitle: 'Menu de la table',
      pauseDesc: 'Gérez la partie en cours ou revenez au salon principal.',
      resume: 'Reprendre la partie',
      restart: 'Recommencer',
      exitLobby: 'Quitter vers le salon',
      matchComplete: 'Partie terminée',
      winsTitle: 'remporte la victoire !',
      winPotDesc: 'pièces d’arène attribuées au champion.',
      winPracticeDesc: 'Les quatre pions ont atteint la couronne centrale.',
      playAgain: 'Rejouer',
      returnLobby: 'Retour au salon',
      footerTip: 'Ludo Arena · Lancez le dé et rejoignez le centre',
      status: {
        yourTurn: 'À vous ! Cliquez sur votre dé ou appuyez sur Espace.',
        playerTurn: 'À {name} de jouer. Lancez le dé !',
        aiThinking: '{name} prépare son lancer...',
        rolling: 'Lancer du dé...',
        threeSixes: 'Trois 6 d’affilée ! Tour annulé.',
        noMoves: '{roll} obtenu — aucun coup possible.',
        selectOneToken: '{roll} obtenu ! Cliquez sur le pion illuminé.',
        selectManyTokens: '{roll} obtenu ! Choisissez un des {count} pions disponibles.',
        autoDeploying: '6 obtenu ! Placement automatique du pion sur le départ...',
        autoMoving: '{roll} obtenu ! Déplacement automatique du seul pion disponible...',
        aiChoseRoll: '{name} a fait {roll} et choisit son coup...',
        bonusCapture: 'Capture réussie !',
        captureReturning: 'Capture ! Le pion de {victim} retourne case par case à sa porte...',
        bonusHome: 'Pion arrivé au centre !',
        bonusSix: '6 obtenu !',
        rollsAgain: '{name} rejoue.',
        claimedCrown: '{name} a décroché la couronne !',
      },
      events: {
        tableSeated: 'Table prête. Faites un 6 pour sortir votre premier pion.',
        matchStarted: '{title} lancée ({count} joueurs).',
        playersCount: 'joueurs',
        captured: '{actor} a capturé un pion de {victim} ! Lancer bonus.',
        reachedHome: '{actor} a mené un pion jusqu’à l’arrivée !',
        landedSafe: '{actor} s’est posé sur une case sûre.',
        deployed: '{actor} a sorti un pion sur le plateau.',
        advanced: '{actor} a avancé de {roll} cases.',
        rolled: '{actor} a obtenu un {roll}.',
        threeSixesLog: '{actor} a fait trois 6 de suite — tour annulé.',
        wonMatch: '{name} remporte la partie !',
      },
      titles: {
        quick4p: 'Table Cyber-Luxe 4P',
        duel2p: 'Duel Cyber 1v1',
        passPlay: 'Partie Locale',
        onlineRoom: 'Salle En Ligne · {code}',
        duelVs: 'Duel 1v1 vs {name}',
      },
    },
    telemetry: {
      activeTable: 'Table active',
      arenaSummary: 'Résumé de l’arène',
      ready: 'Prêt',
      turn: 'Tour',
      prizePool: 'Cagnotte',
      activeSeat: 'Joueur actif',
      lobby: 'Salon',
      safeRunes: '8 cases sûres actives',
      forfeitRule: 'Règle des 3×6',
      matchLog: 'Journal',
      tableChat: 'Discussion',
      emptyLog: 'Lancez une partie pour suivre les actions en direct.',
      arenaSource: 'Arène',
      messagePlaceholder: 'Message à la table...',
      quickPhrases: ['Bonne chance !', 'Beau lancer !', 'Bien joué !', 'GG'],
      botReplies: [
        'Bien joué !',
        'Attention aux cases étoiles.',
        'Voyons ce que disent les dés !',
        'Respect !',
      ],
    },
    tournaments: {
      kicker: 'Circuit Championnat Saison 4',
      title: 'Tournois de l’Arène',
      subtitle:
        'Rejoignez des coupes à élimination directe. Remporter une table reverse la cagnotte directement dans votre coffre.',
      weeklyJackpot: 'Jackpot Hebdo',
      allCups: 'Toutes les coupes',
      statuses: {
        live: 'En direct',
        registering: 'Inscriptions',
        upcoming: 'À venir',
      },
      entryFee: 'Entrée',
      prizePool: 'Cagnotte',
      seats: 'Places',
      launchCup: 'Lancer la table',
      enterCup: 'Participer',
      coinsUnit: 'pièces',
      insufficientCoins: 'Pièces insuffisantes',
      items: {
        'neon-grand-prix': {
          title: 'Grand Prix Néon',
          subtitle: '4 Joueurs · Règles classiques',
          startsIn: 'Place ouverte',
        },
        'midnight-duel-cup': {
          title: 'Coupe Duel Minuit',
          subtitle: 'Sprint 1v1 coins opposés',
          startsIn: '4m 20s',
        },
        'obsidian-open': {
          title: 'Open Obsidienne',
          subtitle: '4 Joueurs · Mise accessible',
          startsIn: '12m 00s',
        },
        'solar-invitational': {
          title: 'Tournoi Couronne Solaire',
          subtitle: 'Championnat 4 Joueurs Hautes Mises',
          startsIn: '28m 15s',
        },
      },
    },
    leaderboard: {
      kicker: 'Classement Officiel',
      title: 'Classement Mondial',
      subtitle: 'Les rangs se mettent à jour automatiquement à chaque victoire.',
      yourStanding: 'Votre position',
      scopes: {
        global: 'Mondial',
        friends: 'Amis',
        weekly: 'Semaine',
      },
      searchPlaceholder: 'Filtrer un joueur...',
      colRank: 'Rang',
      colCompetitor: 'Joueur',
      colElo: 'ELO',
      colWinRate: 'Victoires',
      colEarnings: 'Gains',
      emptyFilter: 'Aucun joueur ne correspond à votre recherche.',
      youTag: '(Vous)',
      winsShort: 'V',
    },
    inventory: {
      kicker: 'Échange & Équipements',
      title: 'Boutique Ludo Arena',
      subtitle:
        'Achetez ou vendez vos pièces en toute simplicité et équipez vos dés, pions et plateaux favoris.',
      tabs: {
        coins: 'Pièces · Achat / Vente',
        all: 'Tout',
        dice: 'Dés',
        token: 'Pions',
        board: 'Plateaux',
      },
      categories: {
        dice: 'Dé',
        token: 'Pion',
        board: 'Plateau',
      },
      rarities: {
        Standard: 'Standard',
        Rare: 'Rare',
        Mythic: 'Mythique',
      },
      equipped: 'Équipé',
      equip: 'Équiper',
      unlock: 'Débloquer',
      coinShop: {
        buyTitle: 'Acheter des pièces',
        buySubtitle: 'Tarif : {rate} pour 1 000 pièces',
        sellTitle: 'Vendre des pièces',
        sellSubtitle: 'Rachat : {rate} pour 1 000 pièces',
        customAmount: 'Quantité personnalisée (pièces)',
        paymentMethod: 'Moyen de paiement',
        payoutMethod: 'Mode de réception',
        payoutDestination: 'Numéro / IBAN / E-mail de réception',
        payoutPlaceholder: 'Ex: +225 07... ou email PayPal',
        buyBtn: 'Acheter {coins} pièces · {price}',
        sellBtn: 'Vendre {coins} pièces · +{price}',
        instantNote: 'Crédit immédiat dans votre wallet après confirmation.',
        manualNote: 'Commande envoyée à l’administrateur pour validation.',
        sellNote: 'Les pièces sont réservées dès la demande jusqu’au paiement par l’admin.',
        minSellHint: 'Minimum {min} pièces pour une vente.',
        disabledMsg: 'Ce service est momentanément désactivé par l’administrateur.',
        signInRequired: 'Connectez-vous avec Google pour acheter ou vendre des pièces.',
        ordersTitle: 'Historique de vos achats et ventes de pièces',
        emptyOrders: 'Aucune commande d’achat ou de vente de pièces pour le moment.',
        orderBuyLabel: 'Achat',
        orderSellLabel: 'Vente',
        statusPending: 'En attente',
        statusCompleted: 'Validé',
        statusRejected: 'Refusé',
        buySuccessInstant: '+{coins} pièces créditées sur votre compte !',
        buySuccessPending: 'Demande d’achat de {coins} pièces transmise à l’admin.',
        sellSuccessPending: 'Demande de vente de {coins} pièces enregistrée.',
        insufficientCoins: 'Solde insuffisant ou inférieur au minimum requis.',
        missingDestination: 'Indiquez vos coordonnées de réception.',
      },
      items: {
        'obsidian-glass': {
          name: 'Verre Obsidienne',
          description: 'Dé en cristal fumé avec points blancs et reflet violet.',
        },
        'solar-amber': {
          name: 'Ambre Solaire',
          description: 'Dé en alliage doré avec lueur ambrée intense.',
        },
        'cyber-prism': {
          name: 'Prisme Cyber',
          description: 'Cube translucide cyan glacé à haute lisibilité.',
        },
        'arcade-chip': {
          name: 'Jeton Arcade',
          description: 'Pion concentrique façon jeton de casino chanfreiné.',
        },
        'carbon-ring': {
          name: 'Halo Carbone',
          description: 'Noyau noir mat entouré d’un anneau lumineux.',
        },
        'royal-crown': {
          name: 'Blason Souverain',
          description: 'Pion de championnat gravé d’une couronne centrale.',
        },
        'midnight-obsidian': {
          name: 'Ludo Classique Luxe',
          description: 'Plateau blanc haute lisibilité serti d’un cadre ardoise sombre.',
        },
        'cobalt-vault': {
          name: 'Coffre Cobalt',
          description: 'Surface azur claire aux bordures saphir de précision.',
        },
        'emerald-circuit': {
          name: 'Circuit Émeraude',
          description: 'Finition menthe glacée encadrée de vert tournoi.',
        },
      },
    },
    social: {
      kicker: 'Rivaux & Amis',
      title: 'Arène Sociale',
      subtitle:
        'Défiez vos rivaux en duel 1v1 immédiat ou ajoutez de nouveaux joueurs par identifiant.',
      placeholder: '@pseudo.joueur',
      addRival: 'Ajouter',
      alreadyAdded: '{handle} figure déjà dans votre liste de rivaux.',
      addedSuccess: '{handle} ajouté à votre liste.',
      duelBtn: 'Duel 1v1',
      statusOnline: 'En ligne',
      statusInMatch: 'En partie',
      statusAway: 'Absent',
      vsYou: 'vs Vous',
    },
    vault: {
      title: 'Coffre à Pièces',
      balance: 'Solde actuel :',
      dailyTitle: 'Prime quotidienne',
      dailyDesc: '+1 000 pièces gratuites pour vos parties du jour',
      claimed: 'Récupérée',
      claimBtn: 'Prendre +1 000',
      refillTitle: 'Recharge d’entraînement',
      refillDesc: 'Ajoutez +500 pièces à tout moment pour vos mises',
      addBtn: 'Ajouter +500',
    },
    auth: {
      signInGoogle: 'Se connecter avec Google',
      signInShort: 'Connexion',
      signOut: 'Déconnexion',
      accountBtn: 'Compte & Historique',
      accountTitle: 'Compte Google & Persistance',
      connectedBadge: 'Synchronisé Firestore',
      guestBadge: 'Mode Invité',
      guestDesc:
        'Connectez-vous avec Google pour sauvegarder votre wallet, l’historique d’achats de pions/skins et vos salons en ligne.',
      authError: 'Connexion Google annulée ou bloquée. Réessayez.',
      statsElo: 'ELO',
      statsWins: 'Victoires',
      statsMatches: 'Parties',
      statsEarnings: 'Gains totaux',
      tabWallet: 'Wallet',
      tabPurchases: 'Achats pions',
      tabRooms: 'Salons',
      emptyWallet: 'Aucune transaction enregistrée pour le moment.',
      emptyPurchases: 'Aucun achat de pion, dé ou pack effectué.',
      emptyRooms: 'Aucun salon ou match enregistré pour le moment.',
      outcomes: {
        win: 'Victoire',
        loss: 'Défaite',
        joined: 'En cours',
        abandoned: 'Quitté',
      },
      roles: {
        host: 'Hôte',
        guest: 'Invité',
        solo: 'Solo',
      },
    },
  },
  en: {
    brandSubtitle: 'Cyber-Luxe',
    nav: {
      arena: 'Arena',
      tournaments: 'Tournaments',
      tournamentsShort: 'Cups',
      leaderboard: 'Leaderboard',
      leaderboardShort: 'Ranks',
      inventory: 'Shop',
      social: 'Social',
    },
    header: {
      level: 'LVL',
      rank: 'Rank',
      audioOn: 'Audio On',
      audioMuted: 'Audio Muted',
      muteSound: 'Mute sound',
      enableSound: 'Enable sound',
      addCoins: 'Add Arena Coins',
    },
    lobby: {
      kicker: 'Competitive Ludo Lobby',
      title: 'Configure Your Arena Table',
      subtitle:
        'Select match format, wager tier, and opponent AI discipline. Classic Ludo King board geometry with Cyber-Luxe telemetry.',
      projectedPot: 'Projected Pot',
      freePlay: 'Free Play',
      stepFormat: '01. Match Format',
      stepBuyIn: '02. Table Buy-In',
      stepDifficulty: '03. Rival AI Discipline',
      selected: 'Selected',
      modes: {
        quick4pTitle: '4P Arena Blitz',
        quick4pDesc: 'You vs 3 AI Tacticians',
        duel2pTitle: '1v1 Cyber Duel',
        duel2pDesc: 'Red BL vs Yellow TR',
        passPlayTitle: 'Local Pass & Play',
        passPlayDesc: '4 Human seats, 1 screen',
      },
      diffStandard: 'Standard AI',
      diffPro: 'Grandmaster AI',
      shortcutsHint: 'Shortcuts:',
      spaceKey: 'Space',
      toRoll: 'to roll,',
      toMove: 'to move tokens.',
      startMatch: 'Start Arena Match',
      insufficientCoins: 'Insufficient Coins',
      rules: {
        deployTitle: 'Deploy on 6',
        deployDesc: 'Roll a 6 to launch a token from base and earn an immediate bonus roll.',
        captureTitle: 'Tactical Captures',
        captureDesc: 'Land on an opponent outside Star tiles to send them back to base.',
        homeTitle: 'Exact Home Entry',
        homeDesc: 'Navigate all 4 pawns through your colored lane into the central crown.',
      },
      home: {
        vsComputer: 'Vs Computer',
        vsComputerSub: '4 Players · AI',
        duel1v1: '1v1 Duel',
        duel1v1Sub: '2 Players',
        passPlay: 'Pass & Play',
        passPlaySub: 'Local · 2–4 Players',
        tournaments: 'Tournaments',
        tournamentsSub: 'Cups & Prizes',
        online: 'Play With Friends',
        onlineSub: 'Online Room',
        playNow: 'Play',
        cancel: 'Cancel',
      },
      local: {
        title: 'Local Pass & Play',
        playerCount: 'Players',
        playersShort: 'P',
        seatHuman: 'Human',
        seatBot: 'AI',
        seatOff: 'Off',
        playerPlaceholder: 'Player name',
        defaultPlayer: 'Player',
        botLabel: 'Bot',
        validationError: 'Enable at least 2 active players (with 1 human).',
      },
      online: {
        title: 'Online Private Room',
        tabCreate: 'Create Room',
        tabJoin: 'Join Room',
        yourName: 'Your nickname',
        namePlaceholder: 'e.g. Kaelen',
        roomSize: 'Table Size',
        createBtn: 'Create Room',
        codeLabel: 'Room Code',
        codePlaceholder: 'E.G. A7K9P2',
        joinBtn: 'Join Room',
        roomCode: 'Shareable Code',
        copyCode: 'Copy code',
        copyLink: 'Copy link',
        copied: 'Copied!',
        fillBots: 'Fill empty seats with AI bots',
        hostBadge: 'Host',
        botBadge: 'AI',
        waitingSeat: 'Waiting for player...',
        readyBadge: 'Ready',
        offlineBadge: 'Offline',
        startMatch: 'Start Match',
        leaveRoom: 'Leave Room',
        waitingHost: 'Waiting for host to start the match...',
        needPlayers: 'Invite at least 1 friend or enable AI bots.',
        stakeLabel: 'Stake per player',
        freeOption: 'Free',
        potPreview: 'Winner takes pot',
        tabPublic: 'Public Rooms',
        quickMatchBtn: 'Quick Match',
        visibilityLabel: 'Room Visibility',
        privateRoom: 'Private (code)',
        publicRoom: 'Public',
        noPublicRooms: 'No public rooms waiting right now. Hit Quick Match or open a public table!',
        refreshList: 'Refresh',
        joinShort: 'Join',
        playersRatio: '{count}/{max} players',
        tableChat: 'Table Chat',
        chatPlaceholder: 'Message players...',
        customStakeLabel: 'Custom stake',
        customStakePlaceholder: 'e.g. 350',
        applyStake: 'Apply',
      },
    },
    board: {
      menuBtn: 'Menu',
      hideHud: 'Hide menu & turn bar',
      showHud: 'Show menu & turn bar',
      pot: 'Pot',
      practiceTable: 'Practice Table',
      turnLabel: 'Turn',
      humanBadge: 'HUMAN',
      aiBadge: 'AI',
      youTag: 'You',
      homeProgress: 'Home',
      emptySeat: 'Empty',
      pauseTitle: 'Table Menu',
      pauseDesc: 'Manage your active Ludo Arena match or return to the lobby.',
      resume: 'Resume Match',
      restart: 'Restart Table',
      exitLobby: 'Exit to Lobby',
      matchComplete: 'Match Complete',
      winsTitle: 'Wins!',
      winPotDesc: 'Arena Coins awarded to the champion.',
      winPracticeDesc: 'All four tokens reached the central crown.',
      playAgain: 'Play Again',
      returnLobby: 'Return to Lobby',
      footerTip: 'Ludo Arena · Roll the dice & reach the center',
      status: {
        yourTurn: 'Your turn! Click your dice or press Space.',
        playerTurn: "{name}'s turn. Roll the dice!",
        aiThinking: '{name} is preparing to roll...',
        rolling: 'Rolling...',
        threeSixes: 'Three 6s in a row! Turn forfeited.',
        noMoves: 'Rolled {roll} — no legal moves available.',
        selectOneToken: 'Rolled {roll}! Click the highlighted token to move.',
        selectManyTokens: 'Rolled {roll}! Select one of your {count} movable tokens.',
        autoDeploying: 'Rolled a 6! Auto-deploying token onto start...',
        autoMoving: 'Rolled {roll}! Auto-moving the only available token...',
        aiChoseRoll: '{name} rolled {roll}, choosing move...',
        bonusCapture: 'Capture bonus!',
        captureReturning: "Capture! {victim}'s token returning step-by-step to base...",
        bonusHome: 'Home Goal bonus!',
        bonusSix: 'Rolled a 6!',
        rollsAgain: '{name} rolls again.',
        claimedCrown: '{name} claimed the Arena Crown!',
      },
      events: {
        tableSeated: 'Table seated. Roll a 6 to deploy your first token from base.',
        matchStarted: '{title} started ({count} players).',
        playersCount: 'players',
        captured: "{actor} captured {victim}'s token! Bonus roll awarded.",
        reachedHome: '{actor} guided a token into Home Goal!',
        landedSafe: '{actor} landed on a Safe Rune.',
        deployed: '{actor} deployed a token onto the track.',
        advanced: '{actor} advanced {roll} spaces.',
        rolled: '{actor} rolled a {roll}.',
        threeSixesLog: '{actor} rolled three 6s in a row — turn forfeited.',
        wonMatch: '{name} wins the match!',
      },
      titles: {
        quick4p: 'Cyber-Luxe 4P Table',
        duel2p: '1v1 Cyber Duel',
        passPlay: 'Local Pass & Play',
        onlineRoom: 'Online Room · {code}',
        duelVs: '1v1 Duel vs {name}',
      },
    },
    telemetry: {
      activeTable: 'Active Table',
      arenaSummary: 'Arena Summary',
      ready: 'Ready',
      turn: 'Turn',
      prizePool: 'Prize Pool',
      activeSeat: 'Active Seat',
      lobby: 'Lobby',
      safeRunes: '8 Safe Runes Active',
      forfeitRule: '3×6 Forfeit Rule',
      matchLog: 'Match Log',
      tableChat: 'Table Chat',
      emptyLog: 'Roll the dice or start a match to stream live actions here.',
      arenaSource: 'Arena',
      messagePlaceholder: 'Message table...',
      quickPhrases: ['Good luck!', 'Nice roll!', 'Close call!', 'GG'],
      botReplies: [
        'Sharp play!',
        'Watch out on the star tiles.',
        'Let’s see what the dice say!',
        'Respect!',
      ],
    },
    tournaments: {
      kicker: 'Season 4 Championship Circuit',
      title: 'Arena Tournaments',
      subtitle:
        'Enter knockout brackets and high-stakes Ludo cups. Winning a tournament table awards the full prize pool to your vault.',
      weeklyJackpot: 'Weekly Jackpot',
      allCups: 'All Cups',
      statuses: {
        live: 'Live Now',
        registering: 'Registering',
        upcoming: 'Upcoming',
      },
      entryFee: 'Entry Fee',
      prizePool: 'Prize Pool',
      seats: 'Seats',
      launchCup: 'Launch Cup Table',
      enterCup: 'Enter Cup',
      coinsUnit: 'Coins',
      insufficientCoins: 'Insufficient Coins',
      items: {
        'neon-grand-prix': {
          title: 'Neon Grand Prix',
          subtitle: '4-Player Knockout · Standard Rules',
          startsIn: 'Seat Open',
        },
        'midnight-duel-cup': {
          title: 'Midnight Duel Masters',
          subtitle: '1v1 Opposite Corner Blitz',
          startsIn: '4m 20s',
        },
        'obsidian-open': {
          title: 'Obsidian Open Table',
          subtitle: '4-Player Casual · Low Stake',
          startsIn: '12m 00s',
        },
        'solar-invitational': {
          title: 'Solar Crown Invitational',
          subtitle: 'High-Roller 4-Player Championship',
          startsIn: '28m 15s',
        },
      },
    },
    leaderboard: {
      kicker: 'Ranked Ladder',
      title: 'Global Leaderboard',
      subtitle: 'Standings update automatically as you claim arena victories.',
      yourStanding: 'Your Standing',
      scopes: {
        global: 'Global',
        friends: 'Friends',
        weekly: 'Weekly',
      },
      searchPlaceholder: 'Filter competitor...',
      colRank: 'Rank',
      colCompetitor: 'Competitor',
      colElo: 'ELO',
      colWinRate: 'Win Rate',
      colEarnings: 'Earnings',
      emptyFilter: 'No competitors match your filter.',
      youTag: '(You)',
      winsShort: 'W',
    },
    inventory: {
      kicker: 'Coin Exchange & Skins',
      title: 'Ludo Arena Shop',
      subtitle:
        'Buy or sell arena coins effortlessly and unlock exclusive dice skins, tokens, and boards.',
      tabs: {
        coins: 'Coins · Buy / Sell',
        all: 'All Skins',
        dice: 'Dice Skins',
        token: 'Token Chips',
        board: 'Board Themes',
      },
      categories: {
        dice: 'Dice',
        token: 'Token',
        board: 'Board',
      },
      rarities: {
        Standard: 'Standard',
        Rare: 'Rare',
        Mythic: 'Mythic',
      },
      equipped: 'Equipped',
      equip: 'Equip Loadout',
      unlock: 'Unlock',
      coinShop: {
        buyTitle: 'Buy Coins',
        buySubtitle: 'Rate: {rate} per 1,000 coins',
        sellTitle: 'Sell Coins',
        sellSubtitle: 'Payout: {rate} per 1,000 coins',
        customAmount: 'Custom amount (coins)',
        paymentMethod: 'Payment method',
        payoutMethod: 'Payout method',
        payoutDestination: 'Phone / IBAN / PayPal email',
        payoutPlaceholder: 'e.g. +1 555... or PayPal email',
        buyBtn: 'Buy {coins} coins · {price}',
        sellBtn: 'Sell {coins} coins · +{price}',
        instantNote: 'Coins are credited immediately to your wallet.',
        manualNote: 'Order submitted to platform admin for approval.',
        sellNote: 'Coins are reserved immediately until an admin confirms payout.',
        minSellHint: 'Minimum {min} coins required to sell.',
        disabledMsg: 'Temporarily disabled by platform administrator.',
        signInRequired: 'Sign in with Google to buy or sell coins.',
        ordersTitle: 'Your Coin Buy & Sell Orders',
        emptyOrders: 'No coin buy or sell orders recorded yet.',
        orderBuyLabel: 'Buy',
        orderSellLabel: 'Sell',
        statusPending: 'Pending',
        statusCompleted: 'Completed',
        statusRejected: 'Rejected',
        buySuccessInstant: '+{coins} coins credited to your wallet!',
        buySuccessPending: 'Buy order for {coins} coins submitted for review.',
        sellSuccessPending: 'Sell request for {coins} coins submitted.',
        insufficientCoins: 'Insufficient balance or below minimum amount.',
        missingDestination: 'Enter your payout account details.',
      },
      items: {
        'obsidian-glass': {
          name: 'Obsidian Glass',
          description: 'Smoked dark crystal cube with crisp white pips and violet rim specular.',
        },
        'solar-amber': {
          name: 'Solar Amber',
          description: 'Molten gold-tinted alloy die with warm amber luminescence.',
        },
        'cyber-prism': {
          name: 'Cyber Prism',
          description: 'Translucent cyan ice cube with high-contrast aqua pips.',
        },
        'arcade-chip': {
          name: 'Arcade Weighted',
          description: 'Classic concentric casino chip with notched chamfered outer ridge.',
        },
        'carbon-ring': {
          name: 'Carbon Halo',
          description: 'Stealth matte core surrounded by an illuminated precision ring.',
        },
        'royal-crown': {
          name: 'Sovereign Crest',
          description: 'Championship pawn embossed with a metallic center crown insignia.',
        },
        'midnight-obsidian': {
          name: 'Classic Luxe',
          description: 'Crisp white Ludo King grid framed inside deep obsidian slate.',
        },
        'cobalt-vault': {
          name: 'Cobalt Vault',
          description: 'Cool azure-tinted surface with precision sapphire lane borders.',
        },
        'emerald-circuit': {
          name: 'Emerald Circuit',
          description: 'Cool mint-slate tournament surface with emerald track lines.',
        },
      },
    },
    social: {
      kicker: 'Rivals & Squads',
      title: 'Social Arena',
      subtitle:
        'Challenge rivals to an instant 1v1 high-stakes Ludo duel or invite new players by handle.',
      placeholder: '@player.handle',
      addRival: 'Add Rival',
      alreadyAdded: '{handle} is already on your rival list.',
      addedSuccess: 'Added {handle} to your Arena roster.',
      duelBtn: 'Duel 1v1',
      statusOnline: 'Online',
      statusInMatch: 'In Match',
      statusAway: 'Away',
      vsYou: 'vs You',
    },
    vault: {
      title: 'Arena Coin Vault',
      balance: 'Current balance:',
      dailyTitle: 'Daily Competitor Stipend',
      dailyDesc: 'Free +1,000 Arena Coins for daily matches',
      claimed: 'Claimed',
      claimBtn: 'Claim +1,000',
      refillTitle: 'Practice Bankroll Refill',
      refillDesc: 'Top up +500 coins anytime for table wagers',
      addBtn: 'Add +500',
    },
    auth: {
      signInGoogle: 'Sign in with Google',
      signInShort: 'Sign In',
      signOut: 'Sign Out',
      accountBtn: 'Account & History',
      accountTitle: 'Google Account & Persistence',
      connectedBadge: 'Synced to Firestore',
      guestBadge: 'Guest Mode',
      guestDesc:
        'Sign in with Google to persist your wallet, token/skin purchase history, and room participation across sessions.',
      authError: 'Google sign-in was cancelled or blocked. Please try again.',
      statsElo: 'ELO',
      statsWins: 'Wins',
      statsMatches: 'Matches',
      statsEarnings: 'Total Earnings',
      tabWallet: 'Wallet',
      tabPurchases: 'Token Purchases',
      tabRooms: 'Rooms',
      emptyWallet: 'No wallet transactions recorded yet.',
      emptyPurchases: 'No token, skin, or coin pack purchases yet.',
      emptyRooms: 'No room participation history yet.',
      outcomes: {
        win: 'Win',
        loss: 'Loss',
        joined: 'In Progress',
        abandoned: 'Left',
      },
      roles: {
        host: 'Host',
        guest: 'Guest',
        solo: 'Solo',
      },
    },
  },
};

export function fmt(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replaceAll(`{${key}}`, String(val)),
    template
  );
}
