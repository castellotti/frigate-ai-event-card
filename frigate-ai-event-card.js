(() => {
  const VERSION = '1.0.0';
  const TAG = 'frigate-ai-event-card';
  const THUMB_OVERHEAD = 8; // 2px margin + 2px border, each side
  const SPINNER_HTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
      <path d="M12 2 a10 10 0 0 1 10 10" stroke-opacity="1"/>
    </svg>
    Loading clip&hellip;`;

  console.info(
    `%c FRIGATE-AI-EVENT-CARD %c v${VERSION} `,
    'color: white; background: #03a9f4; font-weight: 700;',
    'color: #03a9f4; background: white; font-weight: 700;'
  );

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: TAG,
    name: 'Frigate AI Event Card',
    description: 'Filmstrip of recent Frigate events with AI-generated descriptions and clip playback.',
    preview: false,
    documentationURL: 'https://github.com/castellotti/frigate-ai-event-card',
  });

  class FrigateAiEventCard extends HTMLElement {
    constructor() {
      super();
      this._shadow = this.attachShadow({ mode: 'open' });
      this._lastIds = '';
      this._lastState = null;
      this._lastSlotCount = 0;
      this._built = false;
      this._hlsInstance = null;
      this._resizeObserver = null;
      this._thumbAspect = 16 / 9;
      this._thumbAspectKnown = false;
      this._evts = [];
      this._windowSecs = Infinity;
    }

    setConfig(config) {
      const entity = config.entity || config.sensor;
      if (!entity) throw new Error(`${TAG}: entity is required`);

      const tw = config.time_window !== undefined ? String(config.time_window) : 'all';
      if (!/^(all|24h|7d|30d|\d+[mhd])$/.test(tw)) {
        throw new Error(`${TAG}: invalid time_window "${tw}"`);
      }

      const rawLimit = config.limit !== undefined ? config.limit : 'auto';
      if (rawLimit !== 'auto') {
        const n = Number(rawLimit);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`${TAG}: limit must be "auto" or a positive integer`);
        }
      }

      const thumbH = config.thumbnail_height !== undefined ? Number(config.thumbnail_height) : 80;
      if (!Number.isInteger(thumbH) || thumbH < 1) {
        throw new Error(`${TAG}: thumbnail_height must be a positive integer`);
      }

      this._config = {
        entity,
        title: config.title || null,
        limit: rawLimit === 'auto' ? 'auto' : Number(rawLimit),
        scrollable: config.scrollable === true,
        thumbnail_height: thumbH,
        time_window: tw,
        filter_no_description: config.filter_no_description !== false,
        show_metadata: config.show_metadata !== false,
        frigate_slug: config.frigate_slug || null,
        clip_button_text: config.clip_button_text || '▶ Watch clip',
        provider_label: config.provider_label || null,
      };

      this._windowSecs = this._parseWindowSecs(tw);

      if (!this._built) this._build();
    }

    _parseWindowSecs(tw) {
      if (tw === 'all') return Infinity;
      const m = tw.match(/^(\d+)([mhd])$/);
      if (!m) return Infinity;
      return Number(m[1]) * { m: 60, h: 3600, d: 86400 }[m[2]];
    }

    _formatLabel(e) {
      let label = (e.label || '').replace(/^\w/, c => c.toUpperCase());
      if (e.sub_label) label += ' · ' + e.sub_label;
      if (e.plate)     label += ' · ' + e.plate;
      return label;
    }

    _build() {
      this._built = true;
      const cfg = this._config;
      const thumbH = cfg.thumbnail_height;

      this._shadow.innerHTML = `
        <style>
          :host { display: block; }
          ha-card { padding: 12px 16px 12px; box-sizing: border-box; }
          h3 {
            margin: 0 0 8px;
            font-size: 14px;
            font-weight: 500;
            color: var(--primary-text-color);
          }
          .filmstrip { padding: 2px 0 4px; }
          .filmstrip-scroll { white-space: nowrap; overflow-x: auto; }
          .thumb {
            height: ${thumbH}px;
            border-radius: 6px;
            margin: 2px;
            border: 2px solid var(--divider-color, #444);
            cursor: pointer;
            transition: border-color 0.15s, transform 0.1s;
            vertical-align: top;
          }
          .thumb:hover {
            border-color: var(--primary-color, #03a9f4);
            transform: scale(1.04);
          }
          .empty { color: var(--secondary-text-color); font-size: 13px; padding: 6px 0; display: block; }
          .provider-label { font-size: 11px; color: var(--secondary-text-color); opacity: 0.7; margin-top: 2px; }
          .no-desc { font-style: italic; color: #999; font-size: 13px; }

          dialog {
            border: 1px solid #3a3a3a; border-radius: 14px; padding: 0;
            background: #1c1c1e; color: #e0e0e0;
            box-shadow: 0 24px 80px rgba(0,0,0,0.85); overflow: hidden;
          }
          dialog[open] { display: flex; flex-direction: column; }
          dialog::backdrop { background: rgba(0,0,0,0.82); }
          .dlg-header {
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px; padding: 11px 14px 10px;
            border-bottom: 1px solid #2e2e2e; flex-shrink: 0;
          }
          .dlg-title {
            font-size: 12px; font-weight: 500; color: #777;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            flex: 1; min-width: 0;
          }
          .dlg-cam { font-size: 12px; color: #555; white-space: nowrap; flex-shrink: 0; }
          .dlg-close {
            background: none; border: none; color: #555; font-size: 20px;
            cursor: pointer; padding: 0; line-height: 1; flex-shrink: 0;
          }
          .dlg-close:hover { color: #bbb; }
          #dlg { width: min(860px, 94vw); max-height: 92vh; }
          #dlg-img-wrap {
            background: #000; flex-shrink: 0; position: relative;
            display: flex; align-items: center; justify-content: center;
          }
          #dlg-img { display: block; width: 100%; max-height: 62vh; object-fit: contain; }
          #dlg-img.clickable { cursor: pointer; }
          .play-hint {
            display: none; position: absolute; inset: 0;
            align-items: center; justify-content: center;
            pointer-events: none; background: rgba(0,0,0,0.28);
          }
          #dlg-img-wrap.has-clip:hover .play-hint { display: flex; }
          .play-hint-circle {
            width: 72px; height: 72px; border-radius: 50%;
            background: rgba(0,0,0,0.55); border: 3px solid rgba(255,255,255,0.85);
            display: flex; align-items: center; justify-content: center;
          }
          .play-hint-circle svg { width: 30px; height: 30px; fill: white; margin-left: 4px; }
          #dlg-body { overflow-y: auto; padding: 18px 20px 20px; flex: 1; min-height: 60px; }
          .dlg-md { font-size: 15px; line-height: 1.75; margin-bottom: 14px; color: #f0f0f0; }
          .dlg-sep { border: none; border-top: 1px solid #2e2e2e; margin: 0 0 12px; }
          .dlg-meta { font-size: 13px; color: #777; line-height: 1.7; }
          .dlg-meta strong { color: #bbb; }
          .dlg-meta em { color: #666; }
          #dlg-vid { width: min(1100px, 96vw); background: #000; }
          #dlg-vid-el { display: block; width: 100%; max-height: 84vh; background: #000; flex-shrink: 0; }
          .vid-loading {
            display: flex; align-items: center; justify-content: center;
            padding: 48px 24px; color: #777; font-size: 14px; gap: 10px; flex-shrink: 0;
          }
          .vid-loading svg { width: 22px; height: 22px; animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>

        <ha-card>
          ${cfg.title ? `<h3>${this._esc(cfg.title)}</h3>` : ''}
          <div class="filmstrip${cfg.scrollable ? ' filmstrip-scroll' : ''}" id="filmstrip"></div>
          ${cfg.provider_label ? `<div class="provider-label">${this._esc(cfg.provider_label)}</div>` : ''}
        </ha-card>

        <dialog id="dlg">
          <div class="dlg-header">
            <span class="dlg-title" id="dlg-title"></span>
            <span class="dlg-cam" id="dlg-cam"></span>
            <button class="dlg-close" id="dlg-close">&#x2715;</button>
          </div>
          <div id="dlg-img-wrap">
            <img id="dlg-img" src="" alt="">
            <div class="play-hint">
              <div class="play-hint-circle">
                <svg viewBox="0 0 24 24"><polygon points="6,3 21,12 6,21"/></svg>
              </div>
            </div>
          </div>
          <div id="dlg-body">
            <div class="dlg-md" id="dlg-md"></div>
            <hr class="dlg-sep" id="dlg-sep">
            <div class="dlg-meta" id="dlg-meta"></div>
          </div>
        </dialog>

        <dialog id="dlg-vid">
          <div class="dlg-header">
            <span class="dlg-title" id="dlg-vid-title"></span>
            <button class="dlg-close" id="dlg-vid-close">&#x2715;</button>
          </div>
          <div class="vid-loading" id="dlg-vid-loading">${SPINNER_HTML}</div>
          <video id="dlg-vid-el" controls playsinline style="display:none"></video>
        </dialog>
      `;

      this._filmstrip    = this._shadow.getElementById('filmstrip');
      this._dlgImgWrap   = this._shadow.getElementById('dlg-img-wrap');

      this._dlg      = this._shadow.getElementById('dlg');
      this._dlgImg   = this._shadow.getElementById('dlg-img');
      this._dlgTitle = this._shadow.getElementById('dlg-title');
      this._dlgCam   = this._shadow.getElementById('dlg-cam');
      this._dlgMd    = this._shadow.getElementById('dlg-md');
      this._dlgSep   = this._shadow.getElementById('dlg-sep');
      this._dlgMeta  = this._shadow.getElementById('dlg-meta');
      this._dlgBody  = this._shadow.getElementById('dlg-body');

      this._dlgVid        = this._shadow.getElementById('dlg-vid');
      this._dlgVidEl      = this._shadow.getElementById('dlg-vid-el');
      this._dlgVidTitle   = this._shadow.getElementById('dlg-vid-title');
      this._dlgVidLoading = this._shadow.getElementById('dlg-vid-loading');

      this._shadow.getElementById('dlg-close')
        .addEventListener('click', () => this._dlg.close());
      this._dlg.addEventListener('click', ev => {
        const r = this._dlg.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right ||
            ev.clientY < r.top  || ev.clientY > r.bottom) this._dlg.close();
      });

      const closeVid = () => {
        this._dlgVidEl.pause();
        this._dlgVidEl.src = '';
        this._dlgVidEl.style.display = 'none';
        this._dlgVidLoading.style.display = '';
        this._dlgVidLoading.innerHTML = SPINNER_HTML;
        if (this._hlsInstance) {
          this._hlsInstance.destroy();
          this._hlsInstance = null;
        }
        this._dlgVid.close();
      };
      this._closeVid = closeVid;
      this._shadow.getElementById('dlg-vid-close').addEventListener('click', closeVid);
      this._dlgVid.addEventListener('click', ev => {
        const r = this._dlgVid.getBoundingClientRect();
        if (ev.clientX < r.left || ev.clientX > r.right ||
            ev.clientY < r.top  || ev.clientY > r.bottom) closeVid();
      });

      if (cfg.limit === 'auto' && !cfg.scrollable) {
        let resizeTimer;
        this._resizeObserver = new ResizeObserver(() => {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => this._renderFilmstrip(), 100);
        });
        this._resizeObserver.observe(this._filmstrip);
      }
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    _update() {
      if (!this._hass || !this._config || !this._built) return;
      const cfg = this._config;
      const state = this._hass.states[cfg.entity];
      const fs = this._filmstrip;

      if (!state || state.state === 'unavailable' || state.state === 'unknown') {
        fs.innerHTML = '<span class="empty">⚠️ Sensor unavailable</span>';
        this._lastState = null;
        return;
      }

      if (state === this._lastState) return;
      this._lastState = state;

      let evts = (state.attributes.events || [])
        .slice()
        .sort((a, b) => b.start_time - a.start_time);

      if (this._windowSecs !== Infinity) {
        const cutoff = Date.now() / 1000 - this._windowSecs;
        evts = evts.filter(e => e.start_time >= cutoff);
      }

      if (cfg.filter_no_description) {
        evts = evts.filter(e => e.description);
      }

      const ids = evts.map(e => e.id).join(',');
      if (ids === this._lastIds) return;
      this._lastIds = ids;

      if (evts.length === 0) {
        fs.innerHTML = '<span class="empty">No AI descriptions yet.</span>';
        return;
      }

      this._evts = evts;
      this._lastSlotCount = 0;
      this._renderFilmstrip();
    }

    _renderFilmstrip() {
      const evts = this._evts;
      const cfg = this._config;
      const fs = this._filmstrip;

      let displayEvts;
      let slotCount;
      if (cfg.scrollable) {
        displayEvts = evts;
        slotCount = evts.length;
      } else if (cfg.limit === 'auto') {
        const fsWidth = fs.offsetWidth;
        if (fsWidth === 0) {
          displayEvts = evts;
          slotCount = evts.length;
        } else {
          const thumbW = Math.round(cfg.thumbnail_height * this._thumbAspect);
          slotCount = Math.max(1, Math.floor(fsWidth / (thumbW + THUMB_OVERHEAD)));
          displayEvts = evts.slice(0, slotCount);
        }
      } else {
        slotCount = cfg.limit;
        displayEvts = evts.slice(0, slotCount);
      }

      if (slotCount === this._lastSlotCount && fs.children.length === displayEvts.length) return;
      this._lastSlotCount = slotCount;

      fs.innerHTML = '';
      displayEvts.forEach((e, i) => {
        const img = document.createElement('img');
        img.className = 'thumb';
        img.src = e.thumbnail_url;
        img.alt = e.label || '';
        img.title = e.label || '';
        img.addEventListener('click', () => this._openImage(e));
        if (i === 0 && !this._thumbAspectKnown) {
          img.addEventListener('load', () => {
            if (img.naturalWidth && img.naturalHeight) {
              this._thumbAspect = img.naturalWidth / img.naturalHeight;
              this._thumbAspectKnown = true;
            }
          });
        }
        fs.appendChild(img);
      });
    }

    _openImage(e) {
      const cfg = this._config;
      const hasClip = !!cfg.frigate_slug;
      const label = this._formatLabel(e);
      const date = new Date(e.start_time * 1000).toLocaleString();

      this._dlgImg.src = e.thumbnail_url;
      this._dlgImg.classList.toggle('clickable', hasClip);
      this._dlgImgWrap.classList.toggle('has-clip', hasClip);
      this._dlgImg.onclick = hasClip ? () => this._openVideo(e) : null;

      this._dlgTitle.textContent = label + ' · ' + date;
      this._dlgCam.textContent = cfg.title || '';

      this._dlgMd.innerHTML = '';
      if (e.description) {
        const md = document.createElement('ha-markdown');
        md.content = e.description;
        this._dlgMd.appendChild(md);
      } else {
        const noDesc = document.createElement('p');
        noDesc.className = 'no-desc';
        noDesc.innerHTML = '<em>No description yet.</em>';
        this._dlgMd.appendChild(noDesc);
      }

      if (cfg.show_metadata) {
        let metaHtml = '<strong>' + this._esc(label) + '</strong><br>' + this._esc(date);
        if (e.zones && e.zones.length)
          metaHtml += '<br><em>' + this._esc(e.zones.join(', ')) + '</em>';
        this._dlgMeta.innerHTML = metaHtml;
        this._dlgSep.style.display = '';
        this._dlgMeta.style.display = '';
      } else {
        this._dlgMeta.innerHTML = '';
        this._dlgSep.style.display = 'none';
        this._dlgMeta.style.display = 'none';
      }

      this._dlgBody.scrollTop = 0;
      this._dlg.showModal();
    }

    async _openVideo(e) {
      const cfg = this._config;
      const label = this._formatLabel(e);
      const date = new Date(e.start_time * 1000).toLocaleString();
      this._dlgVidTitle.textContent = label + ' · ' + date + (cfg.title ? ' · ' + cfg.title : '');

      this._dlgVidEl.pause();
      this._dlgVidEl.src = '';
      this._dlgVidEl.style.display = 'none';
      this._dlgVidLoading.style.display = '';
      if (this._hlsInstance) { this._hlsInstance.destroy(); this._hlsInstance = null; }
      this._dlgVid.showModal();

      try {
        const slug = cfg.frigate_slug;
        const start = Math.floor(e.start_time);
        const end = Math.floor(e.end_time || (e.start_time + 60));
        const vodPath = `/api/frigate/${slug}/vod/${e.camera}/start/${start}/end/${end}/index.m3u8`;

        const signed = await this._hass.connection.sendMessagePromise({
          type: 'auth/sign_path',
          path: vodPath,
          expires: 86400,
        });
        const signedUrl = signed.path;
        const authSig = new URLSearchParams(signedUrl.split('?')[1] || '').get('authSig') || '';

        await this._playHls(signedUrl, authSig);
      } catch (err) {
        console.error(`${TAG}: video load failed`, err);
        const msg = err.message || String(err);
        this._dlgVidLoading.innerHTML = '⚠️ ' + this._esc(
          msg.includes('404') ? 'No recording available for this event.' : 'Failed to load clip: ' + msg
        );
      }
    }

    async _playHls(m3u8Url, authSig) {
      const videoEl = this._dlgVidEl;
      const Hls = await this._loadHls();

      if (!Hls.isSupported()) {
        if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
          videoEl.src = m3u8Url;
          this._dlgVidLoading.style.display = 'none';
          videoEl.style.display = '';
          videoEl.play().catch(() => {});
          return;
        }
        throw new Error('HLS.js is not supported in this browser');
      }

      const DefaultLoader = Hls.DefaultConfig.loader;
      class SignedLoader extends DefaultLoader {
        load(context, config, callbacks) {
          if (authSig && !context.url.includes('authSig=')) {
            context.url += (context.url.includes('?') ? '&' : '?') +
              'authSig=' + encodeURIComponent(authSig);
          }
          super.load(context, config, callbacks);
        }
      }

      const hls = new Hls({ enableWorker: false, loader: SignedLoader });
      this._hlsInstance = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(videoEl);

      await new Promise((resolve, reject) => {
        hls.once(Hls.Events.MANIFEST_PARSED, () => {
          this._dlgVidLoading.style.display = 'none';
          videoEl.style.display = '';
          videoEl.play().catch(() => {});
          resolve();
        });
        hls.once(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) reject(new Error(data.details || 'HLS error'));
        });
      });
    }

    _loadHls() {
      if (window.Hls) return Promise.resolve(window.Hls);
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.6.16/dist/hls.min.js';
        s.onload = () => resolve(window.Hls);
        s.onerror = () => reject(new Error('Failed to load hls.js'));
        document.head.appendChild(s);
      });
    }

    _esc(str) {
      return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    disconnectedCallback() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      if (this._closeVid) this._closeVid();
    }

    getCardSize() { return 3; }

    static getStubConfig() {
      return { entity: 'sensor.frigate_camera_events', title: 'Camera' };
    }
  }

  if (!customElements.get(TAG)) {
    customElements.define(TAG, FrigateAiEventCard);
  }
})();
