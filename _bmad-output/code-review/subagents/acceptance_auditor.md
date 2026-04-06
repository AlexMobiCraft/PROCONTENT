# Acceptance Auditor Findings

- **Title:** Missing `max-width: 100%` on inline images
  **Violates AC:** 2. Текст с инлайн-изображениями ("изображения адаптивны: max-width: 100%, не выходят за ширину контентного блока")
  **Evidence:** The Tailwind classes `[&_figure[data-type='inline-image']_img]:rounded-lg [&_figure[data-type='inline-image']_img]:border [&_figure[data-type='inline-image']_img]:border-border` do not explicitly include `max-w-full`. (Note: Tailwind's preflight adds `max-w-full` to all imgs by default, but relying on preflight might not satisfy the explicit AC requirement, though it technically works).
- **Title:** Redundant DOM parsing for lazy loading
  **Violates AC:** Dev Notes / Best Practices
  **Evidence:** `src/lib/markdown.ts` parses the string back into DOM to add `loading="lazy"`, which is inefficient compared to `DOMPurify.addHook`.
- **Title:** SSR Guard implementation might cause hydration errors
  **Violates AC:** AC 1, 2, 3 (Implicit requirement for Next.js apps not to throw hydration errors)
  **Evidence:** The spec explicitly requested `if (typeof window === 'undefined') return ''`. However, because it's a Next.js App, returning empty string on server and full string on client causes hydration mismatches. The AC asks for this, but it introduces a bug.
