const searchForm = document.querySelector('#searchForm');
const searchInput = document.querySelector('#searchInput');
const searchBtn = searchForm.querySelector('button[type="submit"]');
const errorEl = document.querySelector('#error');
const loadingEl = document.querySelector('#loading');
const resultsEl = document.querySelector('#results');
const favoritesEl = document.querySelector('#favoritesContainer');
const themeToggle = document.querySelector('#themeToggle');

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const FAVORITES_KEY = 'wordlyFavorites';
const THEME_KEY = 'wordlyTheme';

document.addEventListener('DOMContentLoaded', () => {
  displayFavorites();
  restoreTheme();
});
searchForm.addEventListener('submit', handleSearch);
themeToggle?.addEventListener('click', toggleTheme);

// ---------- Theme ----------

function restoreTheme() {
  if (localStorage.getItem(THEME_KEY) === 'dark') {
    document.body.classList.add('dark-theme');
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
}

// ---------- Search ----------

function handleSearch(e) {
  e.preventDefault();
  clearError();
  clearResults();

  const word = searchInput.value.trim().toLowerCase();
  if (!word) return displayError('Please enter a word.');

  fetchWord(word);
}

async function fetchWord(word) {
  setLoading(true);
  try {
    const res = await fetch(API_BASE + encodeURIComponent(word));
    if (!res.ok) {
      return displayError(res.status === 404
        ? 'We could not find that word. Check the spelling and try again.'
        : 'Something went wrong while loading the definition. Please try again.');
    }
    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) return displayError('We could not find that word. Check the spelling and try again.');
    displayWord(data[0]);
  } catch {
    displayError('Something went wrong while loading the definition. Please try again.');
  } finally {
    setLoading(false);
  }
}

// ---------- Render ----------

function displayWord(entry) {
  clearResults();

  const phonetic = entry.phonetic || (entry.phonetics?.find(p => p.text)?.text ?? '');
  const audioUrl = getAudioUrl(entry);
  const saved = isFavorite(entry.word);

  const meaningsHTML = (entry.meanings || []).map(m => {
    const defs = (m.definitions || []).map(d => `
      <li>${escapeHTML(d.definition)}
        ${d.example ? `<div class="example">"${escapeHTML(d.example)}"</div>` : ''}
      </li>`).join('');
    const synonyms = getSynonyms(m);
    return `
      <div class="meaning-block">
        <h3 class="part-of-speech">${escapeHTML(m.partOfSpeech || '')}</h3>
        <ul class="definitions-list">${defs}</ul>
        ${synonyms.length ? `<div class="synonyms">Synonyms: ${escapeHTML(synonyms.join(', '))}</div>` : ''}
      </div>`;
  }).join('');

  const sourceHTML = entry.sourceUrls?.[0]
    ? `<a href="${entry.sourceUrls[0]}" target="_blank" rel="noopener noreferrer" class="source-link">Source</a>`
    : '';

  resultsEl.innerHTML = `
    <div class="word-card">
      <div class="word-heading">
        <h2>${escapeHTML(entry.word)}</h2>
        ${phonetic ? `<span class="phonetic">${escapeHTML(phonetic)}</span>` : ''}
        ${audioUrl ? `<button type="button" class="audio-btn">🔊 Play</button>` : ''}
        <button type="button" class="favorite-btn ${saved ? 'is-saved' : ''}">${saved ? '★ Saved' : '☆ Save word'}</button>
      </div>
      ${meaningsHTML}
      ${sourceHTML}
    </div>`;

  if (audioUrl) resultsEl.querySelector('.audio-btn').addEventListener('click', () => playAudio(audioUrl));

  const favBtn = resultsEl.querySelector('.favorite-btn');
  favBtn.addEventListener('click', () => {
    toggleFavorite(entry.word, phonetic);
    const nowSaved = isFavorite(entry.word);
    favBtn.classList.toggle('is-saved', nowSaved);
    favBtn.textContent = nowSaved ? '★ Saved' : '☆ Save word';
  });
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Audio / synonyms ----------

function getAudioUrl(entry) {
  return entry.phonetics?.find(p => p.audio)?.audio || null;
}

function playAudio(url) {
  new Audio(url).play().catch(() => displayError('Unable to play audio for this word.'));
}

function getSynonyms(meaning) {
  const fromMeaning = meaning.synonyms || [];
  const fromDefs = (meaning.definitions || []).flatMap(d => d.synonyms || []);
  return [...new Set([...fromMeaning, ...fromDefs])];
}

// ---------- UI state ----------

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  loadingEl?.classList.toggle('hidden', !isLoading);
}

function displayError(msg) {
  errorEl.textContent = msg;
}

function clearError() {
  errorEl.textContent = '';
}

function clearResults() {
  resultsEl.innerHTML = '';
}

// ---------- Favorites (localStorage) ----------

function getFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isFavorite(word) {
  return getFavorites().some(f => f.word.toLowerCase() === word.toLowerCase());
}

function saveFavorite(word, phonetic) {
  if (isFavorite(word)) return;
  const favorites = [...getFavorites(), { word, phonetic: phonetic || '' }];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  displayFavorites();
}

function removeFavorite(word) {
  const favorites = getFavorites().filter(f => f.word.toLowerCase() !== word.toLowerCase());
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  displayFavorites();
}

function toggleFavorite(word, phonetic) {
  isFavorite(word) ? removeFavorite(word) : saveFavorite(word, phonetic);
}

function displayFavorites() {
  if (!favoritesEl) return;
  const favorites = getFavorites();

  if (!favorites.length) {
    favoritesEl.innerHTML = `<p id="favorites-empty">No favorite words saved yet.</p>`;
    return;
  }

  favoritesEl.innerHTML = favorites.map(f => `
    <div class="favorite-item">
      <button type="button" class="favorite-word-btn" data-word="${escapeHTML(f.word)}">${escapeHTML(f.word)}</button>
      ${f.phonetic ? `<span class="favorite-phonetic">${escapeHTML(f.phonetic)}</span>` : ''}
      <button type="button" class="remove-favorite-btn" data-word="${escapeHTML(f.word)}">Remove</button>
    </div>`).join('');

  favoritesEl.querySelectorAll('.favorite-word-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      searchInput.value = btn.dataset.word;
      fetchWord(btn.dataset.word);
    })
  );

  favoritesEl.querySelectorAll('.remove-favorite-btn').forEach(btn =>
    btn.addEventListener('click', () => removeFavorite(btn.dataset.word))
  );
}