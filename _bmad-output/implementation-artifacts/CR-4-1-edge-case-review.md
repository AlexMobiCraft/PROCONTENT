# Edge Case Hunter Findings

- **Missing error boundary for upload media failure**
  - Category: BUG
  - Evidence: src/features/admin/api/posts.ts
  - Consequence: Media upload fails but post creation continues

- **Post type derivation with mixed media types**
  - Category: LOGIC
  - Evidence: src/features/admin/api/posts.ts
  - Consequence: Incorrect post type assigned to mixed media posts

- **Upload exceeds MAX_MEDIA_FILES limit concurrently**
  - Category: LOGIC
  - Evidence: src/features/admin/api/uploadMedia.ts
  - Consequence: Users can bypass media limits by uploading concurrently

- **User deletes a file while upload is in progress**
  - Category: STATE
  - Evidence: src/features/admin/components/MediaUploader.tsx
  - Consequence: UI state desync or aborted upload error

- **Form submitted multiple times while uploading**
  - Category: UX
  - Evidence: src/features/admin/components/PostForm.tsx
  - Consequence: Duplicate posts or inconsistent media state

