// aJ Chat Application - Full Featured Version
const App = {
  // State
  ws: null,
  me: null,
  partner: null,
  messages: [],
  typing: false,
  typingTimeout: null,
  lastTypingSent: 0,
  settings: {
    theme: 'dark',
    bubbleStyle: 'modern',
    fontSize: 'medium',
    sound: true,
    notifSound: 'soft',
    vibration: true,
    readReceipts: true,
    typingIndicator: true,
    enterSend: true,
    anniversary: null,
    partnerNames: { J: 'Jeshwanth', a: 'Aishwarya' }
  },

  // Emoji list
  emojis: ['❤️','💕','💗','💓','💝','💘','💖','😘','🥰','😍','😊','😂','🤣','😭','😢','😅','😆','😁','😄','😃','🙂','🥺','😔','😞','😩','😫','🥱','😴','😪','😋','😛','😜','🤪','😝','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😷','🤒','🤕','🤢','🤮','🥴','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','👍','👎','👌','✌️','🤞','🤟','🤘','🤙','👋','🖐️','✋','🙌','👏','🤝','🙏','💪','🔥','✨','⭐','🌟','💫','🎉','🎊','🎁','🎂','🍕','🍔','🍟','🌹','🌸','💐','🌺','🌻','🌼','🏠','❄️','☀️','🌙','⛅','🌈','☔','💧','🎵','🎶','📸','📱','💻','⏰','❓','❗','💯','✅','❌','⭕','🔴','🟢','🔵','⚪','⚫'],

  // Initialize app
  init() {
    this.loadSettings();
    this.applySettings();
    this.populateEmojiGrid();
    this.checkSavedUser();
    this.setupEventListeners();
  },

  // Setup event listeners
  setupEventListeners() {
    // Auto-resize textarea
    const input = document.getElementById('messageInput');
    if (input) {
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    // Close modals on escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });

    // Visibility change for read receipts
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.sendReadReceipt();
      }
    });
  },

  // Load settings from localStorage
  loadSettings() {
    const saved = localStorage.getItem('aj_settings');
    if (saved) {
      try {
        this.settings = { ...this.settings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  },

  // Save settings to localStorage
  saveSettings() {
    localStorage.setItem('aj_settings', JSON.stringify(this.settings));
  },

  // Apply settings to UI
  applySettings() {
    document.documentElement.setAttribute('data-theme', this.settings.theme);
    document.documentElement.setAttribute('data-bubble', this.settings.bubbleStyle);
    document.documentElement.setAttribute('data-font', this.settings.fontSize);

    // Update setting controls
    const themeSel = document.getElementById('themeSetting');
    const bubbleSel = document.getElementById('bubbleStyle');
    const fontSel = document.getElementById('fontSizeSetting');
    const soundChk = document.getElementById('soundSetting');
    const notifSel = document.getElementById('notifSoundSetting');
    const vibrateChk = document.getElementById('vibrateSetting');
    const readChk = document.getElementById('readReceiptsSetting');
    const typingChk = document.getElementById('typingIndicatorSetting');
    const enterChk = document.getElementById('enterSendSetting');
    const anniInput = document.getElementById('anniversaryDate');
    const partnerInput = document.getElementById('partnerDisplayName');

    if (themeSel) themeSel.value = this.settings.theme;
    if (bubbleSel) bubbleSel.value = this.settings.bubbleStyle;
    if (fontSel) fontSel.value = this.settings.fontSize;
    if (soundChk) soundChk.checked = this.settings.sound;
    if (notifSel) notifSel.value = this.settings.notifSound;
    if (vibrateChk) vibrateChk.checked = this.settings.vibration;
    if (readChk) readChk.checked = this.settings.readReceipts;
    if (typingChk) typingChk.checked = this.settings.typingIndicator;
    if (enterChk) enterChk.checked = this.settings.enterSend;
    if (anniInput && this.settings.anniversary) anniInput.value = this.settings.anniversary;
    if (partnerInput && this.partner) {
      partnerInput.value = this.settings.partnerNames[this.partner] || '';
    }

    this.updateAnniversaryCard();
  },

  // Check for saved user
  checkSavedUser() {
    const saved = localStorage.getItem('aj_user');
    if (saved === 'J' || saved === 'a') {
      this.setUser(saved);
    }
  },

  // Set current user and login
  setUser(id) {
    this.me = id;
    this.partner = id === 'J' ? 'a' : 'J';
    localStorage.setItem('aj_user', id);

    // Update UI
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');

    // Update header
    document.getElementById('partnerAvatar').textContent = this.partner;
    document.getElementById('partnerName').textContent = this.settings.partnerNames[this.partner] || this.partner;
    document.getElementById('typingAvatar').textContent = this.partner;

    // Update partner name input
    const partnerInput = document.getElementById('partnerDisplayName');
    if (partnerInput) {
      partnerInput.value = this.settings.partnerNames[this.partner] || '';
    }

    // Connect to WebSocket
    this.connect();
  },

  // Logout
  logout() {
    if (this.ws) {
      this.ws.close();
    }
    localStorage.removeItem('aj_user');
    this.me = null;
    this.partner = null;
    this.messages = [];
    document.getElementById('messages').innerHTML = '<div class="date-divider"><span>Today</span></div>';
    document.getElementById('chatScreen').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
  },

  // Connect to WebSocket
  connect() {
    const wsUrl = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    const statusEl = document.getElementById('partnerStatusText');
    const statusDot = document.querySelector('.status-dot');

    statusEl.textContent = 'Connecting...';
    statusDot.classList.remove('online');

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      statusEl.textContent = 'Online';
      statusDot.classList.add('online');
      this.ws.send(JSON.stringify({ type: 'hello', user: this.me }));
    };

    this.ws.onclose = () => {
      statusEl.textContent = 'Reconnecting...';
      statusDot.classList.remove('online');
      setTimeout(() => this.connect(), 2000);
    };

    this.ws.onerror = () => {
      statusEl.textContent = 'Connection error';
      statusDot.classList.remove('online');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleMessage(data);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  },

  // Handle incoming messages
  handleMessage(data) {
    switch (data.type) {
      case 'chat':
        this.addMessage(data);
        if (data.user !== this.me) {
          this.playNotificationSound();
          this.vibrate();
          this.sendReadReceipt();
        }
        break;
      case 'typing':
        if (data.user !== this.me && this.settings.typingIndicator) {
          this.showTypingIndicator(data.typing);
        }
        break;
      case 'read':
        if (data.user !== this.me) {
          this.markMessagesAsRead();
        }
        break;
      case 'presence':
        this.updatePartnerStatus(data.online, data.mood);
        break;
      case 'history':
        this.loadHistory(data.messages);
        break;
      case 'reaction':
        this.updateReaction(data);
        break;
      case 'delete':
        this.removeMessage(data.id);
        break;
      case 'notes':
        this.updateSharedNotes(data.content);
        break;
      case 'calendar':
        this.renderCalendarEvents(data.events);
        break;
      case 'wishlist':
        this.renderWishlistItems(data.items);
        break;
      case 'countdowns':
        this.renderCountdowns(data.countdowns);
        break;
    }
  },

  // Add message to chat
  addMessage(data) {
    const isMe = data.user === this.me;
    const container = document.getElementById('messages');

    const msgEl = document.createElement('div');
    msgEl.className = `message ${isMe ? 'me' : 'them'}`;
    msgEl.dataset.id = data.id || Date.now();

    let content = '';

    // Handle media
    if (data.media) {
      if (data.media.type.startsWith('image/')) {
        content = `<div class="msg-media" onclick="App.openImage('${data.media.data}')">
          <img src="${data.media.data}" alt="Shared image" loading="lazy" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22150%22><rect fill=%22%232d2d4a%22 width=%22200%22 height=%22150%22/><text fill=%22%23888%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22>📷 Image</text></svg>';">
        </div>`;
      } else if (data.media.type.startsWith('video/')) {
        content = `<div class="msg-media">
          <video src="${data.media.data}" controls></video>
        </div>`;
      } else if (data.media.type.startsWith('audio/')) {
        content = `<div class="msg-audio">
          <audio src="${data.media.data}" controls></audio>
        </div>`;
      }
    }

    // Handle text
    if (data.text) {
      content += `<div class="msg-bubble">${this.escapeHtml(data.text)}</div>`;
    }

    // Meta info
    const time = new Date(data.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let metaHtml = `<span>${time}</span>`;

    if (isMe && this.settings.readReceipts) {
      metaHtml += `<span class="msg-status ${data.read ? 'read' : ''}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
      </span>`;
    }

    msgEl.innerHTML = `
      ${content}
      <div class="msg-meta">${metaHtml}</div>
      <div class="msg-reactions" id="reactions-${msgEl.dataset.id}"></div>
    `;

    // Add context menu
    msgEl.addEventListener('contextmenu', (e) => this.showContextMenu(e, msgEl.dataset.id, isMe));
    msgEl.addEventListener('dblclick', () => this.quickReact(msgEl.dataset.id));

    container.appendChild(msgEl);
    this.scrollToBottom();

    // Store message
    this.messages.push(data);

    // Update gallery if image
    if (data.media && data.media.type.startsWith('image/')) {
      this.addToGallery(data.media.data);
    }
  },

  // Load message history
  loadHistory(messages) {
    const container = document.getElementById('messages');
    container.innerHTML = '<div class="date-divider"><span>Today</span></div>';
    this.messages = [];

    // Clear gallery before rebuilding from history
    const galleryGrid = document.getElementById('galleryGrid');
    if (galleryGrid) {
      galleryGrid.innerHTML = '<p class="gallery-empty">Photos shared in chat will appear here 💕</p>';
    }

    if (messages && messages.length) {
      messages.forEach(msg => this.addMessage(msg));
    }
  },

  // Send message
  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();

    if (!text || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      type: 'chat',
      user: this.me,
      text: text,
      time: Date.now(),
      id: `${this.me}-${Date.now()}`
    };

    this.ws.send(JSON.stringify(msg));
    input.value = '';
    input.style.height = 'auto';

    // Stop typing indicator
    this.sendTypingStatus(false);
  },

  // Send media
  sendMedia(mediaData) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const msg = {
      type: 'chat',
      user: this.me,
      media: mediaData,
      time: Date.now(),
      id: `${this.me}-${Date.now()}`
    };

    this.ws.send(JSON.stringify(msg));
  },

  // Handle key down in input
  handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && this.settings.enterSend) {
      event.preventDefault();
      this.sendMessage();
    }
  },

  // Handle input for typing indicator
  handleInput() {
    const now = Date.now();
    if (now - this.lastTypingSent > 1000) {
      this.sendTypingStatus(true);
      this.lastTypingSent = now;
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.sendTypingStatus(false);
    }, 2000);
  },

  // Send typing status
  sendTypingStatus(isTyping) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.settings.typingIndicator) return;

    this.ws.send(JSON.stringify({
      type: 'typing',
      user: this.me,
      typing: isTyping
    }));
  },

  // Show/hide typing indicator
  showTypingIndicator(show) {
    const indicator = document.getElementById('typingIndicator');
    if (show) {
      indicator.classList.remove('hidden');
      this.scrollToBottom();
    } else {
      indicator.classList.add('hidden');
    }
  },

  // Send read receipt
  sendReadReceipt() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (!this.settings.readReceipts) return;

    this.ws.send(JSON.stringify({
      type: 'read',
      user: this.me
    }));
  },

  // Mark messages as read
  markMessagesAsRead() {
    document.querySelectorAll('.message.me .msg-status').forEach(el => {
      el.classList.add('read');
    });
  },

  // Update partner status
  updatePartnerStatus(online, mood) {
    const statusEl = document.getElementById('partnerStatusText');
    const statusDot = document.querySelector('.status-dot');

    if (online) {
      statusDot.classList.add('online');
      statusEl.textContent = mood ? mood : 'Online';
    } else {
      statusDot.classList.remove('online');
      statusEl.textContent = 'Offline';
    }
  },

  // Scroll to bottom of messages
  scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    container.scrollTop = container.scrollHeight;
  },

  // Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Open media picker
  openMediaPicker() {
    document.getElementById('fileInput').click();
  },

  // Handle file selection
  handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) return;

    Array.from(files).forEach(file => {
      if (file.size > 10 * 1024 * 1024) {
        this.showToast('File too large (max 10MB)');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        this.sendMedia({
          type: file.type,
          name: file.name,
          data: e.target.result
        });
      };
      reader.readAsDataURL(file);
    });

    event.target.value = '';
  },

  // Open image in viewer
  openImage(src) {
    const viewer = document.getElementById('imageViewer');
    const img = document.getElementById('viewerImage');
    img.src = src;
    viewer.classList.remove('hidden');
  },

  // Close image viewer
  closeImageViewer() {
    document.getElementById('imageViewer').classList.add('hidden');
  },

  // Toggle emoji picker
  toggleEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    picker.classList.toggle('hidden');
  },

  // Close emoji picker
  closeEmojiPicker() {
    document.getElementById('emojiPicker').classList.add('hidden');
  },

  // Populate emoji grid
  populateEmojiGrid() {
    const grid = document.getElementById('emojiGrid');
    if (!grid) return;

    grid.innerHTML = this.emojis.map(emoji =>
      `<button class="emoji-btn" onclick="App.insertEmoji('${emoji}')">${emoji}</button>`
    ).join('');
  },

  // Insert emoji into input
  insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    input.value += emoji;
    input.focus();
    this.closeEmojiPicker();
  },

  // Quick react with heart
  quickReact(msgId) {
    this.addReaction(msgId, '❤️');
  },

  // Add reaction to message
  addReaction(msgId, emoji) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'reaction',
      id: msgId,
      user: this.me,
      emoji: emoji
    }));
  },

  // Update reaction display
  updateReaction(data) {
    const container = document.getElementById(`reactions-${data.id}`);
    if (!container) return;

    // Simple reaction display
    let existing = container.querySelector(`.reaction[data-emoji="${data.emoji}"]`);
    if (existing) {
      const count = existing.querySelector('.reaction-count');
      count.textContent = parseInt(count.textContent) + 1;
    } else {
      const btn = document.createElement('button');
      btn.className = 'reaction';
      btn.dataset.emoji = data.emoji;
      btn.innerHTML = `${data.emoji}<span class="reaction-count">1</span>`;
      btn.onclick = () => this.addReaction(data.id, data.emoji);
      container.appendChild(btn);
    }
  },

  // Show context menu
  showContextMenu(event, msgId, isMe) {
    event.preventDefault();
    // Simple implementation - could be enhanced with a proper popup
    const actions = [];

    if (isMe) {
      actions.push('Delete');
    }
    actions.push('React ❤️', 'React 😂', 'React 👍');

    const choice = actions[0]; // For now, just show delete option
    if (choice === 'Delete' && isMe && confirm('Delete this message?')) {
      this.deleteMessage(msgId);
    }
  },

  // Delete message
  deleteMessage(msgId) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'delete',
      id: msgId,
      user: this.me
    }));
  },

  // Remove message from UI
  removeMessage(msgId) {
    const msg = document.querySelector(`.message[data-id="${msgId}"]`);
    if (msg) {
      msg.remove();
    }
    this.messages = this.messages.filter(m => m.id !== msgId);
  },

  // Add to gallery
  addToGallery(src) {
    const grid = document.getElementById('galleryGrid');
    const empty = grid.querySelector('.gallery-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.innerHTML = `<img src="${src}" alt="Shared photo" onclick="App.openImage('${src}')">`;
    grid.appendChild(item);
  },

  // Play notification sound
  playNotificationSound() {
    if (!this.settings.sound) return;

    try {
      const sounds = {
        soft: [523.25, 659.25, 783.99],
        pop: [800],
        ding: [1000, 1200],
        heart: [440, 554.37, 659.25]
      };

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const frequencies = sounds[this.settings.notifSound] || sounds.soft;

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.1 + 0.3);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.3);
      });
    } catch (e) {
      // Audio not available
    }
  },

  // Vibrate
  vibrate() {
    if (!this.settings.vibration) return;
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }
  },

  // Show toast notification
  showToast(message) {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toastMessage');
    msgEl.textContent = message;
    toast.classList.remove('hidden');

    setTimeout(() => {
      toast.classList.add('hidden');
    }, 3000);
  },

  // Close all modals
  closeAllModals() {
    document.querySelectorAll('.modal, .features-panel, .emoji-picker, .image-viewer').forEach(el => {
      el.classList.add('hidden');
    });
  },

  // Settings functions
  openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
    this.applySettings();
  },

  closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
  },

  changeTheme(theme) {
    this.settings.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this.saveSettings();
  },

  changeBubbleStyle(style) {
    this.settings.bubbleStyle = style;
    document.documentElement.setAttribute('data-bubble', style);
    this.saveSettings();
  },

  changeFontSize(size) {
    this.settings.fontSize = size;
    document.documentElement.setAttribute('data-font', size);
    this.saveSettings();
  },

  toggleSound(enabled) {
    this.settings.sound = enabled;
    this.saveSettings();
  },

  changeNotifSound(sound) {
    this.settings.notifSound = sound;
    this.saveSettings();
    this.playNotificationSound();
  },

  toggleVibration(enabled) {
    this.settings.vibration = enabled;
    this.saveSettings();
  },

  toggleReadReceipts(enabled) {
    this.settings.readReceipts = enabled;
    this.saveSettings();
  },

  toggleTypingIndicator(enabled) {
    this.settings.typingIndicator = enabled;
    this.saveSettings();
  },

  toggleEnterSend(enabled) {
    this.settings.enterSend = enabled;
    this.saveSettings();
  },

  setAnniversary(date) {
    this.settings.anniversary = date;
    this.saveSettings();
    this.updateAnniversaryCard();
  },

  setPartnerName(name) {
    if (this.partner) {
      this.settings.partnerNames[this.partner] = name || this.partner;
      document.getElementById('partnerName').textContent = name || this.partner;
      this.saveSettings();
    }
  },

  updateAnniversaryCard() {
    const card = document.getElementById('anniversaryCard');
    const daysEl = document.getElementById('anniDays');

    if (this.settings.anniversary) {
      const start = new Date(this.settings.anniversary);
      const now = new Date();
      const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));

      card.style.display = 'flex';
      daysEl.textContent = `${days} days`;
    } else {
      card.style.display = 'none';
    }
  },

  clearAllMessages() {
    if (!confirm('Are you sure you want to clear all messages? This cannot be undone.')) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'clear' }));
    }

    this.messages = [];
    document.getElementById('messages').innerHTML = '<div class="date-divider"><span>Today</span></div>';
    document.getElementById('galleryGrid').innerHTML = '<p class="gallery-empty">Photos shared in chat will appear here 💕</p>';
    this.showToast('Chat cleared');
    this.closeSettings();
  },

  // Features panel
  toggleFeatures() {
    document.getElementById('featuresPanel').classList.toggle('hidden');
  },

  showPartnerProfile() {
    this.showToast(`💕 ${this.settings.partnerNames[this.partner] || this.partner}`);
  },

  // Shared Notes
  openSharedNotes() {
    document.getElementById('notesModal').classList.remove('hidden');
    this.toggleFeatures();

    // Request notes from server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'getNotes' }));
    }
  },

  closeSharedNotes() {
    document.getElementById('notesModal').classList.add('hidden');
  },

  saveNotes() {
    const content = document.getElementById('sharedNotes').value;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'notes',
        content: content
      }));
    }
  },

  updateSharedNotes(content) {
    const textarea = document.getElementById('sharedNotes');
    if (textarea && document.activeElement !== textarea) {
      textarea.value = content || '';
    }
  },

  // Mood
  openMoodBoard() {
    document.getElementById('moodModal').classList.remove('hidden');
    this.toggleFeatures();
  },

  closeMoodBoard() {
    document.getElementById('moodModal').classList.add('hidden');
  },

  setMood(emoji, label) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'mood',
        user: this.me,
        mood: `${emoji} ${label}`
      }));
    }
    this.showToast(`Mood set to ${emoji} ${label}`);
    this.closeMoodBoard();
  },

  // Gallery
  openPhotoGallery() {
    document.getElementById('galleryModal').classList.remove('hidden');
    this.toggleFeatures();
  },

  closePhotoGallery() {
    document.getElementById('galleryModal').classList.add('hidden');
  },

  // ========== CALENDAR ==========
  calendarEvents: [],

  openCalendar() {
    this.showCalendarModal();
    this.toggleFeatures();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'getCalendar' }));
    }
  },

  showCalendarModal() {
    let modal = document.getElementById('calendarModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'calendarModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="App.closeCalendar()"></div>
        <div class="modal-content calendar-modal">
          <div class="modal-header">
            <h2>📅 Our Calendar</h2>
            <button class="btn-close" onclick="App.closeCalendar()">×</button>
          </div>
          <div class="calendar-body">
            <div class="calendar-add">
              <input type="text" id="calendarTitle" placeholder="Event title..." />
              <input type="date" id="calendarDate" />
              <button class="btn-add" onclick="App.addCalendarEvent()">Add</button>
            </div>
            <div class="calendar-events" id="calendarEvents">
              <p class="empty-state">No events yet 💕</p>
            </div>
          </div>
        </div>
      `;
      document.getElementById('app').appendChild(modal);
    }
    modal.classList.remove('hidden');
  },

  closeCalendar() {
    const modal = document.getElementById('calendarModal');
    if (modal) modal.classList.add('hidden');
  },

  addCalendarEvent() {
    const title = document.getElementById('calendarTitle').value.trim();
    const date = document.getElementById('calendarDate').value;
    if (!title || !date) {
      this.showToast('Please fill in title and date');
      return;
    }

    const event = {
      id: `evt-${Date.now()}`,
      title,
      date,
      createdBy: this.me,
      createdAt: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'saveCalendarEvent', event }));
    }

    document.getElementById('calendarTitle').value = '';
    document.getElementById('calendarDate').value = '';
  },

  deleteCalendarEvent(eventId) {
    if (!confirm('Delete this event?')) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deleteCalendarEvent', eventId }));
    }
  },

  renderCalendarEvents(events) {
    this.calendarEvents = events || [];
    const container = document.getElementById('calendarEvents');
    if (!container) return;

    if (!events || events.length === 0) {
      container.innerHTML = '<p class="empty-state">No events yet 💕</p>';
      return;
    }

    container.innerHTML = events.map(e => {
      const dateObj = new Date(e.date);
      const formatted = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      return `
        <div class="calendar-event">
          <div class="event-date">${formatted}</div>
          <div class="event-title">${this.escapeHtml(e.title)}</div>
          <button class="btn-delete" onclick="App.deleteCalendarEvent('${e.id}')">×</button>
        </div>
      `;
    }).join('');
  },

  // ========== WISHLIST ==========
  wishlistItems: [],

  openWishlist() {
    this.showWishlistModal();
    this.toggleFeatures();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'getWishlist' }));
    }
  },

  showWishlistModal() {
    let modal = document.getElementById('wishlistModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'wishlistModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="App.closeWishlist()"></div>
        <div class="modal-content wishlist-modal">
          <div class="modal-header">
            <h2>🎁 Our Wishlist</h2>
            <button class="btn-close" onclick="App.closeWishlist()">×</button>
          </div>
          <div class="wishlist-body">
            <div class="wishlist-add">
              <input type="text" id="wishlistTitle" placeholder="What do you wish for?..." />
              <input type="text" id="wishlistLink" placeholder="Link (optional)" />
              <button class="btn-add" onclick="App.addWishlistItem()">Add</button>
            </div>
            <div class="wishlist-items" id="wishlistItems">
              <p class="empty-state">No wishes yet 💭</p>
            </div>
          </div>
        </div>
      `;
      document.getElementById('app').appendChild(modal);
    }
    modal.classList.remove('hidden');
  },

  closeWishlist() {
    const modal = document.getElementById('wishlistModal');
    if (modal) modal.classList.add('hidden');
  },

  addWishlistItem() {
    const title = document.getElementById('wishlistTitle').value.trim();
    const link = document.getElementById('wishlistLink').value.trim();
    if (!title) {
      this.showToast('Please enter a wish');
      return;
    }

    const item = {
      id: `wish-${Date.now()}`,
      title,
      link: link || undefined,
      addedBy: this.me,
      completed: false,
      createdAt: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'saveWishlistItem', item }));
    }

    document.getElementById('wishlistTitle').value = '';
    document.getElementById('wishlistLink').value = '';
  },

  toggleWishlistItem(itemId) {
    const item = this.wishlistItems.find(i => i.id === itemId);
    if (!item) return;
    item.completed = !item.completed;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'saveWishlistItem', item }));
    }
  },

  deleteWishlistItem(itemId) {
    if (!confirm('Delete this wish?')) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deleteWishlistItem', itemId }));
    }
  },

  renderWishlistItems(items) {
    this.wishlistItems = items || [];
    const container = document.getElementById('wishlistItems');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = '<p class="empty-state">No wishes yet 💭</p>';
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="wishlist-item ${item.completed ? 'completed' : ''}">
        <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="App.toggleWishlistItem('${item.id}')" />
        <div class="wish-content">
          <span class="wish-title">${this.escapeHtml(item.title)}</span>
          ${item.link ? `<a href="${item.link}" target="_blank" class="wish-link">🔗</a>` : ''}
          <span class="wish-by">by ${item.addedBy}</span>
        </div>
        <button class="btn-delete" onclick="App.deleteWishlistItem('${item.id}')">×</button>
      </div>
    `).join('');
  },

  // ========== COUNTDOWN ==========
  countdowns: [],
  countdownInterval: null,

  openCountdown() {
    this.showCountdownModal();
    this.toggleFeatures();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'getCountdowns' }));
    }
  },

  showCountdownModal() {
    let modal = document.getElementById('countdownModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'countdownModal';
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-backdrop" onclick="App.closeCountdown()"></div>
        <div class="modal-content countdown-modal">
          <div class="modal-header">
            <h2>⏰ Our Countdowns</h2>
            <button class="btn-close" onclick="App.closeCountdown()">×</button>
          </div>
          <div class="countdown-body">
            <div class="countdown-add">
              <input type="text" id="countdownTitle" placeholder="What are you counting to?..." />
              <input type="date" id="countdownDate" />
              <select id="countdownEmoji">
                <option value="🎉">🎉</option>
                <option value="💕">💕</option>
                <option value="🎂">🎂</option>
                <option value="✈️">✈️</option>
                <option value="🎁">🎁</option>
                <option value="🏖️">🏖️</option>
                <option value="🎄">🎄</option>
              </select>
              <button class="btn-add" onclick="App.addCountdown()">Add</button>
            </div>
            <div class="countdown-list" id="countdownList">
              <p class="empty-state">No countdowns yet ⏳</p>
            </div>
          </div>
        </div>
      `;
      document.getElementById('app').appendChild(modal);
    }
    modal.classList.remove('hidden');
    this.startCountdownTimer();
  },

  closeCountdown() {
    const modal = document.getElementById('countdownModal');
    if (modal) modal.classList.add('hidden');
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  },

  addCountdown() {
    const title = document.getElementById('countdownTitle').value.trim();
    const targetDate = document.getElementById('countdownDate').value;
    const emoji = document.getElementById('countdownEmoji').value;

    if (!title || !targetDate) {
      this.showToast('Please fill in title and date');
      return;
    }

    const countdown = {
      id: `cd-${Date.now()}`,
      title,
      targetDate,
      emoji,
      createdBy: this.me,
      createdAt: Date.now()
    };

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'saveCountdown', countdown }));
    }

    document.getElementById('countdownTitle').value = '';
    document.getElementById('countdownDate').value = '';
  },

  deleteCountdown(countdownId) {
    if (!confirm('Delete this countdown?')) return;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'deleteCountdown', countdownId }));
    }
  },

  startCountdownTimer() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => this.updateCountdownDisplay(), 1000);
    this.updateCountdownDisplay();
  },

  updateCountdownDisplay() {
    const container = document.getElementById('countdownList');
    if (!container || !this.countdowns.length) return;

    container.innerHTML = this.countdowns.map(cd => {
      const target = new Date(cd.targetDate).getTime();
      const now = Date.now();
      const diff = target - now;

      let timeStr;
      if (diff <= 0) {
        timeStr = "🎉 It's here!";
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timeStr = `${days}d ${hours}h ${mins}m`;
      }

      return `
        <div class="countdown-card">
          <div class="countdown-emoji">${cd.emoji || '⏰'}</div>
          <div class="countdown-info">
            <div class="countdown-title">${this.escapeHtml(cd.title)}</div>
            <div class="countdown-time">${timeStr}</div>
          </div>
          <button class="btn-delete" onclick="App.deleteCountdown('${cd.id}')">×</button>
        </div>
      `;
    }).join('');
  },

  renderCountdowns(countdowns) {
    this.countdowns = countdowns || [];
    const container = document.getElementById('countdownList');
    if (!container) return;

    if (!countdowns || countdowns.length === 0) {
      container.innerHTML = '<p class="empty-state">No countdowns yet ⏳</p>';
      return;
    }
    this.updateCountdownDisplay();
  }
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => App.init());

