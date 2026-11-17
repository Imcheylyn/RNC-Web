# Community wordmark

The community header uses the supplied transparent assets at their original aspect ratio (1818 × 156):

- `/assets/Title_White.png` on dark community pages, character files, Staff archive cards, and the Discord connection panel.
- `/assets/Title_Demo.png` on the light login header.

Shared sizing is in `public/community/rnc/community-brand.css`. The community page handler includes it on every page. Phone headers reserve a separate row for the full wordmark; a ResizeObserver measures header height so gallery and height-chart viewports remain aligned.

Character names, Discord server avatars, elemental badges, and the fictional Temporis Codex employee-card organization remain separate identities.
