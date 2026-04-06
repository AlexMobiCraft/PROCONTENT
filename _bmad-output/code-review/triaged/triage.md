# Triaged Findings

1. **Hydration Mismatch Risk from SSR Guard**
   - **Source:** blind+edge+auditor
   - **Classification:** patch
   - **Location:** src/lib/markdown.ts:43
   - **Detail:** Returning an empty string on the server (`typeof window === 'undefined'`) while rendering full HTML on the client causes React hydration mismatches. This also breaks SEO. Instead of returning an empty string, the component should safely handle SSR, e.g., by returning the original string or using a `useEffect` / `isMounted` pattern, or relying on `isomorphic-dompurify`.
   - **Note:** The spec explicitly asked for this guard, but as the Acceptance Auditor noted, it breaks Next.js hydration. We must patch it to avoid runtime errors.

2. **Inefficient Sanitization / Redundant DOM Parsing**
   - **Source:** blind+auditor
   - **Classification:** patch
   - **Location:** src/lib/markdown.ts:47
   - **Detail:** Currently, `sanitizeHtml` parses the string into DOM via `DOMPurify.sanitize`, then we manually create a `div`, set `innerHTML`, use `querySelectorAll` to mutate `<img>` tags (adding `loading="lazy"`), and serialize it back via `innerHTML`. This double-parsing is inefficient. We should use `DOMPurify.addHook('afterSanitizeAttributes', ...)` to add the attribute during the sanitization pass.

3. **Performance: Missing useMemo for Expensive Sanitization**
   - **Source:** blind+edge
   - **Classification:** defer
   - **Location:** src/features/feed/components/MarkdownRenderer.tsx:10
   - **Detail:** `sanitizeHtml` is called synchronously in the render body. For very large posts, this might block the main thread during render. Since the content doesn't change often, wrapping it in `useMemo` is a good optimization. However, it's not strictly a bug right now.

4. **Security: Missing target="_blank" and rel="noopener"**
   - **Source:** blind
   - **Classification:** patch
   - **Location:** src/lib/markdown.ts (Allowed Tags/Attrs)
   - **Detail:** Links (`<a>`) in user content should be forced to open in a new tab (`target="_blank"`) and get `rel="noopener noreferrer"` to prevent tabnabbing. This can also be added via a DOMPurify hook.

5. **Error Boundary Missing for DOM Manipulation**
   - **Source:** edge
   - **Classification:** defer
   - **Location:** src/lib/markdown.ts:47
   - **Detail:** If DOMPurify returns valid HTML but subsequent DOM manipulation fails, the component crashes. (This will be mitigated if we switch to hooks, so deferred/resolved by #2).

6. **Missing explicit max-width: 100% on inline images**
   - **Source:** auditor
   - **Classification:** dismiss
   - **Detail:** Tailwind's preflight already adds `max-w-full` to all images by default. Explicitly adding it is redundant.

7. **Hardcoded Tailwind String**
   - **Source:** blind
   - **Classification:** dismiss
   - **Detail:** Expected pattern in this project (as per PostDetail reference).
