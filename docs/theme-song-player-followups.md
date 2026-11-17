# Theme Song player: implementation and next steps

## Implemented

- Theme Song opens a compact floating player inside the R:NC page (not a separate browser window), with the album cover layered over a spinning record.
- The player can be dragged around the viewport, minimized, paused, resumed, and dismissed.
- Community pages stay inside a shared shell, so the audio element remains alive while the inner page changes. The address bar and browser Back/Forward continue to follow the page navigation.
- Uploaded/direct audio and YouTube sources play from the dock. The YouTube video surface stays visually hidden while the record artwork remains visible.
- The dock reports playback, pause, end, and source errors back to the character page.
- The expanded player uses a visible grooved record beside the cover. Playing records rotate; pausing preserves the rotation position.
- Minimizing leaves only a draggable record. Clicking or keyboard-activating it restores the controls without changing playback.
- `/community/rnc/music` lists existing character theme songs, with search, character-type filtering, play/pause, and character links. It shares the persistent player and respects character visibility. No additional migration is needed.
- MUSIC is available in desktop headers and in the mobile ARCHIVE menu.

## Follow-up list

1. Continue checking touch dragging on community members' mobile browsers.
2. Add optional previous/next controls if characters gain multiple soundtrack tracks.
3. Decide whether the minimized player should remember its position and collapsed state between visits.
4. Review keyboard focus, screen-reader labels, and reduced-motion behavior for the dock.
5. Check YouTube playback and autoplay behavior in the browsers used by the community; some browsers require a second tap before audio starts.
