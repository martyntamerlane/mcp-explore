import "@testing-library/jest-dom/vitest"

// jsdom implements no layout, so it ships no scrollIntoView at all. The browse
// column calls it to keep the keyboard highlight on screen; a no-op is the
// honest stand-in, since there is no scrolling to assert against here.
Element.prototype.scrollIntoView ??= () => {}
