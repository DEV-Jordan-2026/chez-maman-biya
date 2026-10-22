// config/restaurant.config.js — Configuration branding · Chez Maman Biya
// Valeurs par défaut, presets de thème, mapping CSS variables

export const CONFIG_KEY = 'cmb_restaurant_config'

export const DEFAULT_CONFIG = {
  nom:      'Chez Maman Biya',
  tagline:  'Restaurant · Yaoundé',
  adresse:  'Bastos, Yaoundé, Cameroun',
  tel:      '+237 691 78 33 41',
  email:    'contact@chezmamanbiya.cm',
  whatsapp: '+237691783341',
  logo:     null,
  couleurs: {
    gold:       '#C9973C',
    goldLight:  '#E8B86D',
    goldPale:   '#F5D9A0',
    goldDark:   '#8B6820',
    ebony:      '#080605',
    ebony1:     '#100D09',
    ebony2:     '#1A1410',
    ebony3:     '#261E17',
    cream:      '#F0E8D8',
    terracotta: '#C4603A',
    forest:     '#2D6A4F',
  },
}

/** camelCase config key → CSS variable name in globals.css */
export const COLOR_CSS_MAP = {
  gold:       '--gold',
  goldLight:  '--gold-light',
  goldPale:   '--gold-pale',
  goldDark:   '--gold-dark',
  ebony:      '--ebony',
  ebony1:     '--ebony-1',
  ebony2:     '--ebony-2',
  ebony3:     '--ebony-3',
  cream:      '--cream',
  terracotta: '--terracotta',
  forest:     '--forest',
}

/** Labels affichés dans le panneau Branding */
export const COLOR_LABELS = {
  gold:       { label: 'Couleur principale',  desc: 'Titres, boutons, accents' },
  goldLight:  { label: 'Principale – claire', desc: 'Dégradés, hover' },
  goldDark:   { label: 'Principale – foncée', desc: 'Ombres, états pressés' },
  terracotta: { label: 'Accent secondaire',   desc: 'CTA, badges' },
  cream:      { label: 'Texte principal',     desc: 'Corps de texte, icônes' },
  ebony:      { label: 'Fond principal',      desc: 'Arrière-plan global' },
  forest:     { label: 'Couleur succès',      desc: 'Statuts, confirmations' },
}

export const PRESETS = [
  {
    id: 'classique', nom: 'Classique', emoji: '🌿',
    couleurs: {
      gold:'#C9973C', goldLight:'#E8B86D', goldPale:'#F5D9A0', goldDark:'#8B6820',
      ebony:'#080605', ebony1:'#100D09', ebony2:'#1A1410', ebony3:'#261E17',
      cream:'#F0E8D8', terracotta:'#C4603A', forest:'#2D6A4F',
    },
  },
  {
    id: 'nuit-bleue', nom: 'Nuit Bleue', emoji: '🌊',
    couleurs: {
      gold:'#5EB0D8', goldLight:'#93CDE8', goldPale:'#CAE8F5', goldDark:'#2E7BA8',
      ebony:'#030810', ebony1:'#071020', ebony2:'#0E1A2E', ebony3:'#172540',
      cream:'#D8EEFA', terracotta:'#3A78B8', forest:'#1A6B6B',
    },
  },
  {
    id: 'savane', nom: 'Savane', emoji: '🦁',
    couleurs: {
      gold:'#B8A045', goldLight:'#D4C068', goldPale:'#EAD98A', goldDark:'#7A6820',
      ebony:'#07070A', ebony1:'#0E0F14', ebony2:'#17181E', ebony3:'#22232B',
      cream:'#EEE8D5', terracotta:'#A06040', forest:'#4A7030',
    },
  },
  {
    id: 'violet', nom: 'Violet Royal', emoji: '👑',
    couleurs: {
      gold:'#B87AD8', goldLight:'#D0A0E8', goldPale:'#E8D0F5', goldDark:'#7A40A8',
      ebony:'#08050A', ebony1:'#100B14', ebony2:'#1A1020', ebony3:'#26182E',
      cream:'#F0D8F8', terracotta:'#9040C0', forest:'#5A2D8A',
    },
  },
]
