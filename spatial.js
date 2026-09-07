/* Shared presentation controls. Both renderers keep their own camera and lighting. */
(() => {
  const isMap = typeof map !== 'undefined';
  const panel = document.createElement('details');
  panel.className = 'spatial-panel';
  panel.open = false;
  panel.innerHTML = `<summary aria-label="Map settings" title="Map settings">⚙ <span>View</span></summary>
    <div class="settings-body"><h2>Map settings</h2>
    <label for="spatial-view">Perspective</label>
    <div data-select="spatial-view"></div>
    <label for="spatial-light">Light</label>
    <div data-select="spatial-light"></div>
    <div class="spatial-actions"><button id="spatial-present" aria-pressed="false">Present</button><button id="spatial-share">Copy view link</button></div>
    <div class="spatial-status" role="status"></div></div>`;
  document.body.appendChild(panel);
  const switcher = document.createElement('nav');
  switcher.className = 'renderer-switch';
  switcher.setAttribute('aria-label', 'Map renderer');
  switcher.innerHTML = `<a href="index.html" ${!isMap ? 'aria-current="page"' : ''}>Three.js</a><a href="v2-maplibre.html" ${isMap ? 'aria-current="page"' : ''}>MapLibre</a>`;
  document.body.appendChild(switcher);
  let selectedPlace = null;
  window.addEventListener('atlas:select', ({detail}) => { selectedPlace = detail.id; });
  switcher.querySelectorAll('a').forEach(link => link.addEventListener('click', e => {
    if (link.hasAttribute('aria-current')) { e.preventDefault(); return; }
    const destination = new URL(link.href);
    destination.searchParams.set('light', panel.querySelector('#spatial-light').value);
    if (selectedPlace !== null) destination.searchParams.set('place', selectedPlace);
    link.href = destination.href;
  }));
  // Move existing controls so their event handlers and tour states stay intact.
  const settings = panel.querySelector('.settings-body');
  const actions = document.getElementById('controls');
  settings.appendChild(actions);
  document.getElementById('btnMaplibre')?.remove();
  document.getElementById('btn3d')?.remove();
  document.getElementById('btnTop')?.remove();
  document.getElementById('btnStory').textContent = 'Story tour';
  document.getElementById('btnTour').textContent = 'Fly tour';
  document.getElementById('btnHome').textContent = 'Reset view';
  actions.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { panel.open = false; }));
  document.body.classList.toggle('maplibre-view', isMap);
  document.querySelector('#sidebar .sub').textContent = 'Discover Mangalore, one place at a time.';
  document.querySelector('#sidebar h1 small')?.remove();
  const filters = document.createElement('details');
  filters.className = 'filter-disclosure';
  filters.innerHTML = '<summary>Categories <span>Filter places</span></summary>';
  const filterList = document.getElementById('filters');
  filterList.before(filters); filters.appendChild(filterList);
  const updateFilters = () => {
    const chips = [...filterList.querySelectorAll('button')];
    const count = chips.filter(chip => chip.classList.contains('active')).length;
    filters.querySelector('summary span').textContent = count === chips.length ? 'All places' : `${count} selected`;
    chips.forEach(chip => chip.setAttribute('aria-pressed', String(chip.classList.contains('active'))));
  };
  filterList.addEventListener('click', updateFilters);
  updateFilters();
  const itinerary = document.createElement('details');
  itinerary.className = 'trip-disclosure';
  itinerary.innerHTML = '<summary>My trip <span class="trip-total">0 places</span></summary>';
  const tripPanel = document.getElementById('trip');
  tripPanel.before(itinerary); itinerary.appendChild(tripPanel);
  const updateTripTotal = () => { itinerary.querySelector('.trip-total').textContent = `${trip.length} ${trip.length === 1 ? 'place' : 'places'}`; };
  new MutationObserver(updateTripTotal).observe(document.getElementById('tripList'), {childList:true,subtree:true});
  document.getElementById('toggle').textContent = '☰';
  document.getElementById('toggle').setAttribute('aria-label', 'Toggle places');
  document.addEventListener('pointerdown', e => { if (!panel.contains(e.target)) panel.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.open = false; });
  if (innerWidth <= 700) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('toggle').classList.add('shifted');
  }
  // A small same-page integration surface for an application's place cards.
  window.MangaloreAtlas = Object.freeze({
    getPlaces: () => LANDMARKS.map((place, id) => ({ id, name: place.name, category: place.cat, lng: place.lng, lat: place.lat })),
    selectPlace(id) {
      if (!Number.isInteger(id) || id < 0 || id >= LANDMARKS.length) return false;
      if (isMap) flyToLandmark(id); else selectLandmark(id, true);
      return true;
    }
  });
  function customSelect(id, choices, initial) {
    const field = panel.querySelector(`[data-select="${id}"]`);
    field.className = 'custom-select';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = id;
    trigger.className = 'select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${id}-options`);
    const list = document.createElement('div');
    list.id = `${id}-options`;
    list.className = 'select-options';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', panel.querySelector(`label[for="${id}"]`).textContent);
    list.hidden = true;
    let value = initial;
    const options = choices.map(([key, text]) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.tabIndex = -1;
      option.setAttribute('role', 'option');
      option.textContent = text;
      option.setAttribute('aria-label', text);
      option.onclick = () => {
        trigger.value = key;
        close(true);
        trigger.dispatchEvent(new Event('change', { bubbles: true }));
      };
      list.appendChild(option);
      return option;
    });
    function close(restoreFocus = false) {
      list.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus();
    }
    function open() {
      if (trigger.disabled) return;
      list.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      options[choices.findIndex(([key]) => key === value)].focus();
    }
    Object.defineProperty(trigger, 'value', {
      get: () => value,
      set(next) {
        const index = choices.findIndex(([key]) => key === next);
        if (index < 0) return;
        value = next;
        trigger.textContent = choices[index][1];
        options.forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
      }
    });
    trigger.value = initial;
    trigger.onclick = () => list.hidden ? open() : close();
    field.append(trigger, list);
    field.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !list.hidden) {
        e.preventDefault(); e.stopPropagation(); close(true); return;
      }
      if (e.key === 'Tab') { if (!list.hidden) close(true); return; }
      const index = options.indexOf(document.activeElement);
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault(); e.stopPropagation();
        if (list.hidden) { open(); return; }
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1
          : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        options[next].focus();
      } else if (e.key.length === 1 && /[a-z]/i.test(e.key) && !e.ctrlKey && !e.metaKey) {
        const match = choices.findIndex(([, text]) => text.toLowerCase().startsWith(e.key.toLowerCase()));
        if (match >= 0) { e.preventDefault(); open(); options[match].focus(); }
      }
    });
    field.addEventListener('focusout', e => { if (!field.contains(e.relatedTarget)) close(); });
    document.addEventListener('pointerdown', e => { if (!field.contains(e.target)) close(); });
    panel.addEventListener('toggle', () => { if (!panel.open) close(); });
    return trigger;
  }
  const view = customSelect('spatial-view', [['oblique', 'City perspective'], ['street', 'Close perspective'], ['top', 'Overhead']], 'oblique');
  const light = customSelect('spatial-light', [['golden', 'Golden hour'], ['day', 'Coastal daylight']], 'golden');
  const present = panel.querySelector('#spatial-present');
  const status = panel.querySelector('.spatial-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  view.onchange = () => {
    stopTour();
    if (typeof storyOn !== 'undefined' && storyOn) exitStory();
    if (isMap) {
      map.easeTo({ pitch: view.value === 'top' ? 0 : view.value === 'street' ? 72 : 62,
        zoom: view.value === 'street' ? Math.max(16, map.getZoom()) : map.getZoom(), duration: motion.matches ? 0 : 1200 });
    } else {
      const target = controls.target.clone();
      const distance = view.value === 'street' ? 1600 : Math.max(2500, camera.position.distanceTo(target));
      const offset = camera.position.clone().sub(target);
      const angle = Math.atan2(offset.x, offset.z);
      const polar = view.value === 'top' ? 0.001 : view.value === 'street' ? 1.22 : 0.95;
      const position = target.clone().add(new THREE.Vector3().setFromSphericalCoords(distance, polar, angle));
      flight = { t: 0, p0: camera.position.clone(), p1: position, t0: target.clone(), t1: target };
    }
  };
  light.onchange = () => {
    const golden = light.value === 'golden';
    if (isMap) {
      if (!map.getLayer('landmark-models')) return;
      map.setLight({ anchor: 'map', color: golden ? '#ffd0a0' : '#fff0d6', intensity: golden ? 0.62 : 0.48, position: [1.5, 225, golden ? 70 : 48] });
      modelLayer.sun.color.set(golden ? 0xffc18a : 0xfff2d9);
      modelLayer.sun.position.set(-120, golden ? 85 : 200, 120);
      modelLayer.skyLight.intensity = golden ? 0.32 : 0.45;
    } else {
      sun.color.set(golden ? 0xffc18a : 0xfff3da);
      sunOffset.y = golden ? 4500 : 9000;
      skyLight.intensity = golden ? 0.34 : 0.48;
      scene.background.set(golden ? 0xd9c5b4 : 0xb9d4dc);
      scene.fog.color.copy(scene.background);
    }
  };
  function setPresentation(enabled) {
    document.body.classList.toggle('presentation', enabled);
    present.setAttribute('aria-pressed', String(enabled));
    present.textContent = enabled ? 'Exit present' : 'Present';
    status.textContent = enabled ? 'Press Esc to return.' : '';
    if (enabled) panel.open = false;
  }
  present.onclick = () => setPresentation(!document.body.classList.contains('presentation'));
  addEventListener('keydown', e => { if (e.key === 'Escape') setPresentation(false); });
  panel.querySelector('#spatial-share').onclick = async () => {
    const url = new URL(location.href);
    url.searchParams.delete('place');
    if (isMap) {
      const c = map.getCenter();
      url.searchParams.set('view', [c.lng,c.lat,map.getZoom(),map.getPitch(),map.getBearing()].map(v => v.toFixed(5)).join(','));
    } else {
      url.searchParams.set('cam', [...camera.position.toArray(), ...controls.target.toArray()].map(v => v.toFixed(2)).join(','));
    }
    url.searchParams.set('light', light.value);
    try { await navigator.clipboard.writeText(url.href); status.textContent = 'View link copied.'; }
    catch { status.textContent = 'Copy this link:'; const input = document.createElement('input'); input.value = url.href; input.setAttribute('aria-label', 'View link'); input.style.width = '100%'; status.appendChild(input); input.select(); }
  };
  function restore() {
    const params = new URLSearchParams(location.search);
    if (isMap && params.has('view')) {
      const v = params.get('view').split(',').map(Number);
      if (v.length === 5 && v.every(Number.isFinite) && v[0] >= 74.5 && v[0] <= 75.22 && v[1] >= 12.55 && v[1] <= 13.48 && v[2] >= 9.4 && v[2] <= 22 && v[3] >= 0 && v[3] <= 78) {
        map.jumpTo({center: v.slice(0,2), zoom:v[2],pitch:v[3],bearing:v[4]});
      }
    }
    const place = params.get('place');
    if (place !== null && /^\d+$/.test(place)) window.MangaloreAtlas.selectPlace(Number(place));
    light.value = params.get('light') === 'day' ? 'day' : 'golden';
    light.onchange();
  }
  if (isMap && !map.getLayer('landmark-models')) {
    light.disabled = true;
    map.once('load', () => { light.disabled = false; restore(); });
  } else restore();
})();
