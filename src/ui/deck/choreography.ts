// Deck power-on (the choreography centrepiece): boundary settles, the grid
// ignites in a staggered cascade, the rail follows; settles under ~1.5s and is
// one-shot per connect. Reduced motion swaps everything to instant states.
// Lives in its own module so DeckView and Rail don't import each other.
export const igniteContainer = (delay: number) => ({
  hidden: {},
  show: { transition: { staggerChildren: 0.02, delayChildren: delay } },
})

export const igniteItem = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
}
