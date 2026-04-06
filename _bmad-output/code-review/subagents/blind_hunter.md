# Blind Hunter Findings

1. **Inefficient Sanitization & DOM Manipulation**: `sanitizeHtml` parses the string into DOM via `DOMPurify.sanitize`, then we create a `div`, set `innerHTML`, use `querySelectorAll` to mutate it, and serialize it back via `innerHTML`. This double-parsing is inefficient. DOMPurify has a hook `DOMPurify.addHook('afterSanitizeAttributes', ...)` for this exact purpose.
2. **Missing `target="_blank"` Security**: Links (`<a>`) in user content don't seem to be forced to open in a new tab or get `rel="noopener noreferrer"`.
3. **No useMemo for Expensive Operations**: `sanitizeHtml` is called in the render body of `MarkdownRenderer`. For long posts, this blocks the main thread on every re-render.
4. **Hydration Mismatch Risk**: `if (typeof window === 'undefined') return ''` will cause Next.js to SSR an empty string, then hydrate with full HTML on the client, resulting in a React Hydration Error and destroying SEO.
5. **Allowed `style` Attribute**: Allowing the `style` attribute in DOMPurify can be a vector for CSS-based phishing or UI breaking (e.g. absolute positioning overlays) if not strictly configured.
6. **Hardcoded Tailwind string**: The huge string of `[&_figure...` classes makes the component hard to read and maintain.
7. **Default DOMPurify Import**: `import DOMPurify from 'dompurify'` may pull in the entire library instead of allowing tree-shaking (though DOMPurify is generally a monolith).
8. **Missing Error Boundary**: If `DOMPurify` throws an error due to bizarre input, the entire component crashes.
9. **Empty Content Handling**: If `content` is `""`, we render a `rich-content` wrapper div with no content, which might have unwanted margins/padding.
10. **Naive Test Mock**: The Vitest mock for `dompurify` replaces tags via `replaceWith(...childNodes)`. This doesn't perfectly reflect DOMPurify's behavior and might mask edge cases.
