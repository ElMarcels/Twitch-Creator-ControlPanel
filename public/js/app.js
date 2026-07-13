// ===== STATE =====
let currentUser = null;
let currentPage = 'dashboard-home';
let allRewards = [];
let selectedRewardColor = 'primary';
let currentModTab = 'followers';
let modData = { followers: [], chatters: [], banned: [], moderators: [], vips: [] };
let streamRefreshInterval = null;
let currentLang = localStorage.getItem('lang') || 'es';

// ===== I18N =====
const translations = {
  es: {
    nav_home: 'Inicio', nav_moderation: 'Moderacion', nav_channel_points: 'Puntos del Canal',
    nav_stream_config: 'Configurar Directo', nav_chat: 'Chat', nav_stats: 'Estadisticas',
    nav_predictions: 'Predicciones', nav_polls: 'Encuestas', nav_raids: 'Raids',
    nav_ads: 'Anuncios', nav_clips: 'Clips', nav_shield: 'Modo Escudo',
    nav_commands: 'Comandos', nav_goals: 'Metas', nav_chat_log: 'Log Chat',
    nav_settings: 'Ajustes', nav_about: 'Acerca de', nav_logout: 'Cerrar sesion',
    nav_spam: 'Spam Detector', nav_alerts_widget: 'Alertas', nav_share: 'Compartir',
    nav_mod_activity: 'Actividad Mods', nav_suspicious: 'Usuarios Sospechosos', nav_chat_rules: 'Reglas del Chat',
    settings_appearance: 'Apariencia', settings_theme: 'Tema',
    settings_theme_desc: 'Cambia entre tema oscuro y claro',
    theme_dark: 'Oscuro', theme_light: 'Claro',
    settings_language_title: 'Idioma', settings_language: 'Idioma',
    settings_language_desc: 'Selecciona el idioma de la interfaz',
    settings_info_title: 'Informacion', settings_version: 'Version',
    title_home: 'Inicio', title_moderation: 'Moderacion', title_channel_points: 'Puntos del Canal',
    title_stream_config: 'Configurar Directo', title_chat: 'Chat', title_stats: 'Estadisticas',
    title_predictions: 'Predicciones', title_polls: 'Encuestas', title_raid: 'Raids',
    title_ads: 'Anuncios', title_clips: 'Clips', title_shield: 'Modo Escudo',
    title_custom_commands: 'Comandos', title_goals: 'Metas', title_chat_log: 'Log del Chat',
    title_settings: 'Ajustes', title_about: 'Acerca de',
    title_spam: 'Spam Detector',
    title_mod_activity: 'Actividad de Moderadores',
    title_suspicious: 'Usuarios Sospechosos',
    title_chat_rules: 'Reglas del Chat',
    title_alerts_widget: 'Alertas en Vivo',
    title_share: 'Compartir Dashboard',
    stat_followers: 'Seguidores', stat_views: 'Visitas totales',
    stat_viewers: 'Espectadores', stat_stream_time: 'Tiempo en directo',
    login_subtitle: 'Administra tu canal con estilo. Moderacion, recompensas, estadisticas y mas.',
    login_btn: 'Iniciar sesion con Twitch',
    login_feat_mod: 'Moderacion avanzada', login_feat_stats: 'Estadisticas en vivo',
    login_feat_rewards: 'Recompensas totales',
    offline: 'Offline', online: 'En vivo',
    spam_config: 'Configuracion del detector', spam_enabled: 'Detector activo',
    spam_enabled_desc: 'Detectar mensajes repetitivos automaticamente',
    spam_max_msgs: 'Mensajes maximos', spam_max_msgs_desc: 'Mensajes permitidos en ventana de tiempo',
    spam_window: 'Ventana de tiempo (seg)', spam_window_desc: 'Segundos para contar mensajes',
    spam_log_title: 'Registro de spam detectado',
    alerts_title: 'Alertas en vivo', alerts_preview: 'Vista previa',
    alerts_test_sub: 'Test Sub', alerts_test_follow: 'Test Follow',
    alerts_test_bits: 'Test Bits',     alerts_history: 'Historial',
    mod_total_actions: 'Acciones totales', mod_active_mods: 'Mods activos',
    mod_bans_today: 'Bans hoy', mod_timeouts_today: 'Timeouts hoy',
    mod_leaderboard: 'Leaderboard de moderadores', mod_actions_log: 'Registro de acciones',
    suspicious_add_title: 'Agregar usuario sospechoso', suspicious_username: 'Nombre de usuario...',
    suspicious_reason_spam: 'Spam', suspicious_reason_raid: 'Raid no deseado',
    suspicious_reason_alt: 'Cuenta alterna', suspicious_reason_troll: 'Troll',
    suspicious_reason_other: 'Otro', suspicious_list_title: 'Usuarios sospechosos',
    btn_add: 'Agregar', btn_save: 'Guardar',
    rules_editor: 'Editor de reglas', rules_desc: 'Una regla por linea. Las reglas se muestran automaticamente a nuevos chatters.',
    rules_preview: 'Vista previa', rules_settings: 'Configuracion',
    rules_auto_greet: 'Saludo automatico', rules_auto_greet_desc: 'Enviar reglas a usuarios nuevos en el chat',
    rules_greet_delay: 'Retraso del saludo (seg)', rules_greet_delay_desc: 'Segundos antes de enviar las reglas',
    share_new: 'Compartir vista', share_desc: 'Crear enlace de tu configuracion actual',
    share_create: 'Crear enlace', share_active: 'Enlaces activos',
    settings_display: 'Pantalla', settings_compact: 'Modo compacto',
    settings_compact_desc: 'Reducir espaciado y tamano de elementos',
    settings_shortcuts: 'Atajos de teclado', settings_shortcuts_enable: 'Activar atajos',
    settings_shortcuts_enable_desc: 'Usar Alt+tecla para navegar',
    shortcut_1: 'Inicio', shortcut_29: 'Ajustes', shortcut_d: 'Dashboard',
    shortcut_r: 'Refrescar', shortcut_s: 'Configuracion', shortcut_esc: 'Cerrar modal'
  },
  en: {
    nav_home: 'Home', nav_moderation: 'Moderation', nav_channel_points: 'Channel Points',
    nav_stream_config: 'Stream Config', nav_chat: 'Chat', nav_stats: 'Statistics',
    nav_predictions: 'Predictions', nav_polls: 'Polls', nav_raids: 'Raids',
    nav_ads: 'Ads', nav_clips: 'Clips', nav_shield: 'Shield Mode',
    nav_commands: 'Commands', nav_goals: 'Goals', nav_chat_log: 'Chat Log',
    nav_settings: 'Settings', nav_about: 'About', nav_logout: 'Log out',
    nav_spam: 'Spam Detector', nav_alerts_widget: 'Alerts',
    nav_mod_activity: 'Mod Activity', nav_suspicious: 'Suspicious Users', nav_chat_rules: 'Chat Rules',
    settings_appearance: 'Appearance', settings_theme: 'Theme',
    settings_theme_desc: 'Switch between dark and light theme',
    theme_dark: 'Dark', theme_light: 'Light',
    settings_language_title: 'Language', settings_language: 'Language',
    settings_language_desc: 'Select the interface language',
    settings_info_title: 'Information', settings_version: 'Version',
    title_home: 'Home', title_moderation: 'Moderation', title_channel_points: 'Channel Points',
    title_stream_config: 'Stream Config', title_chat: 'Chat', title_stats: 'Statistics',
    title_predictions: 'Predictions', title_polls: 'Polls', title_raid: 'Raids',
    title_ads: 'Ads', title_clips: 'Clips', title_shield: 'Shield Mode',
    title_custom_commands: 'Commands', title_goals: 'Goals', title_chat_log: 'Chat Log',
    title_settings: 'Settings', title_about: 'About',
    title_spam: 'Spam Detector',
    title_mod_activity: 'Moderator Activity',
    title_suspicious: 'Suspicious Users',
    title_chat_rules: 'Chat Rules',
    title_alerts_widget: 'Live Alerts',
    title_share: 'Share Dashboard',
    stat_followers: 'Followers', stat_views: 'Total Views',
    stat_viewers: 'Viewers', stat_stream_time: 'Stream Time',
    login_subtitle: 'Manage your channel with style. Moderation, rewards, statistics and more.',
    login_btn: 'Log in with Twitch',
    login_feat_mod: 'Advanced moderation', login_feat_stats: 'Live statistics',
    login_feat_rewards: 'Full rewards',
    offline: 'Offline', online: 'Live',
    spam_config: 'Detector configuration', spam_enabled: 'Detector active',
    spam_enabled_desc: 'Automatically detect repetitive messages',
    spam_max_msgs: 'Max messages', spam_max_msgs_desc: 'Messages allowed in time window',
    spam_window: 'Time window (sec)', spam_window_desc: 'Seconds to count messages',
    spam_log_title: 'Spam detection log',
    alerts_title: 'Live alerts', alerts_preview: 'Preview',
    alerts_test_sub: 'Test Sub', alerts_test_follow: 'Test Follow',
    alerts_test_bits: 'Test Bits',     alerts_history: 'History',
    mod_total_actions: 'Total Actions', mod_active_mods: 'Active Mods',
    mod_bans_today: 'Bans Today', mod_timeouts_today: 'Timeouts Today',
    mod_leaderboard: 'Moderator Leaderboard', mod_actions_log: 'Actions Log',
    suspicious_add_title: 'Add Suspicious User', suspicious_username: 'Username...',
    suspicious_reason_spam: 'Spam', suspicious_reason_raid: 'Unwanted Raid',
    suspicious_reason_alt: 'Alt Account', suspicious_reason_troll: 'Troll',
    suspicious_reason_other: 'Other', suspicious_list_title: 'Suspicious Users',
    btn_add: 'Add', btn_save: 'Save',
    rules_editor: 'Rules Editor', rules_desc: 'One rule per line. Rules are auto-shown to new chatters.',
    rules_preview: 'Preview', rules_settings: 'Settings',
    rules_auto_greet: 'Auto Greeting', rules_auto_greet_desc: 'Send rules to new users in chat',
    rules_greet_delay: 'Greeting Delay (sec)', rules_greet_delay_desc: 'Seconds before sending rules',
    share_new: 'Share view', share_desc: 'Create link to your current setup',
    share_create: 'Create link', share_active: 'Active links',
    settings_display: 'Display', settings_compact: 'Compact mode',
    settings_compact_desc: 'Reduce spacing and element size',
    settings_shortcuts: 'Keyboard shortcuts', settings_shortcuts_enable: 'Enable shortcuts',
    settings_shortcuts_enable_desc: 'Use Alt+key to navigate',
    shortcut_1: 'Home', shortcut_29: 'Settings', shortcut_d: 'Dashboard',
    shortcut_r: 'Refresh', shortcut_s: 'Settings', shortcut_esc: 'Close modal'
  },
  de: {
    nav_home: 'Startseite', nav_moderation: 'Moderation', nav_channel_points: 'Kanalpunkte',
    nav_stream_config: 'Stream-Konfig', nav_chat: 'Chat', nav_stats: 'Statistiken',
    nav_predictions: 'Vorhersagen', nav_polls: 'Umfragen', nav_raids: 'Raids',
    nav_ads: 'Werbung', nav_clips: 'Clips', nav_shield: 'Schutzmodus',
    nav_commands: 'Befehle', nav_goals: 'Ziele', nav_chat_log: 'Chat-Log',
    nav_settings: 'Einstellungen', nav_about: 'Uber', nav_logout: 'Abmelden',
    nav_spam: 'Spam Detektor', nav_alerts_widget: 'Alerten',
    nav_mod_activity: 'Mod Aktivitaet', nav_suspicious: 'Verdaechtige User', nav_chat_rules: 'Chat Regeln',
    settings_appearance: 'Darstellung', settings_theme: 'Thema',
    settings_theme_desc: 'Zwischen dunklem und hellem Thema wechseln',
    theme_dark: 'Dunkel', theme_light: 'Hell',
    settings_language_title: 'Sprache', settings_language: 'Sprache',
    settings_language_desc: 'Wahle die Oberflachensprache',
    settings_info_title: 'Information', settings_version: 'Version',
    title_home: 'Startseite', title_moderation: 'Moderation', title_channel_points: 'Kanalpunkte',
    title_stream_config: 'Stream-Konfig', title_chat: 'Chat', title_stats: 'Statistiken',
    title_predictions: 'Vorhersagen', title_polls: 'Umfragen', title_raid: 'Raids',
    title_ads: 'Werbung', title_clips: 'Clips', title_shield: 'Schutzmodus',
    title_custom_commands: 'Befehle', title_goals: 'Ziele', title_chat_log: 'Chat-Log',
    title_settings: 'Einstellungen', title_about: 'Uber',
    title_spam: 'Spam Detektor',
    title_mod_activity: 'Mod Aktivitaet',
    title_suspicious: 'Verdaechtige User',
    title_chat_rules: 'Chat Regeln',
    title_alerts_widget: 'Live Alerten',
    title_share: 'Dashboard Teilen',
    stat_followers: 'Follower', stat_views: 'Gesamtaufrufe',
    stat_viewers: 'Zuschauer', stat_stream_time: 'Streamzeit',
    login_subtitle: 'Verwalte deinen Kanal mit Stil. Moderation, Belohnungen, Statistiken und mehr.',
    login_btn: 'Mit Twitch anmelden',
    login_feat_mod: 'Erweiterte Moderation', login_feat_stats: 'Live-Statistiken',
    login_feat_rewards: 'Volle Belohnungen',
    offline: 'Offline', online: 'Live',
    spam_config: 'Detektor Konfiguration', spam_enabled: 'Detektor aktiv',
    spam_enabled_desc: 'Wiederholte Nachrichten automatisch erkennen',
    spam_max_msgs: 'Max Nachrichten', spam_max_msgs_desc: 'Nachrichten im Zeitfenster erlaubt',
    spam_window: 'Zeitfenster (Sek)', spam_window_desc: 'Sekunden zum Zaehlen',
    spam_log_title: 'Spam-Erkennungslog',
    alerts_title: 'Live-Alerten', alerts_preview: 'Vorschau',
    alerts_test_sub: 'Test Sub', alerts_test_follow: 'Test Follow',
    alerts_test_bits: 'Test Bits',     alerts_history: 'Verlauf',
    mod_total_actions: 'Aktionen gesamt', mod_active_mods: 'Aktive Mods',
    mod_bans_today: 'Bans heute', mod_timeouts_today: 'Timeouts heute',
    mod_leaderboard: 'Mod Rangliste', mod_actions_log: 'Aktionslog',
    suspicious_add_title: 'Verdaechtigen User hinzufuegen', suspicious_username: 'Benutzername...',
    suspicious_reason_spam: 'Spam', suspicious_reason_raid: 'Unerwuenschter Raid',
    suspicious_reason_alt: 'Alternatives Konto', suspicious_reason_troll: 'Troll',
    suspicious_reason_other: 'Sonstiges', suspicious_list_title: 'Verdaechtige User',
    btn_add: 'Hinzufuegen', btn_save: 'Speichern',
    rules_editor: 'Regel-Editor', rules_desc: 'Eine Regel pro Zeile. Regeln werden neuen Chattern automatisch angezeigt.',
    rules_preview: 'Vorschau', rules_settings: 'Einstellungen',
    rules_auto_greet: 'Automatische Begruessung', rules_auto_greet_desc: 'Regeln an neue Benutzer im Chat senden',
    rules_greet_delay: 'Begruessungsverzoegerung (sek)', rules_greet_delay_desc: 'Sekunden vor dem Senden der Regeln',
    share_new: 'Ansicht teilen', share_desc: 'Link zu deinem aktuellen Setup erstellen',
    share_create: 'Link erstellen', share_active: 'Aktive Links',
    settings_display: 'Anzeige', settings_compact: 'Kompakter Modus',
    settings_compact_desc: 'Abstaende und Elementgroesse reduzieren',
    settings_shortcuts: 'Tastenkuerzel', settings_shortcuts_enable: 'Kuerzel aktivieren',
    settings_shortcuts_enable_desc: 'Alt+Taste zum Navigieren nutzen',
    shortcut_1: 'Start', shortcut_29: 'Einstellungen', shortcut_d: 'Dashboard',
    shortcut_r: 'Aktualisieren', shortcut_s: 'Einstellungen', shortcut_esc: 'Modal schliessen'
  },
  fr: {
    nav_home: 'Accueil', nav_moderation: 'Moderation', nav_channel_points: 'Points de chaine',
    nav_stream_config: 'Config Stream', nav_chat: 'Chat', nav_stats: 'Statistiques',
    nav_predictions: 'Predictions', nav_polls: 'Sondages', nav_raids: 'Raids',
    nav_ads: 'Publicites', nav_clips: 'Clips', nav_shield: 'Mode Bouclier',
    nav_commands: 'Commandes', nav_goals: 'Objectifs', nav_chat_log: 'Journal Chat',
    nav_settings: 'Parametres', nav_about: 'A propos', nav_logout: 'Deconnexion',
    nav_spam: 'Detecteur Spam', nav_alerts_widget: 'Alertes',
    nav_mod_activity: 'Activite Mod', nav_suspicious: 'Utilisateurs Suspects', nav_chat_rules: 'Regles du Chat',
    settings_appearance: 'Apparence', settings_theme: 'Theme',
    settings_theme_desc: 'Basculer entre le theme sombre et clair',
    theme_dark: 'Sombre', theme_light: 'Clair',
    settings_language_title: 'Langue', settings_language: 'Langue',
    settings_language_desc: 'Selectionnez la langue de l\'interface',
    settings_info_title: 'Information', settings_version: 'Version',
    title_home: 'Accueil', title_moderation: 'Moderation', title_channel_points: 'Points de chaine',
    title_stream_config: 'Config Stream', title_chat: 'Chat', title_stats: 'Statistiques',
    title_predictions: 'Predictions', title_polls: 'Sondages', title_raid: 'Raids',
    title_ads: 'Publicites', title_clips: 'Clips', title_shield: 'Mode Bouclier',
    title_custom_commands: 'Commandes', title_goals: 'Objectifs', title_chat_log: 'Journal Chat',
    title_settings: 'Parametres', title_about: 'A propos',
    title_spam: 'Detecteur Spam',
    title_mod_activity: 'Activite Mod',
    title_suspicious: 'Utilisateurs Suspects',
    title_chat_rules: 'Regles du Chat',
    title_alerts_widget: 'Alertes En Direct',
    title_share: 'Partager Dashboard',
    stat_followers: 'Abonnes', stat_views: 'Vues totales',
    stat_viewers: 'Spectateurs', stat_stream_time: 'Temps en direct',
    login_subtitle: 'Gerez votre chaine avec style. Moderation, recompenses, statistiques et plus.',
    login_btn: 'Se connecter avec Twitch',
    login_feat_mod: 'Moderation avancee', login_feat_stats: 'Statistiques en direct',
    login_feat_rewards: 'Recompenses completes',
    offline: 'Hors ligne', online: 'En direct',
    spam_config: 'Configuration du detecteur', spam_enabled: 'Detecteur actif',
    spam_enabled_desc: 'Detecter automatiquement les messages repetitifs',
    spam_max_msgs: 'Messages max', spam_max_msgs_desc: 'Messages autorises dans la fenetre',
    spam_window: 'Fenetre de temps (sec)', spam_window_desc: 'Secondes pour compter',
    spam_log_title: 'Journal de spam detecte',
    alerts_title: 'Alertes en direct', alerts_preview: 'Apercu',
    alerts_test_sub: 'Test Sub', alerts_test_follow: 'Test Follow',
    alerts_test_bits: 'Test Bits',     alerts_history: 'Historique',
    mod_total_actions: 'Actions totales', mod_active_mods: 'Mods actifs',
    mod_bans_today: 'Bans aujourd\'hui', mod_timeouts_today: 'Timeouts aujourd\'hui',
    mod_leaderboard: 'Classement des moderateurs', mod_actions_log: 'Journal des actions',
    suspicious_add_title: 'Ajouter utilisateur suspect', suspicious_username: 'Nom d\'utilisateur...',
    suspicious_reason_spam: 'Spam', suspicious_reason_raid: 'Raid non desire',
    suspicious_reason_alt: 'Compte alternatif', suspicious_reason_troll: 'Troll',
    suspicious_reason_other: 'Autre', suspicious_list_title: 'Utilisateurs suspects',
    btn_add: 'Ajouter', btn_save: 'Sauvegarder',
    rules_editor: 'Editeur de regles', rules_desc: 'Une regle par ligne. Les regles sont affichees automatiquement aux nouveaux utilisateurs.',
    rules_preview: 'Apercu', rules_settings: 'Configuration',
    rules_auto_greet: 'Salutation automatique', rules_auto_greet_desc: 'Envoyer les regles aux nouveaux utilisateurs',
    rules_greet_delay: 'Delai de salutation (sec)', rules_greet_delay_desc: 'Secondes avant d\'envoyer les regles',
    share_new: 'Partager la vue', share_desc: 'Creer un lien de votre configuration',
    share_create: 'Creer le lien', share_active: 'Liens actifs',
    settings_display: 'Affichage', settings_compact: 'Mode compact',
    settings_compact_desc: 'Reduire l\'espacement et la taille',
    settings_shortcuts: 'Raccourcis clavier', settings_shortcuts_enable: 'Activer les raccourcis',
    settings_shortcuts_enable_desc: 'Utiliser Alt+touche pour naviguer',
    shortcut_1: 'Accueil', shortcut_29: 'Reglages', shortcut_d: 'Tableau de bord',
    shortcut_r: 'Actualiser', shortcut_s: 'Reglages', shortcut_esc: 'Fermer la modale'
  },
  pt: {
    nav_home: 'Inicio', nav_moderation: 'Moderacao', nav_channel_points: 'Pontos do Canal',
    nav_stream_config: 'Config da Live', nav_chat: 'Chat', nav_stats: 'Estatisticas',
    nav_predictions: 'Previsoes', nav_polls: 'Enquetes', nav_raids: 'Raids',
    nav_ads: 'Anuncios', nav_clips: 'Clips', nav_shield: 'Modo Escudo',
    nav_commands: 'Comandos', nav_goals: 'Metas', nav_chat_log: 'Log do Chat',
    nav_settings: 'Configuracoes', nav_about: 'Sobre', nav_logout: 'Sair',
    nav_spam: 'Detector Spam', nav_alerts_widget: 'Alertas',
    nav_mod_activity: 'Atividade Mods', nav_suspicious: 'Usuarios Suspeitos', nav_chat_rules: 'Regras do Chat',
    settings_appearance: 'Aparencia', settings_theme: 'Tema',
    settings_theme_desc: 'Alternar entre tema escuro e claro',
    theme_dark: 'Escuro', theme_light: 'Claro',
    settings_language_title: 'Idioma', settings_language: 'Idioma',
    settings_language_desc: 'Selecione o idioma da interface',
    settings_info_title: 'Informacao', settings_version: 'Versao',
    title_home: 'Inicio', title_moderation: 'Moderacao', title_channel_points: 'Pontos do Canal',
    title_stream_config: 'Config da Live', title_chat: 'Chat', title_stats: 'Estatisticas',
    title_predictions: 'Previsoes', title_polls: 'Enquetes', title_raid: 'Raids',
    title_ads: 'Anuncios', title_clips: 'Clips', title_shield: 'Modo Escudo',
    title_custom_commands: 'Comandos', title_goals: 'Metas', title_chat_log: 'Log do Chat',
    title_settings: 'Configuracoes', title_about: 'Sobre',
    title_spam: 'Detector Spam',
    title_mod_activity: 'Atividade de Mods',
    title_suspicious: 'Usuarios Suspeitos',
    title_chat_rules: 'Regras do Chat',
    title_alerts_widget: 'Alertas ao Vivo',
    title_share: 'Compartilhar Dashboard',
    stat_followers: 'Seguidores', stat_views: 'Visualizacoes',
    stat_viewers: 'Espectadores', stat_stream_time: 'Tempo ao vivo',
    login_subtitle: 'Gerencie seu canal com estilo. Moderacao, recompensas, estatisticas e mais.',
    login_btn: 'Entrar com Twitch',
    login_feat_mod: 'Moderacao avancada', login_feat_stats: 'Estatisticas ao vivo',
    login_feat_rewards: 'Recompensas completas',
    offline: 'Offline', online: 'Ao vivo',
    spam_config: 'Configuracao do detector', spam_enabled: 'Detector ativo',
    spam_enabled_desc: 'Detectar automaticamente mensagens repetitivas',
    spam_max_msgs: 'Maximo de msgs', spam_max_msgs_desc: 'Mensagens permitidas na janela',
    spam_window: 'Janela de tempo (seg)', spam_window_desc: 'Segundos para contar',
    spam_log_title: 'Registro de spam detectado',
    alerts_title: 'Alertas ao vivo', alerts_preview: 'Visualizar',
    alerts_test_sub: 'Testar Sub', alerts_test_follow: 'Testar Follow',
    alerts_test_bits: 'Testar Bits',     alerts_history: 'Historico',
    mod_total_actions: 'Acoes totais', mod_active_mods: 'Mods ativos',
    mod_bans_today: 'Bans hoje', mod_timeouts_today: 'Timeouts hoje',
    mod_leaderboard: 'Ranking de moderadores', mod_actions_log: 'Registro de acoes',
    suspicious_add_title: 'Adicionar usuario suspeito', suspicious_username: 'Nome de usuario...',
    suspicious_reason_spam: 'Spam', suspicious_reason_raid: 'Raid indesejado',
    suspicious_reason_alt: 'Conta alternativa', suspicious_reason_troll: 'Troll',
    suspicious_reason_other: 'Outro', suspicious_list_title: 'Usuarios suspeitos',
    btn_add: 'Adicionar', btn_save: 'Salvar',
    rules_editor: 'Editor de regras', rules_desc: 'Uma regra por linha. Regras sao exibidas automaticamente para novos usuarios.',
    rules_preview: 'Visualizar', rules_settings: 'Configuracao',
    rules_auto_greet: 'Saudacao automatica', rules_auto_greet_desc: 'Enviar regras para novos usuarios no chat',
    rules_greet_delay: 'Atraso da saudacao (seg)', rules_greet_delay_desc: 'Segundos antes de enviar as regras',
    share_new: 'Compartilhar vista', share_desc: 'Criar link da sua configuracao',
    share_create: 'Criar link', share_active: 'Links ativos',
    settings_display: 'Tela', settings_compact: 'Modo compacto',
    settings_compact_desc: 'Reduzir espacamento e tamanho',
    settings_shortcuts: 'Atalhos de teclado', settings_shortcuts_enable: 'Ativar atalhos',
    settings_shortcuts_enable_desc: 'Usar Alt+tecla para navegar',
    shortcut_1: 'Inicio', shortcut_29: 'Configuracoes', shortcut_d: 'Painel',
    shortcut_r: 'Atualizar', shortcut_s: 'Configuracoes', shortcut_esc: 'Fechar modal'
  },
  ja: {
    nav_home: 'ホーム', nav_moderation: 'モデレーション', nav_channel_points: 'チャンネルポイント',
    nav_stream_config: '配信設定', nav_chat: 'チャット', nav_stats: '統計',
    nav_predictions: '予測', nav_polls: 'アンケート', nav_raids: 'レイド',
    nav_ads: '広告', nav_clips: 'クリップ', nav_shield: 'シールドモード',
    nav_commands: 'コマンド', nav_goals: '目標', nav_chat_log: 'チャット履歴',
    nav_settings: '設定', nav_about: '概要', nav_logout: 'ログアウト',
    nav_spam: 'スパム検出', nav_alerts_widget: 'アラート',
    nav_mod_activity: 'モデレーター活動', nav_suspicious: '不審なユーザー', nav_chat_rules: 'チャットルール',
    settings_appearance: '外観', settings_theme: 'テーマ',
    settings_theme_desc: 'ダークテーマとライトテーマを切り替え',
    theme_dark: 'ダーク', theme_light: 'ライト',
    settings_language_title: '言語', settings_language: '言語',
    settings_language_desc: 'インターフェースの言語を選択',
    settings_info_title: '情報', settings_version: 'バージョン',
    title_home: 'ホーム', title_moderation: 'モデレーション', title_channel_points: 'チャンネルポイント',
    title_stream_config: '配信設定', title_chat: 'チャット', title_stats: '統計',
    title_predictions: '予測', title_polls: 'アンケート', title_raid: 'レイド',
    title_ads: '広告', title_clips: 'クリップ', title_shield: 'シールドモード',
    title_custom_commands: 'コマンド', title_goals: '目標', title_chat_log: 'チャット履歴',
    title_settings: '設定', title_about: '概要',
    title_spam: 'スパム検出',
    title_mod_activity: 'モデレーター活動',
    title_suspicious: '不審なユーザー',
    title_chat_rules: 'チャットルール',
    title_alerts_widget: 'ライブアラート',
    title_share: 'ダッシュボード共有',
    stat_followers: 'フォロワー', stat_views: '総視聴数',
    stat_viewers: '視聴者', stat_stream_time: '配信時間',
    login_subtitle: 'チャンネルをスタイリッシュに管理。モデレーション、報酬、統計など。',
    login_btn: 'Twitchでログイン',
    login_feat_mod: '高度なモデレーション', login_feat_stats: 'ライブ統計',
    login_feat_rewards: '完全な報酬',
    offline: 'オフライン', online: 'ライブ',
    spam_config: '検出器設定', spam_enabled: '検出器有効',
    spam_enabled_desc: '繰り返しメッセージを自動検出',
    spam_max_msgs: '最大メッセージ数', spam_max_msgs_desc: '時間枠内の許可メッセージ数',
    spam_window: '時間枠（秒）', spam_window_desc: 'カウントする秒数',
    spam_log_title: 'スパム検出ログ',
    alerts_title: 'ライブアラート', alerts_preview: 'プレビュー',
    alerts_test_sub: 'テストSub', alerts_test_follow: 'テストFollow',
    alerts_test_bits: 'テストBits',     alerts_history: '履歴',
    mod_total_actions: '合計アクション', mod_active_mods: 'アクティブMod',
    mod_bans_today: '今日のBans', mod_timeouts_today: '今日のTimeouts',
    mod_leaderboard: 'モデレーターランキング', mod_actions_log: 'アクションログ',
    suspicious_add_title: '不審なユーザーを追加', suspicious_username: 'ユーザー名...',
    suspicious_reason_spam: 'スパム', suspicious_reason_raid: '不要なレイド',
    suspicious_reason_alt: 'サブアカウント', suspicious_reason_troll: 'トロル',
    suspicious_reason_other: 'その他', suspicious_list_title: '不審なユーザー',
    btn_add: '追加', btn_save: '保存',
    rules_editor: 'ルールエディター', rules_desc: '1行に1ルール。ルールは新しいチャッターに自動表示されます。',
    rules_preview: 'プレビュー', rules_settings: '設定',
    rules_auto_greet: '自動挨拶', rules_auto_greet_desc: '新しいユーザーにルールを送信',
    rules_greet_delay: '挨拶の遅延（秒）', rules_greet_delay_desc: 'ルール送信前の秒数',
    share_new: 'ビューを共有', share_desc: '現在のセットアップのリンクを作成',
    share_create: 'リンク作成', share_active: 'アクティブリンク',
    settings_display: '表示', settings_compact: 'コンパクトモード',
    settings_compact_desc: '間隔と要素サイズを縮小',
    settings_shortcuts: 'キーボードショートカット', settings_shortcuts_enable: 'ショートカット有効',
    settings_shortcuts_enable_desc: 'Alt+キーでナビゲート',
    shortcut_1: 'ホーム', shortcut_29: '設定', shortcut_d: 'ダッシュボード',
    shortcut_r: '更新', shortcut_s: '設定', shortcut_esc: 'モーダルを閉じる'
  },
  ko: {
    nav_home: '홈', nav_moderation: '채팅 관리', nav_channel_points: '채널 포인트',
    nav_stream_config: '방송 설정', nav_chat: '채팅', nav_stats: '통계',
    nav_predictions: '예측', nav_polls: '투표', nav_raids: '레이드',
    nav_ads: '광고', nav_clips: '클립', nav_shield: '실드 모드',
    nav_commands: '명령어', nav_goals: '목표', nav_chat_log: '채팅 기록',
    nav_settings: '설정', nav_about: '정보', nav_logout: '로그아웃',
    nav_spam: '스팸 감지', nav_alerts_widget: '알림',
    nav_mod_activity: '모더레이터 활동', nav_suspicious: '의심 사용자', nav_chat_rules: '채팅 규칙',
    settings_appearance: '외관', settings_theme: '테마',
    settings_theme_desc: '다크 테마와 라이트 테마 전환',
    theme_dark: '다크', theme_light: '라이트',
    settings_language_title: '언어', settings_language: '언어',
    settings_language_desc: '인터페이스 언어 선택',
    settings_info_title: '정보', settings_version: '버전',
    title_home: '홈', title_moderation: '채팅 관리', title_channel_points: '채널 포인트',
    title_stream_config: '방송 설정', title_chat: '채팅', title_stats: '통계',
    title_predictions: '예측', title_polls: '투표', title_raid: '레이드',
    title_ads: '광고', title_clips: '클립', title_shield: '실드 모드',
    title_custom_commands: '명령어', title_goals: '목표', title_chat_log: '채팅 기록',
    title_settings: '설정', title_about: '정보',
    title_spam: '스팸 감지',
    title_mod_activity: '모더레이터 활동',
    title_suspicious: '의심 사용자',
    title_chat_rules: '채팅 규칙',
    title_alerts_widget: '실시간 알림',
    title_share: '대시보드 공유',
    stat_followers: '팔로워', stat_views: '총 조회수',
    stat_viewers: '시청자', stat_stream_time: '방송 시간',
    login_subtitle: '채널을 스타일리시하게 관리. 채팅 관리, 보상, 통계 등.',
    login_btn: 'Twitch로 로그인',
    login_feat_mod: '고급 채팅 관리', login_feat_stats: '실시간 통계',
    login_feat_rewards: '완전한 보상',
    offline: '오프라인', online: '라이브',
    spam_config: '스팸 감지 설정', spam_enabled: '감지기 활성화',
    spam_enabled_desc: '반복 메시지를 자동 감지',
    spam_max_msgs: '최대 메시지 수', spam_max_msgs_desc: '시간 창에서 허용되는 메시지',
    spam_window: '시간 창 (초)', spam_window_desc: '메시지를 셀 초',
    spam_log_title: '스팸 감지 로그',
    alerts_title: '실시간 알림', alerts_preview: '미리보기',
    alerts_test_sub: '테스트 Sub', alerts_test_follow: '테스트 Follow',
    alerts_test_bits: '테스트 Bits',     alerts_history: '기록',
    mod_total_actions: '총 액션', mod_active_mods: '활성 Mod',
    mod_bans_today: '오늘의 Bans', mod_timeouts_today: '오늘의 Timeouts',
    mod_leaderboard: '모더레이터 랭킹', mod_actions_log: '액션 로그',
    suspicious_add_title: '의심 사용자 추가', suspicious_username: '사용자 이름...',
    suspicious_reason_spam: '스팸', suspicious_reason_raid: '원치 않는 레이드',
    suspicious_reason_alt: '부 계정', suspicious_reason_troll: '트롤',
    suspicious_reason_other: '기타', suspicious_list_title: '의심 사용자',
    btn_add: '추가', btn_save: '저장',
    rules_editor: '규칙 편집기', rules_desc: '줄당 규칙 1개. 새 채터에게 규칙이 자동으로 표시됩니다.',
    rules_preview: '미리보기', rules_settings: '설정',
    rules_auto_greet: '자동 인사', rules_auto_greet_desc: '새 사용자에게 규칙 전송',
    rules_greet_delay: '인사 지연 (초)', rules_greet_delay_desc: '규칙 전송 전 대기 초',
    share_new: '보기 공유', share_desc: '현재 설정의 링크 만들기',
    share_create: '링크 만들기', share_active: '활성 링크',
    settings_display: '화면', settings_compact: '컴팩트 모드',
    settings_compact_desc: '간격과 요소 크기 축소',
    settings_shortcuts: '키보드 단축키', settings_shortcuts_enable: '단축키 활성화',
    settings_shortcuts_enable_desc: 'Alt+키로 탐색',
    shortcut_1: '홈', shortcut_29: '설정', shortcut_d: '대시보드',
    shortcut_r: '새로고침', shortcut_s: '설정', shortcut_esc: '모달 닫기'
  }
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (el.tagName === 'INPUT' && el.type !== 'submit') {
      el.placeholder = translated;
    } else {
      el.textContent = translated;
    }
  });
  document.documentElement.lang = currentLang;
  const titleKey = 'title_' + currentPage.replace('dashboard-home', 'home');
  document.getElementById('pageTitle').textContent = t(titleKey) || t('title_home');
}

// ===== THEME =====
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function setupTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
  });
}

// ===== LANGUAGE =====
function setupLanguage() {
  const select = document.getElementById('languageSelect');
  if (select) {
    select.value = currentLang;
    select.addEventListener('change', () => {
      currentLang = select.value;
      localStorage.setItem('lang', currentLang);
      applyTranslations();
    });
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (checkAppealRoute()) return;
  applyTheme(localStorage.getItem('theme') || 'dark');
  setupTheme();
  setupLanguage();
  applyTranslations();
  loadCompactMode();
  loadShortcutsSettings();
  setupKeyboardShortcuts();
  checkAuth();
  setupNavigation();
  setupSidebar();
  setupModSearch();
  setupCategorySearch();
  setupColorBtns();
  setupChatInput();
});

// ===== AUTH =====
async function checkAuth() {
  try {
    const resp = await fetch('/auth/me');
    const data = await resp.json();
    if (data.authenticated && data.user) {
      currentUser = data.user;
      currentUser.role = data.role || null;
      currentUser.selectedChannelId = data.selectedChannelId || null;
      if (data.ownerUser) {
        currentUser._displayUser = data.ownerUser;
      }
      if (data.selectedChannelId) {
        showDashboard();
      } else {
        showChannelSelection();
      }
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-screen').style.display = '';
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('channels-screen').style.display = 'none';
  document.getElementById('dashboard').classList.add('hidden');
}

function showChannelSelection() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('channels-screen').style.display = '';
  document.getElementById('channels-screen').classList.remove('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  loadChannelSelection();
}

async function showDashboard() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('channels-screen').style.display = 'none';
  document.getElementById('dashboard').classList.remove('hidden');
  populateUserInfo();
  loadHomeData();
  startStreamRefresh();
  startViewerTracking();
  startFollowerTracking();
}

function populateUserInfo() {
  const u = currentUser._displayUser || currentUser;
  if (!u) return;
  document.getElementById('userAvatar').src = u.profile_image_url;
  document.getElementById('userName').textContent = u.display_name;
  document.getElementById('pageTitle').textContent = t('title_home');
}

// ===== CHANNEL SELECTION =====
async function loadChannelSelection() {
  if (!currentUser) return;

  const mySection = document.getElementById('myChannelSection');
  const modSection = document.getElementById('moderatedChannelsSection');
  const noChannels = document.getElementById('noChannelsMessage');
  const modList = document.getElementById('moderatedChannelsList');

  mySection.style.display = 'none';
  modSection.style.display = 'none';
  noChannels.style.display = 'none';
  modList.innerHTML = '';

  let hasAnyChannel = false;

  document.getElementById('myChannelAvatar').src = currentUser.profile_image_url;
  document.getElementById('myChannelName').textContent = currentUser.display_name;
  mySection.style.display = '';
  hasAnyChannel = true;

  try {
    const resp = await fetch('/api/user/moderated-channels');
    const data = await resp.json();
    const channels = data.data || [];

    if (channels.length > 0) {
      modSection.style.display = '';
      hasAnyChannel = true;
      modList.innerHTML = channels.map(ch => `
        <div class="channel-select-card" onclick="selectChannel('${ch.broadcaster_id}')" style="cursor:pointer;display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;transition:all 0.2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#9146ff,#772ce8);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:1.1rem;flex-shrink:0">${(ch.broadcaster_name || ch.broadcaster_login || '?')[0].toUpperCase()}</div>
          <div style="text-align:left;min-width:0">
            <div style="font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(ch.broadcaster_name || ch.broadcaster_login)}</div>
            <div style="font-size:0.78rem;color:var(--text-muted)">@${escapeHtml(ch.broadcaster_login)}</div>
          </div>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" style="margin-left:auto;opacity:0.4;flex-shrink:0"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading moderated channels:', err);
  }

  if (!hasAnyChannel) {
    noChannels.style.display = '';
  }
}

async function selectChannel(channelId) {
  let targetChannelId;
  if (channelId === 'my') {
    targetChannelId = currentUser.id;
  } else {
    targetChannelId = channelId;
  }

  try {
    const resp = await fetch('/auth/select-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId: targetChannelId })
    });
    const data = await resp.json();
    if (data.success) {
      await checkAuth();
    } else {
      showToast(data.error || 'Error al seleccionar canal', 'error');
    }
  } catch (err) {
    showToast('Error de conexion', 'error');
  }
}

// ===== NAVIGATION =====
function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titles = {
    'dashboard-home': t('title_home'),
    'moderation': t('title_moderation'),
    'channel-points': t('title_channel_points'),
    'stream-config': t('title_stream_config'),
    'chat-settings': t('title_chat'),
    'stats': t('title_stats'),
    'predictions': t('title_predictions'),
    'polls': t('title_polls'),
    'raid': t('title_raid'),
    'ads': t('title_ads'),
    'clips': t('title_clips'),
    'shield': t('title_shield'),
    'custom-commands': t('title_custom_commands'),
    'goals': t('title_goals'),
    'chat-log': t('title_chat_log'),
    'spam': t('title_spam'),
    'mod-activity': t('title_mod_activity'),
    'suspicious': t('title_suspicious'),
    'chat-rules': t('title_chat_rules'),
    'alerts-widget': t('title_alerts_widget'),
    'appeals': 'Solicitudes',
    'share': t('title_share'),
    'settings': t('title_settings'),
    'about': t('title_about')
  };
  document.getElementById('pageTitle').textContent = titles[page] || 'Dashboard';

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('open');

  loadPageData(page);
}

function loadPageData(page) {
  switch (page) {
    case 'dashboard-home': loadHomeData(); break;
    case 'moderation': loadModerationData(); break;
    case 'channel-points': loadRewards(); break;
    case 'stream-config': loadStreamConfig(); break;
    case 'chat-settings': loadChatSettings(); break;
    case 'stats': loadStats(); break;
    case 'predictions': loadPredictions(); break;
    case 'polls': loadPolls(); break;
    case 'raid': loadRaidPage(); break;
    case 'ads': loadAdsSchedule(); break;
    case 'clips': loadClips(); break;
    case 'shield': loadShieldStatus(); break;
    case 'custom-commands': loadCommands(); break;
    case 'goals': loadGoals(); break;
    case 'chat-log': loadChatLog(); break;
    case 'spam': loadSpamLog(); break;
    case 'mod-activity': loadModActivity(); break;
    case 'suspicious': loadSuspiciousUsers(); break;
    case 'chat-rules': loadChatRules(); break;
    case 'alerts-widget': loadAlerts(); break;
    case 'appeals': loadAppeals(); break;
    case 'share': loadShareLinks(); break;
    case 'settings': loadModeratorAccounts(); break;
  }
}

// ===== SIDEBAR =====
function setupSidebar() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
  document.getElementById('mobileMenuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });
}

// ===== API HELPER =====
async function api(endpoint, options = {}) {
  try {
    const resp = await fetch(endpoint, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (resp.status === 401) {
      showToast('Sesion expirada. Recarga la pagina.', 'error');
      return null;
    }
    return await resp.json();
  } catch (err) {
    console.error('API Error:', err);
    showToast('Error de conexion', 'error');
    return null;
  }
}

// ===== HOME =====
async function loadHomeData() {
  if (!currentUser) return;
  const u = currentUser._displayUser || currentUser;
  document.getElementById('followersValue').textContent = u.followers_count || '--';
  document.getElementById('viewsValue').textContent = formatNumber(u.view_count);

  await refreshStreamStatus();
}

function startStreamRefresh() {
  if (streamRefreshInterval) clearInterval(streamRefreshInterval);
  streamRefreshInterval = setInterval(async () => {
    if (currentPage === 'dashboard-home' || currentPage === 'stats') {
      await refreshStreamStatus();
    }
  }, 30000);
}

async function refreshStreamStatus() {
  const stream = await api('/api/stream');
  if (stream && stream.data && stream.data.length > 0) {
    const s = stream.data[0];
    document.getElementById('userStatus').textContent = 'EN DIRECTO';
    document.getElementById('userStatus').className = 'user-status live';
    document.getElementById('streamStatusLabel').textContent = 'EN DIRECTO';
    document.querySelector('.status-dot').className = 'status-dot live';
    document.getElementById('viewerCountNum').textContent = s.viewer_count;
    document.getElementById('currentViewersValue').textContent = s.viewer_count;

    const startTime = new Date(s.started_at);
    document.getElementById('streamTimeValue').textContent = getTimeSince(startTime);

    const homeInfo = document.getElementById('homeStreamInfo');
    homeInfo.innerHTML = `
      <div class="channel-info-grid">
        <div class="channel-info-item">
          <span class="label">Titulo</span>
          <span class="value">${escapeHtml(s.title)}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Categoria</span>
          <span class="value">${escapeHtml(s.game_name || 'Sin categoria')}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Espectadores</span>
          <span class="value">${s.viewer_count}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Idioma</span>
          <span class="value">${s.language}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Inicio</span>
          <span class="value">${new Date(s.started_at).toLocaleString('es')}</span>
        </div>
        <div class="channel-info-item">
          <span class="label">Tags</span>
          <span class="value">${s.tags ? s.tags.join(', ') : 'Ninguno'}</span>
        </div>
      </div>
    `;
  } else {
    document.getElementById('userStatus').textContent = 'Offline';
    document.getElementById('userStatus').className = 'user-status';
    document.getElementById('streamStatusLabel').textContent = 'Offline';
    document.querySelector('.status-dot').className = 'status-dot offline';
    document.getElementById('currentViewersValue').textContent = '0';
    document.getElementById('streamTimeValue').textContent = '--';
    document.getElementById('homeStreamInfo').innerHTML = '<div class="empty-state"><p>No hay directo activo</p></div>';
  }
}

// ===== MODERATION =====
let followers = [];

function setupModSearch() {
  const input = document.getElementById('modUserSearch');
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const q = input.value.toLowerCase().trim();
      filterCurrentModTab(q);
    }, 250);
  });
}

function switchModTab(tab) {
  currentModTab = tab;
  document.querySelectorAll('.mod-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.mod-tab[data-mod-tab="${tab}"]`).classList.add('active');
  document.querySelectorAll('.mod-tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(`modTab-${tab}`).classList.add('active');
  if (tab === 'automod') { loadBannedWords(); return; }
  if (tab === 'actionlog') { loadActionLog(); return; }
  refreshCurrentModTab();
}

function refreshCurrentModTab() {
  switch (currentModTab) {
    case 'followers': loadFollowers(); break;
    case 'chatters': loadChatters(); break;
    case 'banned': loadBanned(); break;
    case 'moderators': loadModerators(); break;
    case 'vips': loadVIPs(); break;
  }
}

function filterCurrentModTab(q) {
  switch (currentModTab) {
    case 'followers': filterAndRender('followers', q); break;
    case 'chatters': filterAndRender('chatters', q); break;
    case 'banned': filterAndRender('banned', q); break;
    case 'moderators': filterAndRender('moderators', q); break;
    case 'vips': filterAndRender('vips', q); break;
  }
}

function filterAndRender(tab, q) {
  const data = modData[tab];
  if (!q) {
    renderModList(tab, data, data.length);
    return;
  }
  const filtered = data.filter(item => {
    const name = (item.user_name || item.login || item.display_name || '').toLowerCase();
    const login = (item.login || item.user_login || '').toLowerCase();
    return name.includes(q) || login.includes(q);
  });
  renderModList(tab, filtered, data.length, filtered.length);
}

function renderModList(tab, list, total, filtered) {
  const containerId = {
    followers: 'followersList',
    chatters: 'chattersList',
    banned: 'bannedList',
    moderators: 'moderatorsList',
    vips: 'vipsList'
  }[tab];
  const countId = 'modFollowerCount';
  const container = document.getElementById(containerId);

  if (filtered !== undefined) {
    document.getElementById(countId).textContent = `${filtered} de ${total} resultados`;
  } else {
    const labels = { followers: 'seguidores', chatters: 'chatters', banned: 'baneados', moderators: 'moderadores', vips: 'VIPs' };
    document.getElementById(countId).textContent = `${total} ${labels[tab]}`;
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No se encontraron resultados</p></div>';
    return;
  }

  if (tab === 'followers') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--purple-700)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%237c3aed%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${f.user_name.charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name)}</div>
          <div class="user-item-meta">Siguiendo desde ${new Date(f.followed_at).toLocaleDateString('es')}</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="showBanModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Banear">Ban</button>
          <button class="btn btn-warning btn-sm" onclick="showTimeoutModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Mutear">Mute</button>
          <button class="btn btn-secondary btn-sm" onclick="showRoleModal('${f.user_id}', '${escapeAttr(f.user_name)}')" title="Rol">Rol</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'chatters') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--blue-600)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%233b82f6%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">${f.user_id === currentUser?.id ? 'Tu' : 'Chatter'}</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="showBanModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Banear">Ban</button>
          <button class="btn btn-warning btn-sm" onclick="showTimeoutModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Mutear">Mute</button>
          <button class="btn btn-secondary btn-sm" onclick="showRoleModal('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')" title="Rol">Rol</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'banned') {
    container.innerHTML = list.map(f => {
      const isTimeout = !!f.expires_at;
      const expiry = isTimeout ? new Date(f.expires_at).toLocaleString('es') : 'Permanente';
      const actionBtn = isTimeout
        ? `<button class="btn btn-warning btn-sm" onclick="unbanUser('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar Timeout</button>`
        : `<button class="btn btn-success btn-sm" onclick="unbanUser('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Desbanear</button>`;
      return `
        <div class="user-item" data-userid="${f.user_id}">
          <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--danger)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23ef4444%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
          <div class="user-item-info">
            <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
            <div class="user-item-meta">${f.moderator_name ? `${isTimeout ? 'Timeout por' : 'Baneado por'} ${f.moderator_name}` : ''} ${f.reason ? `| ${escapeHtml(f.reason)}` : ''} | Expira: ${expiry}</div>
          </div>
          <div class="user-item-actions-inline">
            ${actionBtn}
          </div>
        </div>
      `;
    }).join('');
  } else if (tab === 'moderators') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--blue-500)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%233b82f6%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">Moderador</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="removeAsMod('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar Mod</button>
        </div>
      </div>
    `).join('');
  } else if (tab === 'vips') {
    container.innerHTML = list.map(f => `
      <div class="user-item" data-userid="${f.user_id}">
        <img src="${f.user_profile_image_url || ''}" alt="" onerror="this.style.background='var(--purple-500)';this.style.borderRadius='50%';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%23a855f7%22 width=%2240%22 height=%2240%22 rx=%2220%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22 font-family=%22sans-serif%22>${(f.user_name||'').charAt(0).toUpperCase()}</text></svg>'">
        <div class="user-item-info">
          <div class="user-item-name">${escapeHtml(f.user_name || f.user_login)}</div>
          <div class="user-item-meta">VIP</div>
        </div>
        <div class="user-item-actions-inline">
          <button class="btn btn-danger btn-sm" onclick="removeAsVip('${f.user_id}', '${escapeAttr(f.user_name || f.user_login)}')">Quitar VIP</button>
        </div>
      </div>
    `).join('');
  }
}

async function loadModerationData() {
  refreshCurrentModTab();
}

async function loadChatters() {
  const loadingEl = document.getElementById('chattersLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/chatters/list').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.chatters = data.data.data;
      renderModList('chatters', modData.chatters.slice(0, 100), modData.chatters.length);
    } else {
      modData.chatters = [];
      document.getElementById('chattersList').innerHTML = '<div class="empty-state"><p>No hay chatters en el chat (o el directo no esta activo)</p></div>';
    }
  } catch (err) {
    console.error('Load chatters error:', err);
    document.getElementById('chattersList').innerHTML = '<div class="empty-state"><p>Error al cargar chatters</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadBanned() {
  const loadingEl = document.getElementById('bannedLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/bans').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.banned = data.data.data;
      renderModList('banned', modData.banned.slice(0, 100), modData.banned.length);
    } else {
      modData.banned = [];
      document.getElementById('bannedList').innerHTML = '<div class="empty-state"><p>No hay usuarios baneados</p></div>';
    }
  } catch (err) {
    console.error('Load banned error:', err);
    document.getElementById('bannedList').innerHTML = '<div class="empty-state"><p>Error al cargar baneados</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadModerators() {
  const loadingEl = document.getElementById('moderatorsLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/moderators').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.moderators = data.data.data;
      renderModList('moderators', modData.moderators.slice(0, 100), modData.moderators.length);
    } else {
      modData.moderators = [];
      document.getElementById('moderatorsList').innerHTML = '<div class="empty-state"><p>No hay moderadores asignados</p></div>';
    }
  } catch (err) {
    console.error('Load moderators error:', err);
    document.getElementById('moderatorsList').innerHTML = '<div class="empty-state"><p>Error al cargar moderadores</p></div>';
  }

  loadingEl.style.display = 'none';
}

async function loadVIPs() {
  const loadingEl = document.getElementById('vipsLoading');
  loadingEl.style.display = '';

  try {
    const data = await fetch('/api/mod/vips').then(r => r.json());
    if (data && data.data && data.data.data && data.data.data.length > 0) {
      modData.vips = data.data.data;
      renderModList('vips', modData.vips.slice(0, 100), modData.vips.length);
    } else {
      modData.vips = [];
      document.getElementById('vipsList').innerHTML = '<div class="empty-state"><p>No hay VIPs asignados</p></div>';
    }
  } catch (err) {
    console.error('Load VIPs error:', err);
    document.getElementById('vipsList').innerHTML = '<div class="empty-state"><p>Error al cargar VIPs</p></div>';
  }

  loadingEl.style.display = 'none';
}

// ===== BAN =====
function showBanModal(userId, userName) {
  showModal('Banear a ' + userName, `
    <div class="form-group">
      <label>Tipo de ban</label>
      <div class="ban-type-selector">
        <button class="ban-type-btn active" data-type="permanent" onclick="selectBanType(this, 'permanent')">Permanente</button>
        <button class="ban-type-btn" data-type="temporary" onclick="selectBanType(this, 'temporary')">Temporal</button>
      </div>
    </div>
    <div class="form-group hidden" id="banDurationGroup">
      <label>Duracion</label>
      <select id="banDuration" class="form-input">
        <option value="600">10 minutos</option>
        <option value="1800">30 minutos</option>
        <option value="3600" selected>1 hora</option>
        <option value="7200">2 horas</option>
        <option value="14400">4 horas</option>
        <option value="43200">12 horas</option>
        <option value="86400">24 horas</option>
        <option value="259200">3 dias</option>
        <option value="604800">7 dias</option>
      </select>
    </div>
    <div class="form-group">
      <label>Motivo</label>
      <input type="text" id="banReason" class="form-input" placeholder="Motivo del ban (opcional)">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Banear', class: 'btn-danger', action: `executeBan('${userId}', '${userName}')` }
  ]);
}

function selectBanType(btn, type) {
  document.querySelectorAll('.ban-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const durationGroup = document.getElementById('banDurationGroup');
  if (type === 'temporary') {
    durationGroup.classList.remove('hidden');
  } else {
    durationGroup.classList.add('hidden');
  }
}

async function executeBan(userId, userName) {
  const isTemporary = document.querySelector('.ban-type-btn.active').dataset.type === 'temporary';
  const reason = document.getElementById('banReason').value;
  const body = { user_id: userId, reason: reason || '' };
  if (isTemporary) body.duration = parseInt(document.getElementById('banDuration').value);

  const result = await api('/api/mod/ban', { method: 'POST', body });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('ban', userName, reason || (isTemporary ? `Temporal ${document.getElementById('banDuration').value}s` : 'Permanente'));
    showToast(`${userName} ha sido baneado${isTemporary ? ' temporalmente' : ''}`, 'success');
  } else {
    showToast('Error al banear usuario', 'error');
  }
}

async function unbanUser(userId, userName) {
  const result = await api(`/api/mod/unban?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('unban', userName || 'Usuario');
    showToast(`${userName || 'Usuario'} desbaneado`, 'success');
    loadBanned();
  } else {
    showToast('Error al desbanear', 'error');
  }
}

// ===== TIMEOUT =====
function showTimeoutModal(userId, userName) {
  showModal('Mutear a ' + userName, `
    <div class="form-group">
      <label>Duracion del mute</label>
      <select id="timeoutDuration" class="form-input">
        <option value="60">1 minuto</option>
        <option value="300">5 minutos</option>
        <option value="600" selected>10 minutos</option>
        <option value="1800">30 minutos</option>
        <option value="3600">1 hora</option>
        <option value="7200">2 horas</option>
        <option value="14400">4 horas</option>
        <option value="43200">12 horas</option>
        <option value="86400">24 horas</option>
      </select>
    </div>
    <div class="form-group">
      <label>Motivo</label>
      <input type="text" id="timeoutReason" class="form-input" placeholder="Motivo del mute (opcional)">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Mutear', class: 'btn-warning', action: `executeTimeout('${userId}', '${userName}')` }
  ]);
}

async function executeTimeout(userId, userName) {
  const duration = parseInt(document.getElementById('timeoutDuration').value);
  const reason = document.getElementById('timeoutReason').value;

  const result = await api('/api/mod/timeout', { method: 'POST', body: { user_id: userId, duration, reason } });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('timeout', userName, `${Math.floor(duration / 60)}m ${reason || ''}`);
    const mins = Math.floor(duration / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const timeStr = h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}` : `${m} minutos`;
    showToast(`${userName} mutado por ${timeStr}`, 'success');
  } else {
    showToast('Error al mutear usuario', 'error');
  }
}

// ===== ROLES =====
function showRoleModal(userId, userName) {
  showModal('Cambiar rol: ' + userName, `
    <div class="role-options">
      <div class="role-option" onclick="addAsMod('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(59,130,246,0.15);color:var(--blue-400)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Hacer Moderador</span>
          <span class="role-option-desc">Permisos completos de moderacion del canal</span>
        </div>
      </div>
      <div class="role-option" onclick="removeAsMod('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(107,95,138,0.15);color:var(--text-muted)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Quitar Moderador</span>
          <span class="role-option-desc">Remover permisos de moderador</span>
        </div>
      </div>
      <div class="role-option" onclick="addAsVip('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(168,85,247,0.15);color:var(--purple-400)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Hacer VIP</span>
          <span class="role-option-desc">Badge VIP en el chat</span>
        </div>
      </div>
      <div class="role-option" onclick="removeAsVip('${userId}', '${userName}')">
        <div class="role-option-icon" style="background:rgba(107,95,138,0.15);color:var(--text-muted)">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/><line x1="4" y1="4" x2="20" y2="20" stroke-width="2"/></svg>
        </div>
        <div class="role-option-info">
          <span class="role-option-title">Quitar VIP</span>
          <span class="role-option-desc">Remover badge VIP</span>
        </div>
      </div>
    </div>
  `, [{ text: 'Cerrar', class: 'btn-secondary', action: 'closeModal()' }]);
}

async function addAsMod(userId, userName) {
  const result = await api('/api/mod/moderators', { method: 'POST', body: { user_id: userId } });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('mod', userName, 'Agregado como moderador');
    showToast(`${userName} ahora es moderador`, 'success');
  } else {
    showToast('Error al asignar moderador', 'error');
  }
}

async function removeAsMod(userId, userName) {
  const result = await api(`/api/mod/moderators?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('mod', userName, 'Removido como moderador');
    showToast(`Moderador removido de ${userName}`, 'success');
  } else {
    showToast('Error al remover moderador', 'error');
  }
}

async function addAsVip(userId, userName) {
  const result = await api('/api/mod/vips', { method: 'POST', body: { user_id: userId } });
  console.log('VIP result:', result);
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('vip', userName, 'Agregado como VIP');
    showToast(`${userName} ahora es VIP`, 'success');
  } else {
    const errMsg = result?.data?.message || result?.data?.error || JSON.stringify(result);
    console.error('VIP error:', errMsg);
    showToast('Error al asignar VIP: ' + errMsg, 'error');
  }
}

async function removeAsVip(userId, userName) {
  const result = await api(`/api/mod/vips?user_id=${userId}`, { method: 'DELETE' });
  closeModal();
  if (result && (result.status === 200 || result.status === 204)) {
    logAction('vip', userName, 'Removido como VIP');
    showToast(`VIP removido de ${userName}`, 'success');
  } else {
    showToast('Error al remover VIP', 'error');
  }
}

// ===== CHANNEL POINTS =====
async function loadRewards() {
  document.getElementById('rewardsLoading').style.display = '';
  const data = await api('/api/channel-points/rewards');
  const grid = document.getElementById('rewardsGrid');

  if (data && data.data && data.data.length > 0) {
    allRewards = data.data;
    grid.innerHTML = data.data.map(r => `
      <div class="reward-card">
        <div class="reward-header">
          <div class="reward-icon" style="background:${r.backgroundColor || '#7c3aed'}">${r.image ? `<img src="${r.image.url}" style="width:100%;height:100%;object-fit:contain;border-radius:8px">` : '🎁'}</div>
          <div>
            <div class="reward-title">${escapeHtml(r.title)}</div>
            <div class="reward-cost">${formatNumber(r.cost)} puntos</div>
          </div>
        </div>
        <div class="reward-description">${escapeHtml(r.prompt || 'Sin descripcion')}</div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">
          ${r.isEnabled ? 'Activa' : 'Inactiva'} | Max redenciones/dia: ${r.maxRedemptionsPerStream || 'Ilimitado'} | Total: ${r.totalRedemptions || 0}
        </div>
        <div class="reward-actions">
          <button class="btn btn-secondary btn-sm" onclick="editReward('${r.id}')">Editar</button>
          <button class="btn btn-secondary btn-sm" onclick="duplicateReward('${r.id}')">Duplicar</button>
          <button class="btn btn-danger btn-sm" onclick="deleteReward('${r.id}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = '<div class="empty-state"><p>No hay recompensas creadas. Crea la primera!</p></div>';
  }
  document.getElementById('rewardsLoading').style.display = 'none';
}

function showRewardModal(reward = null) {
  const isEdit = !!reward;
  showModal(isEdit ? 'Editar Recompensa' : 'Nueva Recompensa', `
    <div class="form-group">
      <label>Titulo</label>
      <input type="text" id="rewardTitle" class="form-input" value="${isEdit ? escapeHtml(reward.title) : ''}" placeholder="Nombre de la recompensa">
    </div>
    <div class="form-group">
      <label>Costo (puntos)</label>
      <input type="number" id="rewardCost" class="form-input" value="${isEdit ? reward.cost : 100}" min="0">
    </div>
    <div class="form-group">
      <label>Descripcion / Prompt</label>
      <textarea id="rewardPrompt" class="form-input" rows="2" placeholder="Que deben hacer los viewers?">${isEdit ? escapeHtml(reward.prompt || '') : ''}</textarea>
    </div>
    <div class="form-group">
      <label>Color de fondo</label>
      <div class="color-options">
        ${['#7c3aed','#db2777','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'].map(c => `
          <button type="button" class="color-btn ${isEdit && reward.backgroundColor === c ? 'active' : ''}" style="background:${c}" onclick="selectRewardColor(this, '${c}')"></button>
        `).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Maximo por directo</label>
      <input type="number" id="rewardMaxPerStream" class="form-input" value="${isEdit && reward.maxRedemptionsPerStream ? reward.maxRedemptionsPerStream : ''}" placeholder="Ilimitado" min="0">
    </div>
    <div class="form-group">
      <label>Maximo por usuario</label>
      <input type="number" id="rewardMaxPerUser" class="form-input" value="${isEdit && reward.maxRedemptionsPerUser ? reward.maxRedemptionsPerUser : ''}" placeholder="Ilimitado" min="0">
    </div>
    <div class="form-group">
      <label style="display:flex;align-items:center;gap:8px">
        <input type="checkbox" id="rewardEnabled" ${isEdit ? (reward.isEnabled ? 'checked' : '') : 'checked'}>
        Activa
      </label>
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: isEdit ? 'Guardar' : 'Crear', class: 'btn-primary', action: isEdit ? `updateReward('${reward.id}')` : 'createReward()' }
  ]);

  selectedRewardColor = isEdit ? (reward.backgroundColor || '#7c3aed') : '#7c3aed';
}

function selectRewardColor(btn, color) {
  document.querySelectorAll('.color-options .color-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedRewardColor = color;
}

async function createReward() {
  const body = {
    title: document.getElementById('rewardTitle').value,
    cost: parseInt(document.getElementById('rewardCost').value) || 100,
    prompt: document.getElementById('rewardPrompt').value,
    backgroundColor: selectedRewardColor,
    isEnabled: document.getElementById('rewardEnabled').checked
  };
  const maxPerStream = document.getElementById('rewardMaxPerStream').value;
  const maxPerUser = document.getElementById('rewardMaxPerUser').value;
  if (maxPerStream) body.maxRedemptionsPerStream = parseInt(maxPerStream);
  if (maxPerUser) body.maxRedemptionsPerUser = parseInt(maxPerUser);

  const result = await api('/api/channel-points/rewards', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Recompensa creada!', 'success');
    loadRewards();
  } else {
    showToast('Error al crear recompensa', 'error');
  }
}

function editReward(id) {
  const reward = allRewards.find(r => r.id === id);
  if (reward) showRewardModal(reward);
}

async function updateReward(id) {
  const body = {
    title: document.getElementById('rewardTitle').value,
    cost: parseInt(document.getElementById('rewardCost').value) || 100,
    prompt: document.getElementById('rewardPrompt').value,
    backgroundColor: selectedRewardColor,
    isEnabled: document.getElementById('rewardEnabled').checked
  };
  const maxPerStream = document.getElementById('rewardMaxPerStream').value;
  const maxPerUser = document.getElementById('rewardMaxPerUser').value;
  if (maxPerStream) body.maxRedemptionsPerStream = parseInt(maxPerStream);
  else body.maxRedemptionsPerStream = null;
  if (maxPerUser) body.maxRedemptionsPerUser = parseInt(maxPerUser);
  else body.maxRedemptionsPerUser = null;

  const result = await api(`/api/channel-points/rewards/${id}`, { method: 'PATCH', body });
  closeModal();
  if (result && result.data) {
    showToast('Recompensa actualizada!', 'success');
    loadRewards();
  } else {
    showToast('Error al actualizar', 'error');
  }
}

async function duplicateReward(id) {
  const reward = allRewards.find(r => r.id === id);
  if (!reward) return;

  const body = {
    title: reward.title + ' (copia)',
    cost: reward.cost,
    prompt: reward.prompt,
    backgroundColor: reward.backgroundColor,
    isEnabled: reward.isEnabled
  };
  if (reward.maxRedemptionsPerStream) body.maxRedemptionsPerStream = reward.maxRedemptionsPerStream;
  if (reward.maxRedemptionsPerUser) body.maxRedemptionsPerUser = reward.maxRedemptionsPerUser;

  const result = await api('/api/channel-points/rewards', { method: 'POST', body });
  if (result && result.data) {
    showToast('Recompensa duplicada!', 'success');
    loadRewards();
  } else {
    showToast('Error al duplicar', 'error');
  }
}

async function deleteReward(id) {
  if (!confirm('Eliminar esta recompensa?')) return;
  const result = await api(`/api/channel-points/rewards/${id}`, { method: 'DELETE' });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Recompensa eliminada', 'success');
    loadRewards();
  } else {
    showToast('Error al eliminar', 'error');
  }
}

// ===== STREAM CONFIG =====
let selectedGameId = null;

async function loadStreamConfig() {
  const channelData = await api('/api/channel');
  if (channelData && channelData.data && channelData.data[0]) {
    const ch = channelData.data[0];
    document.getElementById('streamTitle').value = ch.title || '';
    document.getElementById('currentGameName').textContent = ch.game_name || 'Sin categoria';
    selectedGameId = ch.game_id;

    const langSelect = document.getElementById('streamLanguage');
    for (let opt of langSelect.options) {
      if (opt.value === ch.language) { opt.selected = true; break; }
    }
  }

  const tagsData = await api('/api/tags');
  const tagsContainer = document.getElementById('streamTags');
  if (tagsData && tagsData.data && tagsData.data.length > 0) {
    tagsContainer.innerHTML = tagsData.data.map(t => 
      `<span class="tag">${escapeHtml(t.localization_names && t.localization_names['es-mx'] ? t.localization_names['es-mx'] : t.tag_id)}</span>`
    ).join('');
  } else {
    tagsContainer.innerHTML = '<span class="help-text">No hay etiquetas configuradas</span>';
  }
}

function setupCategorySearch() {
  const input = document.getElementById('gameSearch');
  const dropdown = document.getElementById('categoryDropdown');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(async () => {
      const name = input.value.trim();
      if (name.length < 2) { dropdown.classList.add('hidden'); return; }
      
      const data = await api(`/api/categories/search?name=${encodeURIComponent(name)}`);
      if (data && data.data && data.data.length > 0) {
        dropdown.innerHTML = data.data.slice(0, 8).map(c => `
          <div class="category-option" onclick="selectCategory('${c.id}', '${escapeHtml(c.name)}')">
            <img src="${c.box_art_url.replace('{width}', '30').replace('{height}', '30')}" alt="">
            <span>${escapeHtml(c.name)}</span>
          </div>
        `).join('');
        dropdown.classList.remove('hidden');
      } else {
        dropdown.classList.add('hidden');
      }
    }, 400);
  });

  input.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });
}

function selectCategory(id, name) {
  selectedGameId = id;
  document.getElementById('gameSearch').value = '';
  document.getElementById('currentGameName').textContent = name;
  document.getElementById('categoryDropdown').classList.add('hidden');
  showToast(`Categoria: ${name}`, 'info');
}

async function updateStreamInfo() {
  const body = {
    title: document.getElementById('streamTitle').value,
    language: document.getElementById('streamLanguage').value
  };
  if (selectedGameId) body.game_id = selectedGameId;

  const result = await api('/api/stream/info', { method: 'PATCH', body });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Directo actualizado!', 'success');
  } else {
    showToast('Error al actualizar', 'error');
  }
}

// ===== CHAT SETTINGS =====
async function loadChatSettings() {
  const data = await api('/api/chat/settings');
  const container = document.getElementById('chatSettings');

  if (data && data.data) {
    const s = data.data;
    const settings = [
      { key: 'emote_mode', label: 'Modo Emotes', desc: 'Solo se permiten emotes en el chat' },
      { key: 'subscriber_mode', label: 'Modo Suscriptores', desc: 'Solo suscriptores pueden chatear' },
      { key: 'follower_mode', label: 'Modo Seguidores', desc: 'Solo seguidores pueden chatear' },
      { key: 'slow_mode', label: 'Modo Lento', desc: 'Limita la velocidad de mensajes' },
      { key: 'unique_chat_mode', label: 'Mensajes Unicos', desc: 'No se pueden repetir mensajes' }
    ];

    container.innerHTML = settings.map(st => `
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">${st.label}</span>
          <span class="setting-desc">${st.desc}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${s[st.key] ? 'checked' : ''} onchange="toggleChatSetting('${st.key}', this.checked)">
          <span class="toggle-slider"></span>
        </label>
      </div>
    `).join('') + `
      <div class="setting-item">
        <div class="setting-info">
          <span class="setting-label">Emotes no moderados</span>
          <span class="setting-desc">${s.non_moderator_chat_delay ? `Retraso: ${s.non_moderator_chat_delay} segundos` : 'Sin retraso'}</span>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los ajustes</p></div>';
  }
}

async function toggleChatSetting(key, value) {
  const body = {};
  body[key] = value;
  const result = await api('/api/chat/settings', { method: 'PATCH', body });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Configuracion actualizada', 'success');
  } else {
    showToast('Error al actualizar', 'error');
    loadChatSettings();
  }
}

// ===== ANNOUNCEMENTS =====
function setupColorBtns() {
  document.querySelectorAll('.color-btn[data-color]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn[data-color]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedRewardColor = btn.dataset.color;
    });
  });
}

async function sendAnnouncement() {
  const message = document.getElementById('announcementMessage').value.trim();
  if (!message) return showToast('Escribe un mensaje', 'warning');

  const activeColor = document.querySelector('.color-btn[data-color].active');
  const color = activeColor ? activeColor.dataset.color : 'primary';

  const result = await api('/api/mod/announce', { method: 'POST', body: { message, color } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Anuncio enviado!', 'success');
    document.getElementById('announcementMessage').value = '';
  } else {
    showToast('Error al enviar anuncio', 'error');
  }
}

// ===== CHAT MESSAGE =====
function setupChatInput() {
  const input = document.getElementById('chatMessageInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = input.value.length;
  });
}

function insertQuickMessage(msg) {
  const input = document.getElementById('chatMessageInput');
  if (input) {
    input.value = msg;
    input.focus();
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = msg.length;
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chatMessageInput');
  const message = input.value.trim();
  if (!message) return showToast('Escribe un mensaje', 'warning');

  const result = await api('/api/chat/send', { method: 'POST', body: { message } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Mensaje enviado!', 'success');
    input.value = '';
    const count = document.getElementById('chatCharCount');
    if (count) count.textContent = '0';
  } else {
    const errMsg = result?.data?.message || result?.data?.error || 'Error al enviar mensaje';
    showToast(errMsg, 'error');
  }
}

// ===== STATS =====
async function loadStats() {
  if (!currentUser) return;

  const u = currentUser._displayUser || currentUser;
  document.getElementById('statBigFollowers').textContent = formatNumber(u.followers_count || 0);
  document.getElementById('statBigViews').textContent = formatNumber(u.view_count);
  document.getElementById('statBigBroadcaster').textContent = u.broadcaster_type === 'partner' ? 'Partner' : u.broadcaster_type === 'affiliate' ? 'Afiliado' : 'Estandar';

  const channelData = await api('/api/channel');
  const channelInfo = document.getElementById('channelInfoDetail');
  if (channelData && channelData.data && channelData.data[0]) {
    const ch = channelData.data[0];
    channelInfo.innerHTML = `
      <div class="channel-info-grid">
        <div class="channel-info-item"><span class="label">Nombre</span><span class="value">${escapeHtml(ch.display_name)}</span></div>
        <div class="channel-info-item"><span class="label">Titulo</span><span class="value">${escapeHtml(ch.title || '--')}</span></div>
        <div class="channel-info-item"><span class="label">Categoria</span><span class="value">${escapeHtml(ch.game_name || '--')}</span></div>
        <div class="channel-info-item"><span class="label">Idioma</span><span class="value">${ch.language || '--'}</span></div>
        <div class="channel-info-item"><span class="label">Seguidores</span><span class="value">${formatNumber(ch.follower_count || u.followers_count || 0)}</span></div>
        <div class="channel-info-item"><span class="label">Tipo</span><span class="value">${ch.broadcaster_type || 'Estándar'}</span></div>
        <div class="channel-info-item"><span class="label">Creado</span><span class="value">${new Date(u.created_at).toLocaleDateString('es')}</span></div>
        <div class="channel-info-item"><span class="label">Descripcion</span><span class="value">${escapeHtml(ch.description || 'Sin descripcion')}</span></div>
      </div>
    `;
  }

  loadViewerChart();
  loadHoursChart();
  loadFollowerChart();
  loadGlobalEmotes();
}

async function loadViewerChart() {
  const data = await api('/api/stats/viewer-history');
  if (data && data.data && data.data.length > 0) {
    const samples = data.data;
    const labels = samples.map(s => {
      const d = new Date(s.t);
      return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    });
    const values = samples.map(s => s.viewers);
    document.getElementById('viewerChartBadge').textContent = samples.length + ' muestras';
    drawLineChart('viewerChart', labels, values, '#a855f7', 'viewerChartEmpty');
  } else {
    document.getElementById('viewerChartEmpty').style.display = '';
    const c = document.getElementById('viewerChart');
    if (c) c.style.display = 'none';
  }
}

async function loadHoursChart() {
  const data = await api('/api/stats/stream-analysis');
  if (data && data.data) {
    const d = data.data;
    document.getElementById('hoursChartBadge').textContent = d.bestHour + ' / ' + d.bestDay;
    drawBarChart('hoursChart', d.hours, d.dayCounts, '#3b82f6', 'hoursChartEmpty');
  }
}

async function loadFollowerChart() {
  const data = await api('/api/stats/follower-history');
  if (data && data.data && data.data.length > 0) {
    const samples = data.data;
    const labels = samples.map(s => new Date(s.t).toLocaleDateString('es'));
    const values = samples.map(s => s.count);
    document.getElementById('followerChartBadge').textContent = samples.length + ' muestras';
    drawLineChart('followerChart', labels, values, '#10b981', 'followerChartEmpty');
  } else {
    document.getElementById('followerChartEmpty').style.display = '';
    const c = document.getElementById('followerChart');
    if (c) c.style.display = 'none';
  }
}

// ===== PREDICTIONS =====
async function loadPredictions() {
  const data = await api('/api/predictions');
  const container = document.getElementById('predictionsList');

  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(p => {
      const statusClass = p.status === 'ACTIVE' ? 'active' : p.status === 'RESOLVED' ? 'resolved' : 'canceled';
      const totalPoints = p.outcomes.reduce((sum, o) => sum + o.channel_points, 0);
      return `
        <div class="prediction-item">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h4>${escapeHtml(p.title)}</h4>
            <span class="prediction-status ${statusClass}">${p.status}</span>
          </div>
          <div class="prediction-outcomes">
            ${p.outcomes.map(o => {
              const pct = totalPoints > 0 ? Math.round((o.channel_points / totalPoints) * 100) : 0;
              return `
                <div class="prediction-outcome">
                  <div class="outcome-name">
                    <span class="outcome-color" style="background:${o.color}"></span>
                    ${escapeHtml(o.title)}
                  </div>
                  <div style="font-size:0.8rem;color:var(--text-muted)">${formatNumber(o.channel_points)} puntos (${pct}%)</div>
                  <div class="outcome-bar"><div class="outcome-fill" style="width:${pct}%;background:${o.color}"></div></div>
                  ${o.winner ? '<div style="margin-top:6px;font-size:0.75rem;color:var(--success)">Ganador</div>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${p.status === 'ACTIVE' ? `
            <div style="margin-top:12px;display:flex;gap:6px">
              <button class="btn btn-success btn-sm" onclick="resolvePrediction('${p.id}', '${p.outcomes[0].id}')">${escapeHtml(p.outcomes[0].title)}</button>
              ${p.outcomes[1] ? `<button class="btn btn-success btn-sm" onclick="resolvePrediction('${p.id}', '${p.outcomes[1].id}')">${escapeHtml(p.outcomes[1].title)}</button>` : ''}
              <button class="btn btn-danger btn-sm" onclick="cancelPrediction('${p.id}')">Cancelar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay predicciones</p></div>';
  }
}

function showPredictionModal() {
  showModal('Nueva Prediccion', `
    <div class="form-group">
      <label>Pregunta</label>
      <input type="text" id="predictionTitle" class="form-input" placeholder="Ej: Ganare esta partida?">
    </div>
    <div class="form-group">
      <label>Opcion 1</label>
      <input type="text" id="predictionOpt1" class="form-input" value="Si" placeholder="Opcion 1">
    </div>
    <div class="form-group">
      <label>Opcion 2</label>
      <input type="text" id="predictionOpt2" class="form-input" value="No" placeholder="Opcion 2">
    </div>
    <div class="form-group">
      <label>Duracion (minutos)</label>
      <input type="number" id="predictionDuration" class="form-input" value="2" min="1" max="180">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'createPrediction()' }
  ]);
}

async function createPrediction() {
  const body = {
    title: document.getElementById('predictionTitle').value,
    outcomes: [
      { title: document.getElementById('predictionOpt1').value || 'Si', color: 'BLUE' },
      { title: document.getElementById('predictionOpt2').value || 'No', color: 'PINK' }
    ],
    prediction_window: parseInt(document.getElementById('predictionDuration').value) * 60
  };
  const result = await api('/api/predictions', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Prediccion creada!', 'success');
    loadPredictions();
  } else {
    showToast('Error al crear prediccion', 'error');
  }
}

async function resolvePrediction(predictionId, outcomeId) {
  await api('/api/predictions/' + predictionId, { method: 'PATCH', body: { id: predictionId, status: 'RESOLVED', winning_outcome_id: outcomeId } });
  showToast('Prediccion resuelta', 'success');
  loadPredictions();
}

async function cancelPrediction(predictionId) {
  if (!confirm('Cancelar esta prediccion?')) return;
  await api('/api/predictions/' + predictionId, { method: 'PATCH', body: { id: predictionId, status: 'CANCELED' } });
  showToast('Prediccion cancelada', 'success');
  loadPredictions();
}

// ===== POLLS =====
async function loadPolls() {
  const data = await api('/api/polls');
  const container = document.getElementById('pollsList');

  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(p => {
      const totalVotes = p.choices.reduce((sum, c) => sum + c.votes, 0);
      const statusClass = p.status === 'ACTIVE' ? 'active' : p.status === 'ENDED' ? 'ended' : 'canceled';
      return `
        <div class="poll-item">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
            <h4>${escapeHtml(p.title)}</h4>
            <span class="poll-status ${statusClass}">${p.status}</span>
          </div>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:12px">Votos totales: ${totalVotes} ${p.duration ? `| Duracion: ${p.duration/60} min` : ''}</div>
          <div class="poll-options">
            ${p.choices.map(c => {
              const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0;
              return `
                <div class="poll-option">
                  <span class="poll-option-text">${escapeHtml(c.title)}</span>
                  <div class="poll-option-bar"><div class="poll-option-fill" style="width:${pct}%"></div></div>
                  <span class="poll-option-pct">${pct}%</span>
                </div>
              `;
            }).join('')}
          </div>
          ${p.status === 'ACTIVE' ? `
            <div style="margin-top:12px">
              <button class="btn btn-danger btn-sm" onclick="endPoll('${p.id}')">Finalizar</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay encuestas</p></div>';
  }
}

function showPollModal() {
  showModal('Nueva Encuesta', `
    <div class="form-group">
      <label>Pregunta</label>
      <input type="text" id="pollTitle" class="form-input" placeholder="Ej: Que juego juego hoy?">
    </div>
    <div class="form-group">
      <label>Opciones (una por linea)</label>
      <textarea id="pollChoices" class="form-input" rows="4" placeholder="Opcion 1&#10;Opcion 2&#10;Opcion 3">Opcion 1\nOpcion 2</textarea>
    </div>
    <div class="form-group">
      <label>Duracion (minutos)</label>
      <input type="number" id="pollDuration" class="form-input" value="5" min="1" max="1800">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'createPoll()' }
  ]);
}

async function createPoll() {
  const choicesText = document.getElementById('pollChoices').value.split('\n').filter(c => c.trim());
  if (choicesText.length < 2) return showToast('Necesitas al menos 2 opciones', 'warning');
  if (choicesText.length > 5) return showToast('Maximo 5 opciones', 'warning');

  const body = {
    title: document.getElementById('pollTitle').value,
    choices: choicesText.map(title => ({ title: title.trim() })),
    duration: parseInt(document.getElementById('pollDuration').value) * 60
  };
  const result = await api('/api/polls', { method: 'POST', body });
  closeModal();
  if (result && result.data) {
    showToast('Encuesta creada!', 'success');
    loadPolls();
  } else {
    showToast('Error al crear encuesta', 'error');
  }
}

async function endPoll(pollId) {
  await api('/api/polls/' + pollId, { method: 'PATCH', body: { id: pollId, status: 'TERMINATED' } });
  showToast('Encuesta finalizada', 'success');
  loadPolls();
}

// ===== MODAL =====
function showModal(title, body, buttons = []) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = body;
  document.getElementById('modalFooter').innerHTML = buttons.map(b => 
    `<button class="btn ${b.class}" onclick="${b.action}">${b.text}</button>`
  ).join('');
  document.getElementById('modalOverlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

document.addEventListener('click', (e) => {
  if (e.target.id === 'modalOverlay') closeModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ===== TOAST =====
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = {
    success: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };
  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ===== CANVAS CHARTS =====
function drawLineChart(canvasId, labels, values, color, emptyId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth;
  const h = canvas.height = 200;
  ctx.clearRect(0, 0, w, h);

  if (!values || values.length < 2) {
    canvas.style.display = 'none';
    if (emptyId) document.getElementById(emptyId).style.display = '';
    return;
  }

  canvas.style.display = '';
  if (emptyId) document.getElementById(emptyId).style.display = 'none';

  const pad = { t: 20, r: 20, b: 30, l: 45 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const maxV = Math.max(...values, 1);
  const minV = 0;
  const range = maxV - minV || 1;

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(minV + (i / 4) * range), pad.l - 8, y + 4);
  }

  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t + ch - ((values[0] - minV) / range) * ch);
  for (let i = 1; i < values.length; i++) {
    const x = pad.l + (i / (values.length - 1)) * cw;
    const y = pad.t + ch - ((values[i] - minV) / range) * ch;
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color || '#a855f7';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const grad = ctx.createLinearGradient(0, pad.t, 0, h - pad.b);
  grad.addColorStop(0, (color || '#a855f7') + '40');
  grad.addColorStop(1, (color || '#a855f7') + '05');
  ctx.lineTo(pad.l + cw, pad.t + ch);
  ctx.lineTo(pad.l, pad.t + ch);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  if (labels && values.length <= 24) {
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    const step = Math.max(1, Math.floor(values.length / 8));
    for (let i = 0; i < values.length; i += step) {
      const x = pad.l + (i / (values.length - 1)) * cw;
      ctx.fillText(labels[i] || '', x, h - 8);
    }
  }
}

function drawBarChart(canvasId, labels, values, color, emptyId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.parentElement.clientWidth;
  const h = canvas.height = 200;
  ctx.clearRect(0, 0, w, h);

  if (!values || values.every(v => v === 0)) {
    canvas.style.display = 'none';
    if (emptyId) document.getElementById(emptyId).style.display = '';
    return;
  }

  canvas.style.display = '';
  if (emptyId) document.getElementById(emptyId).style.display = 'none';

  const pad = { t: 20, r: 20, b: 35, l: 35 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const maxV = Math.max(...values, 1);
  const barW = cw / labels.length * 0.7;
  const gap = cw / labels.length;

  ctx.strokeStyle = 'rgba(168, 85, 247, 0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + ch - (i / 4) * ch;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(w - pad.r, y);
    ctx.stroke();
    ctx.fillStyle = '#6b5f8a';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((i / 4) * maxV), pad.l - 8, y + 4);
  }

  for (let i = 0; i < values.length; i++) {
    const x = pad.l + i * gap + (gap - barW) / 2;
    const barH = (values[i] / maxV) * ch;
    const y = pad.t + ch - barH;

    const grad = ctx.createLinearGradient(0, y, 0, pad.t + ch);
    grad.addColorStop(0, color || '#a855f7');
    grad.addColorStop(1, (color || '#a855f7') + '60');
    ctx.fillStyle = grad;

    ctx.beginPath();
    const r = Math.min(4, barW / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, pad.t + ch);
    ctx.lineTo(x, pad.t + ch);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.fill();

    if (labels[i]) {
      ctx.fillStyle = '#6b5f8a';
      ctx.font = '10px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, h - 10);
    }
  }
}

// ===== VIEWER TRACKING =====
let viewerTrackInterval = null;

function startViewerTracking() {
  if (viewerTrackInterval) clearInterval(viewerTrackInterval);
  viewerTrackInterval = setInterval(async () => {
    const dot = document.querySelector('.status-dot');
    if (dot && dot.classList.contains('live')) {
      await api('/api/stats/viewer-sample', { method: 'POST' });
    }
  }, 60000);
}

async function stopViewerTracking() {
  if (viewerTrackInterval) clearInterval(viewerTrackInterval);
  viewerTrackInterval = null;
}

// ===== FOLLOWER TRACKING =====
let followerTrackInterval = null;

function startFollowerTracking() {
  if (followerTrackInterval) clearInterval(followerTrackInterval);
  followerTrackInterval = setInterval(async () => {
    await api('/api/stats/follower-snapshot', { method: 'POST' });
  }, 300000);
}

// ===== AUTO-MOD =====
async function loadBannedWords() {
  const data = await api('/api/mod/automod/words');
  const container = document.getElementById('automodWordsList');
  if (data && data.words && data.words.length > 0) {
    container.innerHTML = data.words.map(w => `
      <div class="automod-word-tag">
        <span>${escapeHtml(w)}</span>
        <button class="automod-word-remove" onclick="removeBannedWord('${escapeAttr(w)}')">&times;</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state" style="padding:16px"><p>No hay palabras bloqueadas. Agrega una arriba.</p></div>';
  }
}

async function addBannedWord() {
  const input = document.getElementById('automodWordInput');
  const word = input.value.trim();
  if (!word) return;
  await api('/api/mod/automod/words', { method: 'POST', body: { words: [word] } });
  input.value = '';
  loadBannedWords();
  showToast(`"${word}" agregado a palabras bloqueadas`, 'success');
}

async function removeBannedWord(word) {
  await api('/api/mod/automod/words', { method: 'DELETE', body: { word } });
  loadBannedWords();
  showToast(`"${word}" removido`, 'info');
}

async function testAutoMod() {
  const input = document.getElementById('automodTestInput');
  const message = input.value.trim();
  if (!message) return;
  const result = await api('/api/mod/automod/check', { method: 'POST', body: { message } });
  const container = document.getElementById('automodTestResult');
  if (result && result.blocked) {
    container.innerHTML = `<div class="automod-result blocked">BLOQUEADO - Contiene la palabra: "${escapeHtml(result.word)}"</div>`;
  } else {
    container.innerHTML = `<div class="automod-result allowed">PERMITIDO - No contiene palabras bloqueadas</div>`;
  }
}

// ===== ACTION LOG =====
async function logAction(action, target, details) {
  await api('/api/mod/action-log', { method: 'POST', body: { action, target, details } });
}

async function loadActionLog() {
  const data = await api('/api/mod/action-log');
  const container = document.getElementById('actionLogList');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(entry => {
      const icons = {
        ban: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
        unban: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="16 8 10 14 8 12"/></svg>',
        timeout: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
        announce: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#3b82f6" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
        mod: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#a855f7" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
        vip: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#c084fc" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
        chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#60a5fa" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
      };
      const icon = icons[entry.action] || icons.chat;
      const time = new Date(entry.t).toLocaleString('es');
      return `
        <div class="action-log-entry">
          <div class="action-log-icon">${icon}</div>
          <div class="action-log-info">
            <span class="action-log-action">${escapeHtml(entry.action)}</span>
            <span class="action-log-target">${escapeHtml(entry.target)}</span>
            ${entry.details ? `<span class="action-log-details">${escapeHtml(entry.details)}</span>` : ''}
          </div>
          <div class="action-log-meta">
            <span class="action-log-moderator">${escapeHtml(entry.moderator)}</span>
            <span class="action-log-time">${time}</span>
          </div>
        </div>
      `;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay acciones registradas todavia</p></div>';
  }
}

// ===== EMOTES =====
async function loadGlobalEmotes() {
  const data = await api('/api/emotes/global');
  const container = document.getElementById('globalEmotes');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.slice(0, 80).map(e => {
      const url = e.images && e.images.url_1x ? e.images.url_1x : '';
      if (url) {
        return `<div class="emote-item" title="${escapeHtml(e.name)}"><img src="${url}" alt="${escapeHtml(e.name)}" loading="lazy"></div>`;
      }
      return `<div class="emote-item emote-text" title="${escapeHtml(e.name)}">${escapeHtml(e.name)}</div>`;
    }).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se pudieron cargar los emotes</p></div>';
  }
}

// ===== THUMBNAIL =====
async function updateThumbnail() {
  const url = document.getElementById('thumbnailUrl').value.trim();
  if (!url) return showToast('Ingresa una URL de imagen', 'warning');
  if (!url.startsWith('https://')) return showToast('La URL debe ser HTTPS', 'warning');

  const result = await api('/api/stream/thumbnail', { method: 'PUT', body: { image_url: url } });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Miniatura actualizada!', 'success');
    logAction('thumbnail', (currentUser._displayUser || currentUser).display_name, 'Miniatura actualizada');
  } else {
    const errMsg = result?.data?.message || 'Error al actualizar miniatura';
    showToast(errMsg, 'error');
  }
}

// ===== UTILITIES =====
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatNumber(n) {
  if (n === undefined || n === null) return '--';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function getTimeSince(date) {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ===== RAIDS =====
async function loadRaidPage() {
  const data = await api('/api/raids/current');
  const btn = document.getElementById('cancelRaidBtn');
  if (data && data.data && data.data.length > 0) {
    btn.style.display = '';
    btn.textContent = 'Cancelar Raid Activo';
  } else {
    btn.style.display = 'none';
  }
}

async function searchRaidChannels() {
  const q = document.getElementById('raidSearchInput').value.trim();
  if (!q) return;
  const container = document.getElementById('raidSearchResults');
  container.innerHTML = '<div class="loading">Buscando...</div>';
  const result = await api(`/api/raids/search?query=${encodeURIComponent(q)}`);
  const channels = result?.data?.data || result?.data || [];
  if (channels.length > 0) {
    container.innerHTML = channels.map(ch => `
      <div class="raid-result-item">
        <img src="${ch.thumbnail_url || ''}" alt="" class="raid-result-thumb" onerror="this.style.background='var(--purple-500)';this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><rect fill=%22%239333ea%22 width=%2240%22 height=%2240%22/><text x=%2220%22 y=%2226%22 fill=%22white%22 text-anchor=%22middle%22 font-size=%2216%22>${(ch.display_name||'').charAt(0)}</text></svg>'">
        <div class="raid-result-info">
          <div class="raid-result-name">${escapeHtml(ch.display_name)}</div>
          <div class="raid-result-meta">${ch.game_name || 'Sin categoria'} | ${ch.is_live ? 'EN VIVO' : 'Offline'}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="startRaid('${ch.id}', '${escapeAttr(ch.display_name)}')" ${!ch.is_live ? 'disabled title="Canal no esta en vivo"' : ''}>Raid</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se encontraron canales</p></div>';
  }
}

async function startRaid(userId, userName) {
  const result = await api('/api/raids/start', { method: 'POST', body: { to_broadcaster_id: userId } });
  if (result && (result.status === 200 || result.data)) {
    showToast(`Raid a ${userName} iniciada!`, 'success');
    loadRaidPage();
  } else {
    showToast('Error al iniciar raid', 'error');
  }
}

async function cancelRaid() {
  const result = await api('/api/raids/cancel', { method: 'DELETE' });
  if (result && (result.status === 200 || result.status === 204)) {
    showToast('Raid cancelada', 'success');
    loadRaidPage();
  } else {
    showToast('Error al cancelar raid', 'error');
  }
}

// ===== ADS =====
async function loadAdsSchedule() {
  const data = await api('/api/ads/schedule');
  if (data && data.data && data.data[0]) {
    const ad = data.data[0];
    document.getElementById('adsNextAd').textContent = ad.next_ad_at ? new Date(ad.next_ad_at).toLocaleString('es') : 'Ninguno programado';
    document.getElementById('adsDuration').textContent = ad.duration ? ad.duration + 's' : '--';
    document.getElementById('adsPreroll').textContent = ad.preroll_free_time ? Math.floor(ad.preroll_free_time / 60) + ' min restantes' : '0 min';
    document.getElementById('adsSnooze').textContent = ad.snooze_count || '0';
    document.getElementById('snoozeAdBtn').disabled = ad.snooze_count <= 0 || !ad.next_ad_at;
  }
}

async function snoozeAd() {
  const result = await api('/api/ads/snooze', { method: 'POST' });
  if (result && (result.status === 200 || result.data)) {
    showToast('Anuncio pospuesto 5 minutos', 'success');
    loadAdsSchedule();
  } else {
    showToast('Error al posponer anuncio', 'error');
  }
}

async function startCommercial(length) {
  const result = await api('/api/ads/start', { method: 'POST', body: { length } });
  if (result && (result.status === 200 || result.data)) {
    const msg = result.data?.data?.[0]?.message || 'Comercial iniciado';
    showToast(`${msg} (${length}s)`, 'success');
    loadAdsSchedule();
  } else {
    showToast('Error al iniciar comercial', 'error');
  }
}

// ===== CLIPS =====
async function loadClips() {
  const grid = document.getElementById('clipsGrid');
  grid.innerHTML = '<div class="loading">Cargando clips...</div>';
  const data = await api('/api/clips');
  if (data && data.data && data.data.length > 0) {
    grid.innerHTML = data.data.map(clip => `
      <div class="clip-card">
        <img src="${clip.thumbnail_url}" alt="${escapeAttr(clip.title)}" class="clip-thumb" onerror="this.style.background='var(--bg-tertiary)'">
        <div class="clip-info">
          <div class="clip-title">${escapeHtml(clip.title)}</div>
          <div class="clip-meta">${clip.view_count} vistas | ${new Date(clip.created_at).toLocaleDateString('es')}</div>
          <div class="clip-actions">
            <a href="${clip.url}" target="_blank" class="btn btn-secondary btn-sm">Ver</a>
            <button class="btn btn-sm btn-secondary" onclick="copyClipLink('${clip.url}')">Copiar</button>
          </div>
        </div>
      </div>
    `).join('');
  } else {
    grid.innerHTML = '<div class="empty-state"><p>No hay clips recientes</p></div>';
  }
}

function copyClipLink(url) {
  navigator.clipboard.writeText(url);
  showToast('Link copiado!', 'success');
}

async function createClip() {
  const result = await api('/api/clips/create', { method: 'POST' });
  if (result && result.data && result.data[0]) {
    showToast('Clip creado!', 'success');
    window.open(result.data[0].edit_url, '_blank');
    loadClips();
  } else {
    showToast('Error al crear clip (necesitas estar en vivo)', 'error');
  }
}

// ===== SHIELD MODE =====
async function loadShieldStatus() {
  const data = await api('/api/shield-mode');
  const activateBtn = document.getElementById('shieldActivateBtn');
  const deactivateBtn = document.getElementById('shieldDeactivateBtn');
  const statusText = document.getElementById('shieldStatusText');
  const icon = document.getElementById('shieldIcon');
  const lastAct = document.getElementById('shieldLastActivated');

  const isActive = data?.data?.data?.[0]?.is_active || data?.data?.[0]?.is_active || false;

  if (isActive) {
    statusText.textContent = 'Modo Escudo Activo';
    icon.classList.add('active');
    activateBtn.style.display = 'none';
    deactivateBtn.style.display = '';
  } else {
    statusText.textContent = 'Modo Escudo Desactivado';
    icon.classList.remove('active');
    activateBtn.style.display = '';
    deactivateBtn.style.display = 'none';
  }

  const lastActivated = data?.data?.data?.[0]?.last_activated_at || data?.data?.[0]?.last_activated_at;
  if (lastActivated) {
    lastAct.textContent = 'Ultima activacion: ' + new Date(lastActivated).toLocaleString('es');
  }
}

async function activateShield() {
  const result = await api('/api/shield-mode', { method: 'PUT', body: { is_active: true } });
  if (result && (result.status === 200 || result.data)) {
    showToast('Modo Escudo activado', 'success');
    loadShieldStatus();
  } else {
    showToast('Error al activar Modo Escudo', 'error');
  }
}

async function deactivateShield() {
  const result = await api('/api/shield-mode', { method: 'PUT', body: { is_active: false } });
  if (result && (result.status === 200 || result.data)) {
    showToast('Modo Escudo desactivado', 'success');
    loadShieldStatus();
  } else {
    showToast('Error al desactivar Modo Escudo', 'error');
  }
}

// ===== CUSTOM COMMANDS =====
let customCommands = JSON.parse(localStorage.getItem('twitchmod_commands') || '[]');

function loadCommands() {
  const list = document.getElementById('commandsList');
  if (customCommands.length === 0) {
    list.innerHTML = '<div class="empty-state"><p>No hay comandos personalizados. Crea uno con el boton de arriba.</p><p class="text-muted" style="margin-top:8px">Los comandos se guardan localmente en tu navegador. Haz clic en "Usar" para enviar la respuesta al chat.</p></div>';
    return;
  }
  list.innerHTML = customCommands.map((cmd, i) => `
    <div class="command-item">
      <div class="command-info">
        <span class="command-name">!${escapeHtml(cmd.name)}</span>
        <span class="command-response">${escapeHtml(cmd.response)}</span>
      </div>
      <div class="command-actions">
        <button class="btn btn-primary btn-sm" onclick="useCommand(${i})">Usar</button>
        <button class="btn btn-secondary btn-sm" onclick="copyCommand(${i})">Copiar</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCommand(${i})">X</button>
      </div>
    </div>
  `).join('');
}

function showAddCommandModal() {
  showModal('Nuevo Comando Personalizado', `
    <div class="form-group">
      <label>Nombre del comando (sin !)</label>
      <input type="text" id="cmdName" class="form-input" placeholder="ej: social">
    </div>
    <div class="form-group">
      <label>Respuesta</label>
      <textarea id="cmdResponse" class="form-input" rows="3" placeholder="ej: Sigueme en Twitter @twitchuser"></textarea>
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'addCommand()' }
  ]);
}

function addCommand() {
  const name = document.getElementById('cmdName').value.trim().toLowerCase().replace(/^!/, '');
  const response = document.getElementById('cmdResponse').value.trim();
  if (!name || !response) return showToast('Nombre y respuesta son requeridos', 'error');
  if (customCommands.find(c => c.name === name)) return showToast('Ya existe ese comando', 'error');
  customCommands.push({ name, response });
  localStorage.setItem('twitchmod_commands', JSON.stringify(customCommands));
  closeModal();
  showToast(`Comando !${name} creado`, 'success');
  loadCommands();
}

async function useCommand(index) {
  const cmd = customCommands[index];
  if (!cmd) return;
  const result = await api('/api/chat/send', { method: 'POST', body: { message: cmd.response } });
  if (result && result.data && result.data[0] && result.data[0].is_sent) {
    showToast(`Comando !${cmd.name} enviado al chat`, 'success');
  } else {
    showToast('Error al enviar al chat', 'error');
  }
}

function copyCommand(index) {
  const cmd = customCommands[index];
  if (!cmd) return;
  navigator.clipboard.writeText(cmd.response);
  showToast('Respuesta copiada', 'success');
}

function deleteCommand(index) {
  customCommands.splice(index, 1);
  localStorage.setItem('twitchmod_commands', JSON.stringify(customCommands));
  showToast('Comando eliminado', 'success');
  loadCommands();
}

// ===== GOALS =====
async function loadGoals() {
  loadLocalGoals();
  loadTwitchGoals();
}

async function loadLocalGoals() {
  const grid = document.getElementById('localGoalsGrid');
  const data = await api('/api/goals/local');
  if (data && data.data && data.data.length > 0) {
    grid.innerHTML = data.data.map(goal => {
      const pct = goal.target > 0 ? Math.min(100, Math.round((goal.current / goal.target) * 100)) : 0;
      return `
        <div class="goal-card">
          <div class="goal-header">
            <span class="goal-type">${escapeHtml(goal.title)}</span>
            <span class="goal-status active">${goal.type}</span>
          </div>
          ${goal.description ? `<div class="goal-description">${escapeHtml(goal.description)}</div>` : ''}
          <div class="goal-progress">
            <div class="goal-bar">
              <div class="goal-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="goal-numbers">
              <span>${goal.current} / ${goal.target}</span>
              <span>${pct}%</span>
            </div>
          </div>
          <div class="goal-actions">
            <button class="btn btn-secondary btn-sm" onclick="updateGoalCurrent('${goal.id}', ${goal.current})">Actualizar progreso</button>
            <button class="btn btn-danger btn-sm" onclick="deleteGoal('${goal.id}')">Eliminar</button>
          </div>
        </div>
      `;
    }).join('');
  } else {
    grid.innerHTML = '<div class="empty-state"><p>No hay metas creadas. Crea una con el boton de arriba.</p></div>';
  }
}

async function loadTwitchGoals() {
  const grid = document.getElementById('goalsGrid');
  grid.innerHTML = '<div class="loading">Cargando metas de Twitch...</div>';
  const data = await api('/api/goals');
  if (data && data.data && data.data.length > 0) {
    grid.innerHTML = data.data.map(goal => {
      const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
      const typeLabels = { follower: 'Seguidores', subscription: 'Suscriptores', subscription_count: 'Suscriptores', new_subscription: 'Nuevas subs', new_subscription_count: 'Nuevas subs' };
      return `
        <div class="goal-card">
          <div class="goal-header">
            <span class="goal-type">${typeLabels[goal.type] || goal.type}</span>
            <span class="goal-status ${goal.status === 'ACTIVE' ? 'active' : ''}">${goal.status}</span>
          </div>
          <div class="goal-description">${escapeHtml(goal.description || 'Sin descripcion')}</div>
          <div class="goal-progress">
            <div class="goal-bar">
              <div class="goal-bar-fill" style="width:${pct}%"></div>
            </div>
            <div class="goal-numbers">
              <span>${goal.current_amount} / ${goal.target_amount}</span>
              <span>${pct}%</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } else {
    grid.innerHTML = '<div class="empty-state"><p>No hay metas de Twitch activas.</p></div>';
  }
}

function showCreateGoalModal() {
  showModal('Crear Nueva Meta', `
    <div class="form-group">
      <label>Titulo</label>
      <input type="text" id="goalTitle" class="form-input" placeholder="ej: 1000 Seguidores">
    </div>
    <div class="form-group">
      <label>Descripcion (opcional)</label>
      <input type="text" id="goalDescription" class="form-input" placeholder="ej: Meta para el fin de semana">
    </div>
    <div class="form-group">
      <label>Objetivo (numero)</label>
      <input type="number" id="goalTarget" class="form-input" placeholder="1000" min="1">
    </div>
    <div class="form-group">
      <label>Tipo</label>
      <select id="goalType" class="form-input">
        <option value="custom">Personalizada</option>
        <option value="followers">Seguidores</option>
        <option value="subs">Suscriptores</option>
        <option value="views">Visitas</option>
        <option value="hours">Horas</option>
      </select>
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Crear', class: 'btn-primary', action: 'createGoal()' }
  ]);
}

async function createGoal() {
  const title = document.getElementById('goalTitle').value.trim();
  const description = document.getElementById('goalDescription').value.trim();
  const target = document.getElementById('goalTarget').value;
  const type = document.getElementById('goalType').value;
  if (!title || !target) return showToast('Titulo y objetivo son requeridos', 'error');
  const result = await api('/api/goals/local', { method: 'POST', body: { title, description, target, type } });
  if (result && result.data) {
    closeModal();
    showToast('Meta creada!', 'success');
    loadLocalGoals();
  } else {
    showToast('Error al crear meta', 'error');
  }
}

async function updateGoalCurrent(goalId, current) {
  showModal('Actualizar Progreso', `
    <div class="form-group">
      <label>Progreso actual</label>
      <input type="number" id="goalCurrentInput" class="form-input" value="${current}" min="0">
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Actualizar', class: 'btn-primary', action: `saveGoalProgress('${goalId}')` }
  ]);
}

async function saveGoalProgress(goalId) {
  const current = document.getElementById('goalCurrentInput').value;
  if (current === '') return showToast('Ingresa un valor', 'error');
  const result = await api(`/api/goals/local/${goalId}`, { method: 'PATCH', body: { current } });
  if (result && result.data) {
    closeModal();
    showToast('Progreso actualizado', 'success');
    loadLocalGoals();
  }
}

async function deleteGoal(goalId) {
  if (!confirm('Eliminar esta meta?')) return;
  const result = await api(`/api/goals/local/${goalId}`, { method: 'DELETE' });
  if (result && (result.status === 204 || result.status === 200)) {
    showToast('Meta eliminada', 'success');
    loadLocalGoals();
  }
}

// ===== CHAT LOG =====
let chatLogData = [];

async function loadChatLog() {
  const container = document.getElementById('chatLogContainer');
  const data = await api('/api/chat/log');
  if (data && data.data && data.data.length > 0) {
    chatLogData = data.data;
    renderChatLog(chatLogData);
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay mensajes en el log. El chat se registra cuando llegan mensajes al canal.</p></div>';
  }
}

function renderChatLog(messages) {
  const container = document.getElementById('chatLogContainer');
  container.innerHTML = messages.map(m => `
    <div class="chat-log-entry">
      <span class="chat-log-time">${new Date(m.timestamp).toLocaleTimeString('es')}</span>
      <span class="chat-log-user" style="color:${m.color || '#9333ea'}">${escapeHtml(m.user)}</span>
      <span class="chat-log-msg">${escapeHtml(m.message)}</span>
    </div>
  `).join('');
  container.scrollTop = container.scrollHeight;
}

function filterChatLog() {
  const q = document.getElementById('chatLogSearch').value.toLowerCase().trim();
  if (!q) return renderChatLog(chatLogData);
  renderChatLog(chatLogData.filter(m => m.user.toLowerCase().includes(q) || m.message.toLowerCase().includes(q)));
}

// ============================================================
// FEATURE: SPAM DETECTOR
// ============================================================
let spamCheckInterval = null;

function startSpamDetector() {
  if (spamCheckInterval) clearInterval(spamCheckInterval);
  const enabled = document.getElementById('spamDetectorEnabled');
  if (enabled && !enabled.checked) return;
  spamCheckInterval = setInterval(checkRecentSpam, 5000);
}

function stopSpamDetector() {
  if (spamCheckInterval) { clearInterval(spamCheckInterval); spamCheckInterval = null; }
}

async function checkRecentSpam() {
  if (!currentUser) return;
  const enabled = document.getElementById('spamDetectorEnabled');
  if (enabled && !enabled.checked) return;
  try {
    const data = await api('/api/chat/log');
    if (!data || !data.data) return;
    const maxMsgs = parseInt(document.getElementById('spamMaxMsgs')?.value) || 5;
    const windowSec = parseInt(document.getElementById('spamWindowSec')?.value) || 10;
    const now = Date.now();
    const userCounts = {};
    data.data.forEach(m => {
      const age = now - new Date(m.timestamp).getTime();
      if (age < windowSec * 1000) {
        userCounts[m.user] = (userCounts[m.user] || 0) + 1;
      }
    });
    Object.entries(userCounts).forEach(([user, count]) => {
      if (count >= maxMsgs) {
        showToast(`${user} esta enviando mensajes rapidamente (${count})`, 'warning');
        fetch('/api/mod/spam-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, message: `${count} mensajes en ${windowSec}s`, action: 'flag' })
        });
      }
    });
  } catch (e) {}
}

async function loadSpamLog() {
  const container = document.getElementById('spamLogList');
  if (!container) return;
  const data = await api('/api/mod/spam-log');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.reverse().map(s => `
      <div class="spam-entry">
        <span class="spam-user">${escapeHtml(s.user)}</span>
        <span class="spam-msg">${escapeHtml(s.message)}</span>
        <span class="spam-action ${s.action}">${s.action}</span>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No se ha detectado spam aun.</p></div>';
  }
}

// ============================================================
// FEATURE: MOD ACTIVITY DASHBOARD
// ============================================================
async function loadModActivity() {
  const data = await api('/api/mod/activity');
  if (!data || !data.data) return;
  const d = data.data;

  document.getElementById('modTotalActions').textContent = d.totalActions || 0;
  document.getElementById('modActiveMods').textContent = d.activeMods || 0;
  document.getElementById('modBansToday').textContent = d.bansToday || 0;
  document.getElementById('modTimeoutsToday').textContent = d.timeoutsToday || 0;

  const leaderboard = document.getElementById('modLeaderboard');
  if (d.leaderboard && d.leaderboard.length > 0) {
    leaderboard.innerHTML = d.leaderboard.map((m, i) => {
      let rankClass = '';
      if (i === 0) rankClass = 'gold';
      else if (i === 1) rankClass = 'silver';
      else if (i === 2) rankClass = 'bronze';
      return `
        <div class="mod-leaderboard-entry">
          <span class="mod-rank ${rankClass}">${i + 1}</span>
          <span class="mod-name">${escapeHtml(m.user)}</span>
          <span class="mod-count">${m.actions} acciones</span>
        </div>`;
    }).join('');
  } else {
    leaderboard.innerHTML = '<div class="empty-state"><p>No hay datos de actividad de moderadores aun.</p></div>';
  }

  const log = document.getElementById('modActionsLog');
  if (d.recentActions && d.recentActions.length > 0) {
    log.innerHTML = d.recentActions.map(a => {
      const icons = { ban: '🚫', timeout: '⏱️', warn: '⚠️', msg: '💬' };
      const icon = icons[a.type] || '📋';
      const time = new Date(a.timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
      return `
        <div class="mod-action-entry">
          <span class="mod-action-icon ${a.type}">${icon}</span>
          <span class="mod-action-user">${escapeHtml(a.moderator)}</span>
          <span class="mod-action-detail">${escapeHtml(a.detail)}</span>
          <span class="mod-action-time">${time}</span>
        </div>`;
    }).join('');
  } else {
    log.innerHTML = '<div class="empty-state"><p>No hay acciones de moderacion registradas.</p></div>';
  }
}

// ============================================================
// FEATURE: SUSPICIOUS USERS
// ============================================================
function loadSuspiciousUsers() {
  const list = JSON.parse(localStorage.getItem('suspiciousUsers') || '[]');
  const container = document.getElementById('suspiciousUsersList');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay usuarios sospechosos registrados.</p></div>';
    return;
  }

  container.innerHTML = list.map((u, i) => {
    const initial = u.username.charAt(0).toUpperCase();
    const date = new Date(u.addedAt).toLocaleDateString('es');
    return `
      <div class="suspicious-user-entry">
        <span class="suspicious-avatar">${initial}</span>
        <div class="suspicious-info">
          <div class="suspicious-name">${escapeHtml(u.username)}</div>
          <div class="suspicious-reason">Agregado: ${date}</div>
        </div>
        <span class="suspicious-badge ${u.reason}">${u.reason}</span>
        <button class="btn btn-danger btn-sm" onclick="removeSuspiciousUser(${i})">X</button>
      </div>`;
  }).join('');
}

function addSuspiciousUser() {
  const username = document.getElementById('suspiciousUsername').value.trim();
  const reason = document.getElementById('suspiciousReason').value;
  if (!username) { showToast('Ingresa un nombre de usuario', 'warning'); return; }

  const list = JSON.parse(localStorage.getItem('suspiciousUsers') || '[]');
  if (list.some(u => u.username.toLowerCase() === username.toLowerCase())) {
    showToast('Este usuario ya esta en la lista', 'warning');
    return;
  }

  list.push({ username, reason, addedAt: new Date().toISOString() });
  localStorage.setItem('suspiciousUsers', JSON.stringify(list));
  document.getElementById('suspiciousUsername').value = '';
  showToast(`${username} agregado a la lista`, 'success');
  loadSuspiciousUsers();
}

function removeSuspiciousUser(index) {
  const list = JSON.parse(localStorage.getItem('suspiciousUsers') || '[]');
  const removed = list.splice(index, 1);
  localStorage.setItem('suspiciousUsers', JSON.stringify(list));
  showToast(`${removed[0].username} eliminado de la lista`, 'info');
  loadSuspiciousUsers();
}

// ============================================================
// FEATURE: CHAT RULES MANAGER
// ============================================================
function loadChatRules() {
  const rules = localStorage.getItem('chatRules') || '';
  const editor = document.getElementById('chatRulesEditor');
  if (editor && !editor.value) editor.value = rules;
  renderRulesPreview();

  const autoGreet = document.getElementById('rulesAutoGreet');
  const savedGreet = localStorage.getItem('rulesAutoGreet');
  if (autoGreet && savedGreet !== null) autoGreet.checked = savedGreet === 'true';

  const delay = document.getElementById('rulesGreetDelay');
  const savedDelay = localStorage.getItem('rulesGreetDelay');
  if (delay && savedDelay) delay.value = savedDelay;
}

function renderRulesPreview() {
  const editor = document.getElementById('chatRulesEditor');
  const preview = document.getElementById('chatRulesPreview');
  if (!editor || !preview) return;

  const text = editor.value.trim();
  if (!text) {
    preview.innerHTML = '<p class="text-muted">Escribe reglas en el editor para ver la vista previa.</p>';
    return;
  }

  const lines = text.split('\n').filter(l => l.trim());
  preview.innerHTML = lines.map((line, i) => {
    const cleaned = line.replace(/^\d+[\.\)]\s*/, '');
    return `
      <div class="rule-item">
        <span class="rule-num">${i + 1}.</span>
        <span>${escapeHtml(cleaned)}</span>
      </div>`;
  }).join('');
}

function saveChatRules() {
  const editor = document.getElementById('chatRulesEditor');
  const autoGreet = document.getElementById('rulesAutoGreet');
  const delay = document.getElementById('rulesGreetDelay');

  if (editor) localStorage.setItem('chatRules', editor.value);
  if (autoGreet) localStorage.setItem('rulesAutoGreet', autoGreet.checked);
  if (delay) localStorage.setItem('rulesGreetDelay', delay.value);

  showToast('Reglas del chat guardadas', 'success');
}

// ============================================================
// FEATURE: WIDGET DE ALERTAS EN VIVO
// ============================================================
let alertsAutoRefresh = null;

async function testAlert(type) {
  const detail = type === 'follow' ? 'TestUser' : type === 'sub' ? 'TestSub' : '100';
  try {
    await fetch('/api/alerts/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, user: 'TestUser', detail })
    });
    showToast(`Alerta de test: ${type}`, 'success');
    loadAlerts();
  } catch (e) {}
}

async function loadAlerts() {
  const data = await api('/api/alerts/recent');
  const preview = document.getElementById('alertsWidgetPreview');
  const history = document.getElementById('alertsHistoryList');

  if (data && data.data && data.data.length > 0) {
    const latest = data.data[data.data.length - 1];
    showFloatingAlert(latest);

    if (preview) {
      preview.innerHTML = renderAlertItem(latest);
    }
    if (history) {
      history.innerHTML = data.data.reverse().map(a => renderAlertItem(a)).join('');
    }
  } else {
    if (preview) preview.innerHTML = '<p class="text-muted" data-i18n="alerts_preview">Las alertas apareceran aqui</p>';
    if (history) history.innerHTML = '<div class="empty-state"><p>No hay alertas aun.</p></div>';
  }
}

function renderAlertItem(a) {
  const icons = {
    follow: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    sub: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>',
    bits: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>',
    raid: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10"/></svg>'
  };
  const labels = { follow: 'Follow', sub: 'Sub', bits: 'Bits', raid: 'Raid' };
  return `
    <div class="alert-item">
      <div class="alert-item-icon ${a.type}">${icons[a.type] || ''}</div>
      <span><strong>${escapeHtml(a.user)}</strong> - ${labels[a.type] || a.type} ${a.detail ? '(' + escapeHtml(a.detail) + ')' : ''}</span>
    </div>`;
}

function showFloatingAlert(alert) {
  const existing = document.querySelector('.alert-floating');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = 'alert-floating glass';
  el.innerHTML = renderAlertItem(alert);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ============================================================
// FEATURE: COMPACT MODE
// ============================================================
function toggleCompactMode() {
  const enabled = document.getElementById('compactModeToggle')?.checked;
  document.body.classList.toggle('compact-mode', enabled);
  localStorage.setItem('compactMode', enabled ? '1' : '0');
}

function loadCompactMode() {
  const saved = localStorage.getItem('compactMode') === '1';
  document.body.classList.toggle('compact-mode', saved);
  const toggle = document.getElementById('compactModeToggle');
  if (toggle) toggle.checked = saved;
}

// ============================================================
// FEATURE: DASHBOARD COMPARTIDO
// ============================================================
async function createShareLink() {
  try {
    const data = await api('/api/share', { method: 'POST' });
    if (data && data.data) {
      const box = document.getElementById('shareResult');
      box.innerHTML = `
        <div class="share-link-box">
          <input type="text" readonly value="${window.location.origin}${data.data.url}" id="shareUrlInput">
          <button class="btn btn-secondary btn-sm" onclick="copyShareLink()">Copiar</button>
        </div>`;
      loadShareLinks();
    }
  } catch (e) {
    showToast('Error al crear enlace', 'error');
  }
}

function copyShareLink() {
  const input = document.getElementById('shareUrlInput');
  if (input) {
    input.select();
    document.execCommand('copy');
    showToast('Enlace copiado', 'success');
  }
}

async function loadShareLinks() {
  const container = document.getElementById('shareLinksList');
  if (!container) return;
  const data = await api('/api/share');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(s => `
      <div class="settings-row">
        <div class="settings-info">
          <h3>${escapeHtml(s.userName)}</h3>
          <p>Creado: ${new Date(s.createdAt).toLocaleString('es')}</p>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteShareLink('${s.token}')">Eliminar</button>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay enlaces compartidos activos.</p></div>';
  }
}

async function deleteShareLink(token) {
  try {
    await fetch(`/api/share/${token}`, { method: 'DELETE' });
    showToast('Enlace eliminado', 'info');
    loadShareLinks();
  } catch (e) {}
}

// ============================================================
// FEATURE: KEYBOARD SHORTCUTS
// ============================================================
const shortcutPages = ['dashboard-home', 'moderation', 'channel-points', 'stream-config', 'chat-settings', 'stats', 'predictions', 'polls'];

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const enabled = document.getElementById('shortcutsEnabled');
    if (enabled && !enabled.checked) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (!e.altKey) {
      if (e.key === 'Escape') { closeModal(); return; }
      return;
    }
    const key = e.key;
    if (key >= '1' && key <= '8') {
      e.preventDefault();
      const idx = parseInt(key) - 1;
      if (shortcutPages[idx]) navigateTo(shortcutPages[idx]);
    } else if (key.toLowerCase() === 's') { e.preventDefault(); navigateTo('settings'); }
    else if (key.toLowerCase() === 'r') { e.preventDefault(); location.reload(); }
    else if (key.toLowerCase() === 'd') { e.preventDefault(); navigateTo('dashboard-home'); }
  });
}

function saveShortcuts() {
  const enabled = document.getElementById('shortcutsEnabled')?.checked;
  localStorage.setItem('shortcutsEnabled', enabled ? '1' : '0');
}

function loadShortcutsSettings() {
  const saved = localStorage.getItem('shortcutsEnabled');
  const toggle = document.getElementById('shortcutsEnabled');
  if (toggle && saved !== null) toggle.checked = saved === '1';
}

// ============================================================
// FEATURE: MODERATOR ACCESS SYSTEM
// ============================================================
async function loadModeratorAccounts() {
  const container = document.getElementById('moderatorAccountsList');
  if (!container) return;
  if (currentUser && currentUser.role === 'moderator') {
    const section = container.closest('.settings-section');
    if (section) section.style.display = 'none';
    return;
  }
  const data = await api('/api/owner/moderators');
  if (data && data.data && data.data.length > 0) {
    container.innerHTML = data.data.map(mod => `
      <div class="settings-row">
        <div class="settings-info" style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#9146ff,#772ce8);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;flex-shrink:0">${(mod.twitchDisplayName || mod.twitchUsername || '?')[0].toUpperCase()}</div>
          <div>
            <h3>${escapeHtml(mod.twitchDisplayName || mod.twitchUsername)}</h3>
            <p style="font-size:0.78rem;color:var(--text-muted)">@${escapeHtml(mod.twitchUsername)} · Agregado: ${new Date(mod.createdAt).toLocaleString('es')}</p>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-danger btn-sm" onclick="removeModeratorAccount('${mod.id}')">Eliminar</button>
        </div>
      </div>
    `).join('');
  } else {
    container.innerHTML = '<div class="empty-state"><p>No hay moderadores configurados. Agrega uno con el boton de arriba.</p></div>';
  }
}

function showAddModeratorModal() {
  showModal('Agregar Moderador', `
    <div class="form-group">
      <label>Nombre de usuario de Twitch</label>
      <input type="text" id="newModUsername" class="form-input" placeholder="Ej: tu_usuario">
      <p style="font-size:0.78rem;color:var(--text-muted);margin-top:6px">El usuario debe tener una cuenta de Twitch activa.</p>
    </div>
  `, [
    { text: 'Cancelar', class: 'btn-secondary', action: 'closeModal()' },
    { text: 'Agregar', class: 'btn-primary', action: 'addModeratorAccount()' }
  ]);
}

async function addModeratorAccount() {
  const username = document.getElementById('newModUsername').value.trim();
  if (!username) return showToast('Nombre de usuario requerido', 'error');
  const result = await api('/api/owner/moderators/add', { method: 'POST', body: { username } });
  closeModal();
  if (result && result.data) {
    showToast(`Moderador @${result.data.twitchUsername} agregado correctamente.`, 'success');
    loadModeratorAccounts();
  } else {
    showToast(result?.error || 'Error al agregar moderador', 'error');
  }
}

async function removeModeratorAccount(id) {
  if (!confirm('Eliminar este moderador?')) return;
  const result = await api(`/api/owner/moderators/${id}`, { method: 'DELETE' });
  if (result && (result.status === 204 || result.status === 200)) {
    showToast('Moderador eliminado', 'success');
    loadModeratorAccounts();
  } else {
    showToast('Error al eliminar', 'error');
  }
}

// ============================================================
// FEATURE: FOLLOWERS PAGINATION
// ============================================================
let followersPaginationCursor = null;
let allFollowersLoaded = false;

async function loadFollowers(append = false) {
  const loadingEl = document.getElementById('followersLoading');
  const countEl = document.getElementById('modFollowerCount');

  if (!append) {
    loadingEl.style.display = '';
    countEl.textContent = 'Cargando...';
    modData.followers = [];
    followersPaginationCursor = null;
    allFollowersLoaded = false;
  }

  try {
    let url = '/api/mod/followers';
    if (followersPaginationCursor) url += `?after=${followersPaginationCursor}`;
    const data = await fetch(url).then(r => r.json());

    if (data && data.data && Array.isArray(data.data.data) && data.data.data.length > 0) {
      modData.followers = modData.followers.concat(data.data.data);
      countEl.textContent = `${modData.followers.length} seguidores`;
      if (data.pagination && data.pagination.cursor) {
        followersPaginationCursor = data.pagination.cursor;
        allFollowersLoaded = false;
      } else {
        allFollowersLoaded = true;
      }
      renderModList('followers', modData.followers, modData.followers.length);
    } else if (data && data.data && data.data.error) {
      const errMsg = data.data.error.message || data.data.error.error || JSON.stringify(data.data.error);
      document.getElementById('followersList').innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(errMsg)}</p><p style="margin-top:12px">Cierra sesion y vuelve a loguearte para actualizar los permisos.</p></div>`;
      countEl.textContent = 'Error';
      allFollowersLoaded = true;
    } else {
      if (!append) {
        document.getElementById('followersList').innerHTML = '<div class="empty-state"><p>No se pudieron cargar los seguidores.</p></div>';
        countEl.textContent = '0 seguidores';
      }
      allFollowersLoaded = true;
    }
  } catch (err) {
    console.error('Load followers error:', err);
    if (!append) {
      document.getElementById('followersList').innerHTML = '<div class="empty-state"><p>Error de conexion</p></div>';
      countEl.textContent = 'Error';
    }
    allFollowersLoaded = true;
  }

  loadingEl.style.display = 'none';
  const loadMoreBtn = document.getElementById('loadMoreFollowers');
  if (loadMoreBtn) loadMoreBtn.style.display = allFollowersLoaded ? 'none' : '';
}

function loadMoreFollowers() {
  loadFollowers(true);
}

// ============================================================
// FEATURE: APPEALS SYSTEM
// ============================================================

function checkAppealRoute() {
  if (window.location.pathname === '/appeal') {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('appeal-screen').style.display = '';
    return true;
  }
  return false;
}

async function submitAppeal() {
  const channel = document.getElementById('appealChannel').value.trim();
  const user = document.getElementById('appealUser').value.trim();
  const banReason = document.getElementById('appealBanReason').value.trim();
  const message = document.getElementById('appealMessage').value.trim();
  if (!channel || !user || !message) return showToast('Canal, usuario y mensaje son requeridos', 'error');
  try {
    const resp = await fetch('/api/appeals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelName: channel, bannedUser: user, banReason, appealMessage: message })
    });
    const data = await resp.json();
    if (data.data) {
      document.getElementById('appeal-screen').innerHTML = `
        <div class="login-bg">
          <div class="login-orb login-orb-1"></div>
          <div class="login-orb login-orb-2"></div>
        </div>
        <div class="login-card" style="text-align:center;max-width:500px">
          <h2 style="margin-bottom:12px;color:#10b981">Solicitud enviada</h2>
          <p style="color:var(--text-secondary);margin-bottom:16px">Tu solicitud ha sido enviada al moderador del canal. Espera su respuesta.</p>
          <a href="/" class="btn-twitch-login" style="display:inline-flex;justify-content:center;text-decoration:none">Volver al login</a>
        </div>`;
    } else {
      showToast(data.error || 'Error al enviar', 'error');
    }
  } catch {
    showToast('Error de conexion', 'error');
  }
}

async function loadAppeals() {
  const container = document.getElementById('appealsList');
  if (!container) return;
  const data = await api('/api/owner/appeals');
  if (!data || !data.data) {
    container.innerHTML = '<div class="empty-state"><p>Error al cargar solicitudes</p></div>';
    return;
  }
  const appeals = data.data;
  const pending = appeals.filter(a => a.status === 'pending');
  document.getElementById('appealsPendingCount').textContent = pending.length + ' pendientes';
  if (appeals.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No hay solicitudes de apelacion.</p></div>';
    return;
  }
  const sorted = [...appeals].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
  container.innerHTML = sorted.map(a => {
    const statusColors = { pending: '#f59e0b', approved: '#10b981', denied: '#ef4444' };
    const statusLabels = { pending: 'Pendiente', approved: 'Aprobada', denied: 'Rechazada' };
    return `
      <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:12px">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div>
            <h3 style="display:flex;align-items:center;gap:8px">
              ${escapeHtml(a.bannedUser)}
              <span style="font-size:0.75rem;padding:2px 8px;border-radius:12px;background:${statusColors[a.status]}20;color:${statusColors[a.status]};font-weight:600">${statusLabels[a.status]}</span>
            </h3>
            <p style="font-size:0.8rem;color:var(--text-muted)">Canal: ${escapeHtml(a.channelName)} · ${new Date(a.createdAt).toLocaleString('es')}</p>
          </div>
          ${a.status === 'pending' ? `
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" onclick="reviewAppeal('${a.id}','approved')">Aprobar</button>
              <button class="btn btn-danger btn-sm" onclick="reviewAppeal('${a.id}','denied')">Rechazar</button>
            </div>
          ` : `<p style="font-size:0.8rem;color:var(--text-muted)">Revisado por: ${escapeHtml(a.reviewedBy || '-')}</p>`}
        </div>
        ${a.banReason ? `<p style="font-size:0.85rem;color:var(--text-secondary)"><strong>Razon del ban:</strong> ${escapeHtml(a.banReason)}</p>` : ''}
        <p style="font-size:0.85rem;color:var(--text-secondary)"><strong>Mensaje:</strong> ${escapeHtml(a.appealMessage)}</p>
      </div>`;
  }).join('');
}

async function reviewAppeal(id, action) {
  const result = await api(`/api/owner/appeals/${id}/review`, {
    method: 'POST',
    body: { action }
  });
  if (result && result.data) {
    showToast(action === 'approved' ? 'Solicitud aprobada' : 'Solicitud rechazada', 'success');
    loadAppeals();
  } else {
    showToast('Error al revisar', 'error');
  }
}

function copyAppealLink() {
  const url = window.location.origin + '/appeal';
  navigator.clipboard.writeText(url);
  showToast('Link copiado', 'success');
}
