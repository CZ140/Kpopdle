// Single source of truth for the homepage "Game Modes" section (brief 4).
// `onClick(navigate)` is the click action — kept here so HomePage stays
// declarative and so the catalogue is testable / lintable on its own.
//
// Only modes that aren't derivable from picking a group below live here.
// Per-group Audio + Cover are reached via the group cards + in-game
// <ModeToggle>; their discoverability is handled there, not here.

export const MODES = [
  {
    id: 'kpopdle',
    name: 'K-POPDLE',
    oneliner: 'One song. Any group. The flagship daily challenge.',
    meta: 'CROSS-GROUP · DAILY',
    cta: 'PLAY TODAY',
    glow: '#F97316',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EAB308 60%, #06B6D4 100%)',
    badge: null,
    onClick: (navigate) => navigate('/kpopdle'),
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
    id: 'battle',
    name: 'Battle',
    oneliner: 'Head-to-head live. Solve faster than your opponent.',
    meta: 'PVP · 1v1',
    cta: 'PLAY LIVE',
    glow: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #6366F1 100%)',
    badge: 'NEW',
    onClick: (navigate) => navigate('/battle'),
  },
]
