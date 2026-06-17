// Application State
let releaseNotes = [];
let currentFilter = 'all';
let searchQuery = '';
let selectedNoteId = null; // format: 'dateIndex-noteIndex'

// Progress Ring Configuration
const ringCircle = document.getElementById('progress-circle');
let ringRadius = 0;
let ringCircumference = 0;

if (ringCircle) {
    ringRadius = ringCircle.r.baseVal.value;
    ringCircumference = ringRadius * 2 * Math.PI;
    ringCircle.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    ringCircle.style.strokeDashoffset = ringCircumference;
}

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    refreshSpinner: document.getElementById('refresh-spinner'),
    lastSyncTime: document.getElementById('last-sync-time'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChips: document.getElementById('filter-chips'),
    loadingState: document.getElementById('loading-state'),
    emptyState: document.getElementById('empty-state'),
    btnResetFilters: document.getElementById('btn-reset-filters'),
    releaseGrid: document.getElementById('release-grid'),
    
    // Tweet Drawer
    tweetDrawer: document.getElementById('tweet-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    previewBadge: document.getElementById('preview-badge'),
    previewDate: document.getElementById('preview-date'),
    previewText: document.getElementById('preview-text'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charCount: document.getElementById('char-count'),
    btnCopyTweet: document.getElementById('btn-copy-tweet'),
    btnTweetIntent: document.getElementById('btn-tweet-intent'),
    
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Refresh Button
    elements.btnRefresh.addEventListener('click', fetchReleaseNotes);
    
    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearch.style.display = searchQuery ? 'block' : 'none';
        renderFeed();
    });
    
    // Clear search button
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        renderFeed();
    });

    // Reset Filters button
    elements.btnResetFilters.addEventListener('click', () => {
        elements.searchInput.value = '';
        searchQuery = '';
        elements.clearSearch.style.display = 'none';
        currentFilter = 'all';
        
        // Update filter chips UI
        document.querySelectorAll('.chip').forEach(c => {
            c.classList.toggle('active', c.dataset.type === 'all');
        });
        
        renderFeed();
    });
    
    // Filter Chips
    elements.filterChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        currentFilter = chip.dataset.type;
        renderFeed();
    });
    
    // Close Tweet Drawer
    elements.btnCloseDrawer.addEventListener('click', deselectAllNotes);
    
    // Tweet textarea character count tracking
    elements.tweetTextarea.addEventListener('input', updateTweetCharacterCount);
    
    // Copy Tweet Button
    elements.btnCopyTweet.addEventListener('click', copyTweetToClipboard);
    
    // Tweet Intent Button
    elements.btnTweetIntent.addEventListener('click', postTweet);
}

// Fetch Release Notes from backend API
async function fetchReleaseNotes() {
    showLoading(true);
    deselectAllNotes();
    
    try {
        const response = await fetch('/api/release-notes');
        if (!response.ok) throw new Error('API request failed');
        
        const data = await response.json();
        
        if (data.status === 'success') {
            releaseNotes = data.entries;
            
            // Update Sync Status Time
            const date = new Date();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            elements.lastSyncTime.textContent = `Last Synced: ${timeStr} (${data.source === 'live' ? 'Live' : 'Cached'})`;
            
            renderFeed();
            showToast('Release notes successfully updated!');
        } else {
            throw new Error(data.message || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast('Failed to sync release notes. Using offline cache if available.', true);
        elements.lastSyncTime.textContent = 'Last Synced: Failed (Offline)';
    } finally {
        showLoading(false);
    }
}

// Toggle loading spinner and grid visibility
function showLoading(isLoading) {
    if (isLoading) {
        elements.loadingState.classList.remove('hidden');
        elements.releaseGrid.classList.add('hidden');
        elements.emptyState.classList.add('hidden');
        elements.btnRefresh.disabled = true;
        elements.refreshSpinner.style.display = 'block';
        elements.btnRefresh.querySelector('.btn-icon').style.display = 'none';
    } else {
        elements.loadingState.classList.add('hidden');
        elements.releaseGrid.classList.remove('hidden');
        elements.btnRefresh.disabled = false;
        elements.refreshSpinner.style.display = 'none';
        elements.btnRefresh.querySelector('.btn-icon').style.display = 'block';
    }
}

// Render feed notes based on Search and Filter parameters
function renderFeed() {
    elements.releaseGrid.innerHTML = '';
    let matchesCount = 0;
    
    releaseNotes.forEach((entry, dateIndex) => {
        // Filter notes within this date
        const filteredNotes = entry.notes.filter(note => {
            const matchesType = currentFilter === 'all' || note.type.toLowerCase() === currentFilter.toLowerCase();
            
            const noteText = (note.type + ' ' + note.description).toLowerCase();
            const matchesSearch = !searchQuery || noteText.includes(searchQuery) || entry.date.toLowerCase().includes(searchQuery);
            
            return matchesType && matchesSearch;
        });
        
        if (filteredNotes.length > 0) {
            matchesCount += filteredNotes.length;
            
            // Create Date Group Element
            const dateGroup = document.createElement('div');
            dateGroup.className = 'date-group';
            
            const dateHeading = document.createElement('div');
            dateHeading.className = 'date-heading';
            dateHeading.innerHTML = `
                <div class="date-heading-text">${entry.date}</div>
                <div class="date-heading-line"></div>
            `;
            dateGroup.appendChild(dateHeading);
            
            const dateCards = document.createElement('div');
            dateCards.className = 'date-cards';
            
            filteredNotes.forEach((note) => {
                // Find original index of this note in entry.notes
                const noteIndex = entry.notes.indexOf(note);
                const noteId = `${dateIndex}-${noteIndex}`;
                
                const card = document.createElement('div');
                card.className = `release-card ${selectedNoteId === noteId ? 'selected' : ''}`;
                card.dataset.id = noteId;
                
                // Construct Type Badge CSS class
                const badgeClass = `badge-${note.type.toLowerCase()}`;
                
                card.innerHTML = `
                    <div class="card-top">
                        <span class="type-badge ${badgeClass}">${note.type}</span>
                        <div class="card-checkbox">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                    </div>
                    <div class="card-content">
                        ${note.description}
                    </div>
                    <div class="card-footer">
                        <button class="card-action-btn tweet-direct-btn" data-id="${noteId}">
                            <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                            </svg>
                            Tweet
                        </button>
                    </div>
                `;
                
                // Add Card Selection Handlers
                card.addEventListener('click', (e) => {
                    // Prevent trigger if they click an anchor tag inside description
                    if (e.target.tagName === 'A') return;
                    
                    // If they click the direct tweet button
                    if (e.target.closest('.tweet-direct-btn')) {
                        e.stopPropagation();
                        selectNote(noteId);
                        postTweet();
                        return;
                    }
                    
                    toggleNoteSelection(noteId);
                });
                
                dateCards.appendChild(card);
            });
            
            dateGroup.appendChild(dateCards);
            elements.releaseGrid.appendChild(dateGroup);
        }
    });
    
    // Handle Empty States
    if (matchesCount === 0) {
        elements.emptyState.classList.remove('hidden');
        elements.releaseGrid.classList.add('hidden');
    } else {
        elements.emptyState.classList.add('hidden');
        elements.releaseGrid.classList.remove('hidden');
    }
}

// Toggle selection state of a note card
function toggleNoteSelection(noteId) {
    if (selectedNoteId === noteId) {
        deselectAllNotes();
    } else {
        selectNote(noteId);
    }
}

// Select a specific release note and open draft tweet drawer
function selectNote(noteId) {
    selectedNoteId = noteId;
    
    // Update active state in grid cards
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.id === noteId);
    });
    
    // Parse indices
    const [dateIndex, noteIndex] = noteId.split('-').map(Number);
    const entry = releaseNotes[dateIndex];
    const note = entry.notes[noteIndex];
    
    // Update Tweet Drawer preview contents
    elements.previewBadge.textContent = note.type;
    elements.previewBadge.className = `preview-badge badge-${note.type.toLowerCase()}`;
    elements.previewDate.textContent = entry.date;
    
    // Strip HTML for the preview text block
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.description;
    elements.previewText.textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Pre-fill the compose textarea with clean formatted content
    const tweetText = generateDefaultTweet(note, entry.date, entry.link);
    elements.tweetTextarea.value = tweetText;
    
    // Open drawer
    elements.tweetDrawer.classList.add('active');
    
    // Trigger count updates
    updateTweetCharacterCount();
}

// Deselect all notes and close drawer
function deselectAllNotes() {
    selectedNoteId = null;
    document.querySelectorAll('.release-card').forEach(card => {
        card.classList.remove('selected');
    });
    elements.tweetDrawer.classList.remove('active');
}

// Generate the beautiful default tweet draft
function generateDefaultTweet(note, date, link) {
    let emoji = '📢';
    if (note.type === 'Feature') emoji = '🚀';
    if (note.type === 'Announcement') emoji = '🔔';
    if (note.type === 'Issue') emoji = '⚠️';
    if (note.type === 'Breaking') emoji = '🚨';
    if (note.type === 'Change') emoji = '🔄';
    
    // Strip HTML to get plain text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = note.description;
    let descriptionText = tempDiv.textContent || tempDiv.innerText || '';
    
    // Standardize whitespace
    descriptionText = descriptionText.replace(/\s+/g, ' ').trim();
    
    // Build metadata sections
    const header = `${emoji} BigQuery ${note.type} (${date}):\n"`;
    const footer = `"\n\nDetails: ${link}\n#BigQuery #GoogleCloud`;
    
    // Compute remaining characters (limit 280)
    const availableSpace = 280 - header.length - footer.length;
    
    if (descriptionText.length > availableSpace) {
        descriptionText = descriptionText.substring(0, availableSpace - 3) + '...';
    }
    
    return `${header}${descriptionText}${footer}`;
}

// Update character counter and the SVG progress circle
function updateTweetCharacterCount() {
    const text = elements.tweetTextarea.value;
    const remaining = 280 - text.length;
    
    elements.charCount.textContent = remaining;
    
    // Style adjustments based on characters remaining
    const counterParent = elements.charCount.parentElement;
    counterParent.classList.toggle('warning', remaining <= 30 && remaining > 0);
    counterParent.classList.toggle('danger', remaining <= 0);
    
    elements.btnTweetIntent.disabled = text.length === 0 || remaining < 0;
    
    // Update progress circle offset
    if (ringCircle) {
        const percentage = Math.max(0, Math.min(100, (text.length / 280) * 100));
        const offset = ringCircumference - (percentage / 100) * ringCircumference;
        ringCircle.style.strokeDashoffset = offset;
        
        // Progress ring color
        if (remaining <= 0) {
            ringCircle.style.stroke = 'var(--color-issue)';
        } else if (remaining <= 30) {
            ringCircle.style.stroke = 'var(--color-announcement)';
        } else {
            ringCircle.style.stroke = 'var(--color-change)';
        }
    }
}

// Copy draft tweet to clipboard
async function copyTweetToClipboard() {
    const tweetText = elements.tweetTextarea.value;
    if (!tweetText) return;
    
    try {
        await navigator.clipboard.writeText(tweetText);
        showToast('Tweet copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy text:', err);
        showToast('Failed to copy to clipboard', true);
    }
}

// Launch Twitter/X Web Intent to post the tweet
function postTweet() {
    const tweetText = elements.tweetTextarea.value;
    if (!tweetText) return;
    
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(url, '_blank', 'width=550,height=420,toolbar=no,menubar=no,scrollbars=yes');
}

// Display Toast notifications helper
let toastTimeout;
function showToast(message, isError = false) {
    clearTimeout(toastTimeout);
    
    elements.toastMessage.textContent = message;
    elements.toast.style.borderColor = isError ? 'var(--color-issue)' : 'var(--border-active)';
    elements.toast.classList.add('active');
    
    toastTimeout = setTimeout(() => {
        elements.toast.classList.remove('active');
    }, 3500);
}
