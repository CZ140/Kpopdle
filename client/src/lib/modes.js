// Single source of truth for the homepage "Game Modes" section (brief 4).
// `onClick(navigate)` is the click action — kept here so HomePage stays
// declarative and so the catalogue is testable / lintable on its own.

export const MODES = [
  {
    id: 'daily',
    name: 'Daily Song',
    oneliner: 'Hear it, name it. The original audio quiz.',
    meta: '8 GROUPS · DAILY',
    cta: 'PICK A GROUP',
    glow: '#FF2D78',
    gradient: 'linear-gradient(135deg, #FF2D78 0%, #A855F7 100%)',
    badge: null,
    // Daily + Cover both need group disambiguation; scroll to the existing
    // "Pick your bias" grid below the section instead of routing blindly.
    onClick: () => {
      document.getElementById('hp-groups')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  },
  {
    id: 'cover',
    name: 'Coverdle',
    oneliner: 'See it, name it. Guess the album cover.',
    meta: '8 GROUPS · DAILY',
    cta: 'PICK A GROUP',
    glow: '#A855F7',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    badge: 'NEW',
    onClick: () => {
      document.getElementById('hp-groups')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
  },
  {
    id: 'group',
    name: 'Guess the Group',
    oneliner: 'Hear it, name the group. Cross-group daily.',
    meta: 'CROSS-GROUP · 3 TRIES',
    cta: 'PLAY TODAY',
    glow: '#22D3EE',
    gradient: 'linear-gradient(135deg, #22D3EE 0%, #6366F1 100%)',
    badge: 'NEW',
    onClick: (navigate) => navigate('/guess-the-group'),
  },
  {
    id: 'kpopdle',
    name: 'K-POPDLE',
    oneliner: 'One song. Any group. The flagship.',
    meta: 'CROSS-GROUP · DAILY',
    cta: 'PLAY TODAY',
    glow: '#F97316',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EAB308 60%, #06B6D4 100%)',
    badge: null,
    onClick: (navigate) => navigate('/kpopdle'),
  },
  {
    id: 'battle',
    name: 'Battle',
    oneliner: 'Head-to-head live. Coming soon.',
    meta: 'PVP · 1v1',
    cta: 'NOTIFY ME',
    glow: '#64748B',
    gradient: 'linear-gradient(135deg, #1e1e2e 0%, #475569 100%)',
    badge: 'SOON',
    locked: true,
    // Locked card — clicking does nothing for now. Wire to a notify form later.
    onClick: null,
  },
]
