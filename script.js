// Configuration: read from `window.CONFIG` (set in config.js)
const cfg = window.CONFIG || {};
let API_KEY = cfg.API_KEY || '';
let PLAYLIST_ID = cfg.PLAYLIST_ID || '';

const loadBtn = document.getElementById('loadBtn');
const statusEl = document.getElementById('status');
const container = document.getElementById('playlistContainer');
const embedPlayer = document.getElementById('embedPlayer');

// layout radio buttons
const layoutRadios = document.querySelectorAll('input[name="layout"]');
layoutRadios.forEach(r => r.addEventListener('change', () => {
  container.classList.toggle('grid', r.value === 'grid' && r.checked);
  container.classList.toggle('list', r.value === 'list' && r.checked);
}));

async function loadPlaylist() {
  container.innerHTML = '';
  statusEl.textContent = '';

  if (!API_KEY || !PLAYLIST_ID) {
    statusEl.textContent = 'No API key / playlist configured. Edit `config.js` to add API_KEY and PLAYLIST_ID.';
    // If at least the playlist id is present we can still show the embedded playlist
    if (PLAYLIST_ID) {
      embedPlayer.src = `https://www.youtube.com/embed?listType=playlist&list=${PLAYLIST_ID}`;
    } else {
      embedPlayer.src = '';
    }
    container.style.display = 'none';
    return;
  }

  container.style.display = '';
  statusEl.textContent = 'Loading playlist items...';

  try {
    const items = await fetchAllPlaylistItems(API_KEY, PLAYLIST_ID);
    if (!items.length) {
      statusEl.textContent = 'No items found in the playlist.';
      return;
    }
    statusEl.textContent = `Loaded ${items.length} items.`;
    renderItems(items);
    const firstVideoId = items[0].snippet.resourceId.videoId;
    embedPlayer.src = `https://www.youtube.com/embed/${firstVideoId}?rel=0`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load playlist items. See console for details. Falling back to embedded playlist.';
    embedPlayer.src = `https://www.youtube.com/embed?listType=playlist&list=${PLAYLIST_ID}`;
  }
}

loadBtn.addEventListener('click', () => loadPlaylist());

// Auto-load when config is present
if (API_KEY && PLAYLIST_ID) {
  // give the page a moment to render and then load
  window.addEventListener('load', () => setTimeout(loadPlaylist, 200));
}

async function fetchAllPlaylistItems(apiKey, playlistId) {
  const base = 'https://www.googleapis.com/youtube/v3/playlistItems';
  let items = [];
  let pageToken = '';
  const maxResults = 50; // API max

  while (true) {
    const url = new URL(base);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`YouTube API error: ${res.status} ${text}`);
    }
    const json = await res.json();
    if (json.items && json.items.length) {
      items.push(...json.items);
    }
    if (json.nextPageToken) {
      pageToken = json.nextPageToken;
      // small delay to be polite (optional)
      await new Promise(r => setTimeout(r, 100));
    } else break;
  }

  // Filter out any malformed items
  return items.filter(i => i && i.snippet && i.snippet.resourceId && i.snippet.resourceId.videoId);
}

function renderItems(items) {
  container.innerHTML = '';
  const isGrid = document.querySelector('input[name="layout"][value="grid"]').checked;
  container.classList.toggle('grid', isGrid);
  container.classList.toggle('list', !isGrid);

  items.forEach(item => {
    const vidId = item.snippet.resourceId.videoId;
    const title = item.snippet.title;
    const thumb = (item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default)) || {};

    const el = document.createElement('div');
    el.className = 'item' + (isGrid ? '' : ' list');

    const a = document.createElement('a');
    a.href = `https://www.youtube.com/watch?v=${vidId}&list=${PLAYLIST_ID}`;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const img = document.createElement('img');
    img.src = thumb.url || `https://i.ytimg.com/vi/${vidId}/hqdefault.jpg`;
    img.alt = title;

    const meta = document.createElement('div');
    meta.className = 'meta';

    const t = document.createElement('h3');
    t.className = 'title';
    t.textContent = title;

    const watch = document.createElement('a');
    watch.href = `https://www.youtube.com/watch?v=${vidId}&list=${PLAYLIST_ID}`;
    watch.target = '_blank';
    watch.rel = 'noopener noreferrer';
    watch.textContent = 'Watch on YouTube';

    a.appendChild(img);
    meta.appendChild(t);
    meta.appendChild(watch);


    // Build DOM: thumbnail + meta. Clicking the item will load the video in the embedded player.
    if (isGrid) {
      el.appendChild(img);
      el.appendChild(meta);
    } else {
      // keep the external watch link but don't wrap the thumbnail in it — clicking will use the embedded player
      el.appendChild(img);
      el.appendChild(meta);
    }

    // Accessibility: make the item focusable and interactive
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `Play ${title} in embedded player`);

    function playInEmbed() {
      embedPlayer.src = `https://www.youtube.com/embed/${vidId}?rel=0&list=${PLAYLIST_ID}`;
      // scroll player into view on smaller screens
      embedPlayer.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Click or keyboard (Enter/Space) plays in the embedded player
    el.addEventListener('click', (e) => {
      // If clicked on the external link allow the browser to open it
      if (e.target.tagName === 'A') return;
      playInEmbed();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playInEmbed();
      }
    });

    container.appendChild(el);
  });
}

// Initialize behavior on page load:
// - If a PLAYLIST_ID exists but no API_KEY, show the embedded playlist as a fallback.
// - If both API_KEY and PLAYLIST_ID exist, auto-load the grid view.
window.addEventListener('load', () => {
  if (PLAYLIST_ID && !API_KEY) {
    // show embedded playlist
    embedPlayer.src = `https://www.youtube.com/embed?listType=playlist&list=${PLAYLIST_ID}`;
    container.style.display = 'none';
    statusEl.textContent = 'Showing embedded playlist (no API key configured).';
  } else if (API_KEY && PLAYLIST_ID) {
    // auto load items when fully configured
    setTimeout(loadPlaylist, 200);
  }
});
