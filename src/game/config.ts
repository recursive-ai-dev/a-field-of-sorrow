export const CONFIG = {
  field: 90,
  survivorCount: 14,
  scoutCount: 4,
  gameTime: 150,
  playerSpeed: 22,
  scoutSpeed: 9,
  wardCooldown: 6,
  healCooldown: 4,
  wardDuration: 9,
  healDuration: 3.5,
  wardRadius: 12,
  healRadius: 9,
  survivorDecay: 0.015, // Slightly increased base decay
  scoutDrain: 0.1,    // Slightly increased scout drain
  scoutDrainRange: 16,
  wardProtectionFactor: 0.05,
  healAmount: 0.55,    // Increased heal amount to compensate for over-time
  rescueThreshold: 0.9,
  scoutHuntRange: 45,
  scoutDamageRange: 6,
  scoutDamage: 0.15,   // Slightly increased scout damage
  playerRegen: 0.012,  // Slightly increased player regen
  winRatio: 0.5,
  winMorale: 60,
} as const;

export const NAMES = [
  "Aldric", "Brienne", "Cael", "Dorne", "Elowen", "Fenwick",
  "Greta", "Halvard", "Isolde", "Joran", "Kestrel", "Lyra",
  "Maren", "Nyx", "Orin", "Perrin", "Quenby", "Rolf",
];
