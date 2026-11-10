/* ==========================================================================
   GeoVoyage - UI Rendering & Interactions (ui.js)
   Version complète avec affichage des durées OSRM au format Heures & Minutes (Segments et Transits inclus)
   ========================================================================== */

// ==========================================
// 0. FONCTIONS UTILITAIRES DE FORMATAGE
// ==========================================

/**
 * Formate une durée en minutes au format lisible "Xh Ymin" ou "Ymin"
 * @param {number} minutes 
 * @returns {string}
 */
function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '';
  const totalMin = Math.round(minutes);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  if (hrs === 0) {
    return `${mins} min`;
  } else if (mins === 0) {
    return `${hrs}h`;
  } else {
    const minsStr = mins < 10 ? `0${mins}` : `${mins}`;
    return `${hrs}h ${minsStr} min`;
  }
}

// ==========================================
// 1. GESTION DU THÈME (SOMBRE / CLAIR)
// ==========================================

function updateThemeUI() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('themeToggleIcon');
  if (icon) {
    icon.className = isDark ? 'fa-solid fa-moon text-indigo-400' : 'fa-solid fa-sun text-amber-500';
  }
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('pvi-theme', isDark ? 'dark' : 'light');
  updateThemeUI();

  if (typeof updateMapTileLayer === 'function') {
    updateMapTileLayer();
  }
}

// ==========================================
// 2. INITIALISATION ET CHARGEMENT GLOBAL
// ==========================================

window.onload = async function() {
  updateThemeUI();
  loadFromLocalStorage();
  
  const tripNameInput = document.getElementById('tripNameInput');
  if (tripNameInput) {
    tripNameInput.value = appState.name;
    tripNameInput.addEventListener('input', (e) => {
      appState.name = e.target.value || 'Mon Voyage';
      saveToLocalStorage();
    });
  }

  const pivotInput = document.getElementById('pivotDateInput');
  if (pivotInput) {
    pivotInput.value = appState.pivotDate;
    pivotInput.addEventListener('change', (e) => {
      appState.pivotDate = e.target.value;
      renderApp();
    });
  }

  const initialLat = appState.zones.length > 0 ? (appState.hotels[0]?.lat || 48.591) : 48.591;
  const initialLng = appState.zones.length > 0 ? (appState.hotels[0]?.lng || 2.217) : 2.217;

  map = L.map('map').setView([initialLat, initialLng], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  map.on('click', onMapClick);

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#spotParentSearch') && !e.target.closest('#spotParentDropdown')) {
      document.getElementById('spotParentDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#spotTargetSearch') && !e.target.closest('#spotTargetDropdown')) {
      document.getElementById('spotTargetDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#bpTargetSearch') && !e.target.closest('#bpTargetDropdown')) {
      document.getElementById('bpTargetDropdown')?.classList.add('hidden');
    }
  });

  const openPrintRoadbookBtn = document.getElementById('openPrintRoadbookBtn');
  const closeRoadbookBtn = document.getElementById('closeRoadbookBtn');
  const triggerPrintBtn = document.getElementById('triggerPrintBtn');

  if (openPrintRoadbookBtn) {
    openPrintRoadbookBtn.addEventListener('click', async () => {
      await generateRoadbookContent();
      document.getElementById('roadbookModal').classList.remove('hidden');
    });
  }

  if (closeRoadbookBtn) {
    closeRoadbookBtn.addEventListener('click', () => {
      document.getElementById('roadbookModal').classList.add('hidden');
    });
  }

  if (triggerPrintBtn) {
    triggerPrintBtn.addEventListener('click', () => {
      window.print();
    });
  }

  switchViewMode(appState.viewMode || 'designer');
  switchLeftTab(appState.activeTab || 'structure');
  if (appState.mapFocusMode) {
    appState.mapFocusMode = false;
    toggleMapFocus();
  }
  renderApp();

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
      renderMapMarkers();
    }
  }, 300);
};

// ==========================================
// 3. MODES D'AFFICHAGE & VUES
// ==========================================

function switchViewMode(mode) {
  appState.viewMode = mode;
  const designerView = document.getElementById('designerView');
  const travelerView = document.getElementById('travelerView');
  const modeBtnDesigner = document.getElementById('modeBtnDesigner');
  const modeBtnTraveler = document.getElementById('modeBtnTraveler');
  const designerElements = document.querySelectorAll('.designer-only');

  if (mode === 'traveler') {
    designerView.classList.add('hidden');
    travelerView.classList.remove('hidden');
    modeBtnDesigner.className = 'px-3 py-1.5 rounded-lg transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    modeBtnTraveler.className = 'px-3 py-1.5 rounded-lg transition bg-indigo-600 text-white';
    designerElements.forEach(el => el.classList.add('hidden'));
    renderTravelerUI();
  } else {
    travelerView.classList.add('hidden');
    designerView.classList.remove('hidden');
    modeBtnDesigner.className = 'px-3 py-1.5 rounded-lg transition bg-indigo-600 text-white';
    modeBtnTraveler.className = 'px-3 py-1.5 rounded-lg transition text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white';
    designerElements.forEach(el => el.classList.remove('hidden'));
    setTimeout(() => { if (map) map.invalidateSize(); }, 200);
  }
  renderTimelineHeader();
  saveToLocalStorage();
}

function toggleMapFocus() {
  appState.mapFocusMode = !appState.mapFocusMode;
  const designerView = document.getElementById('designerView');
  const leftCol = designerView.querySelector('section:first-child');
  const rightCol = designerView.querySelector('section:last-child');
  const icon = document.getElementById('mapFocusIcon');

  if (appState.mapFocusMode) {
    leftCol.classList.add('hidden');
    rightCol.className = 'col-span-12 flex flex-col h-[85vh] relative';
    icon.className = 'fa-solid fa-compress text-indigo-500 dark:text-indigo-400';
  } else {
    leftCol.classList.remove('hidden');
    rightCol.className = 'lg:col-span-7 flex flex-col h-[500px] lg:h-auto min-h-[400px] relative';
    icon.className = 'fa-solid fa-expand text-indigo-500 dark:text-indigo-400';
  }
  setTimeout(() => { if (map) map.invalidateSize(); }, 200);
}

function centerMapOnCoords(lat, lng) {
  if (map) {
    map.setView([lat, lng], 15);
    setTimeout(() => map.invalidateSize(), 150);
  }
}

function jumpToDay(dayNum) {
  appState.currentSelectedDay = parseInt(dayNum);
  if (appState.viewMode === 'designer') {
    switchLeftTab('planning');
  } else {
    renderTravelerUI();
    renderTimelineHeader();
  }
}

function renderTimelineHeader() {
  const container = document.getElementById('timelineHeader');
  if (!container) return;
  container.innerHTML = '';
  const totalDays = getTotalDays();
  const computed = getZoneComputedDates();
  const isTraveler = (appState.viewMode === 'traveler');

  for (let d = 0; d < totalDays; d++) {
    const zone = appState.zones.find(z => {
      const comp = computed[z.id];
      return comp && d >= comp.checkinDay && d <= comp.checkoutDay;
    });
    const color = zone ? zone.color : '#6366f1';
    const isSelected = (appState.currentSelectedDay === d);

    const btn = document.createElement('button');
    btn.className = `px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center space-x-1.5 ${isSelected ? 'ring-2 ring-indigo-500 shadow-lg scale-105' : 'opacity-80 hover:opacity-100'}`;
    btn.style.backgroundColor = color;
    btn.style.color = '#ffffff';

    if (isTraveler) {
      const shortDate = deltaToShortDateStr(d);
      btn.innerHTML = `<span>${shortDate}</span><span class="text-[10px] opacity-85 font-normal">(J+${d})</span>`;
    } else {
      btn.innerHTML = `<span>J+${d}</span><span class="text-[10px] opacity-80 font-normal">(${deltaToDateStr(d)})</span>`;
    }

    btn.onclick = () => {
      appState.currentSelectedDay = d;
      if (isTraveler) {
        renderTravelerUI();
        renderTimelineHeader();
      } else {
        switchLeftTab('planning');
      }
    };
    container.appendChild(btn);
  }
}

function renderApp() {
  const maxDays = getTotalDays();
  if (appState.currentSelectedDay >= maxDays) appState.currentSelectedDay = Math.max(0, maxDays - 1);

  const badge = document.getElementById('totalDaysBadge');
  if (badge) badge.innerText = `${maxDays} jours`;
  renderTimelineHeader();

  if (appState.viewMode === 'traveler') {
    renderTravelerUI();
  } else {
    renderStructureUI();
    renderPlanningUI();
    renderAllSpotsUI();
    renderMapMarkers();
    checkCoherence();
  }
  saveToLocalStorage();
}

function moveZoneOrder(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= appState.zones.length) return;
  const temp = appState.zones[index];
  appState.zones[index] = appState.zones[targetIndex];
  appState.zones[targetIndex] = temp;
  cleanOrphanTransitsAndTargets();
  renderApp();
}

function locateAndHighlightItem(type, itemId) {
  let targetTab = 'allspots';
  let targetDay = null;

  if (type === 'hotel' || type === 'endpoint') {
    targetTab = 'structure';
  } else if (type === 'spot') {
    let assignedDay = null;
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(itemId)) assignedDay = parseInt(d);
    });
    const spot = appState.spots.find(s => s.id === itemId);
    if (spot && spot.target) {
      const tObj = getTransits().find(t => t.id === spot.target);
      if (tObj) assignedDay = tObj.day;
    }
    if (assignedDay !== null) { targetTab = 'planning'; targetDay = assignedDay; }
  } else if (type === 'bonplan') {
    let assignedDay = null;
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d] && appState.dailyBonsPlans[d].includes(itemId)) assignedDay = parseInt(d);
    });
    const bp = appState.bonsPlans.find(b => b.id === itemId);
    if (bp && bp.target) {
      const tObj = getTransits().find(t => t.id === bp.target);
      if (tObj) assignedDay = tObj.day;
    }
    if (assignedDay !== null) { targetTab = 'planning'; targetDay = assignedDay; }
  }

  if (targetTab === 'planning' && targetDay !== null) appState.currentSelectedDay = targetDay;
  switchLeftTab(targetTab);

  setTimeout(() => {
    const elementId = `card-${type}-${itemId}`;
    const targetEl = document.getElementById(elementId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetEl.classList.add('highlight-card');
      setTimeout(() => targetEl.classList.remove('highlight-card'), 3000);
    }
  }, 100);
}

// ==========================================
// 4. VUE VOYAGEUR & STRUCTURE
// ==========================================

function renderTravelerUI() {
  const curDay = appState.currentSelectedDay;
  const formattedDate = deltaToFormattedDateStr(curDay);
  const shortDate = deltaToShortDateStr(curDay);

  const dayLabel = document.getElementById('travelerDayLabel');
  const dayDate = document.getElementById('travelerDayDate');
  if (dayLabel) dayLabel.innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  if (dayDate) dayDate.innerText = `${shortDate} (J+${curDay})`;

  const dayRoute = calculateDayRoute(curDay);
  const computed = getZoneComputedDates();
  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  const activeHotel = dayRoute.activeHotel;

  const transits = getTransits().filter(t => t.day === curDay);
  const activeTransit = transits.length > 0 ? transits[0] : null;

  const banner = document.getElementById('travelerContextBanner');
  if (banner) {
    if (activeTransit && activeTransit.isNightTransit) {
      const modeIcon = getTransitModeIcon(activeTransit.mode);
      banner.className = 'p-4 rounded-2xl border text-sm bg-amber-500/10 dark:bg-amber-950/40 border-amber-400 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 shadow-md space-y-2';
      banner.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold flex items-center gap-1.5">
            <span class="text-base">${modeIcon}</span> 🛌 Transport de nuit (${activeTransit.nightCount || 1} nuit(s) à bord)
          </span>
          <span class="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">${activeTransit.name}</span>
        </div>
        ${activeTransit.desc ? `
          <div class="pt-2 border-t border-amber-300 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200">
            <i class="fa-solid fa-clipboard-list mr-1.5"></i><strong>Réservation & Infos :</strong>
            <p class="mt-1 whitespace-pre-line font-mono bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-xl border border-amber-200 dark:border-amber-900/40 text-slate-800 dark:text-slate-200">${activeTransit.desc}</p>
          </div>` : ''}
      `;
    } else if (currentZone) {
      banner.className = 'p-4 rounded-2xl border text-sm bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200 shadow-md space-y-2';
      banner.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-bold"><i class="fa-solid fa-map-pin text-indigo-600 dark:text-indigo-400 mr-2"></i>Secteur : ${currentZone.name}</span>
        </div>
        ${activeHotel ? `
          <div class="pt-2 border-t border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between text-xs">
            <div>
              <i class="fa-solid fa-hotel text-blue-500 dark:text-blue-400 mr-1.5"></i><strong>Hôtel :</strong> ${activeHotel.name}
              ${activeHotel.desc ? `<div class="text-slate-600 dark:text-slate-300 mt-0.5 text-[11px] italic">${activeHotel.desc}</div>` : ''}
            </div>
            <div class="flex space-x-2 shrink-0">
              <button onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})" class="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">Centrer</button>
              <a href="${getGoogleMapsUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">Maps</a>
              <a href="${getGeoUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="bg-sky-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">GPS</a>
            </div>
          </div>` : ''}
      `;
    } else {
      banner.className = 'p-4 rounded-2xl border text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 shadow-md';
      banner.innerHTML = `<i class="fa-solid fa-circle-info mr-2"></i>Aucun secteur spécifique aujourd'hui.`;
    }
  }

  const routeContainer = document.getElementById('travelerRouteList');
  if (!routeContainer) return;
  routeContainer.innerHTML = '';

  const daySpotIds = appState.dailyItineraries[curDay] || [];
  const dayBpIds = appState.dailyBonsPlans[curDay] || [];

  if (daySpotIds.length === 0 && dayBpIds.length === 0 && !activeHotel && !activeTransit) {
    routeContainer.innerHTML = '<p class="text-sm text-slate-500 italic py-4 text-center">Aucune étape enregistrée pour cette journée.</p>';
  } else {
    if (activeTransit) {
      const transitEl = document.createElement('div');
      transitEl.className = 'bg-amber-500/10 dark:bg-amber-950/30 border border-amber-400/60 dark:border-amber-800/50 rounded-2xl p-4 space-y-2 shadow-sm';
      transitEl.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-amber-900 dark:text-amber-200 font-bold text-sm truncate">
            ${getTransitModeIcon(activeTransit.mode)} ${activeTransit.name}
          </span>
          ${activeTransit.isNightTransit ? '<span class="text-xs bg-amber-500 text-slate-950 px-2 py-0.5 rounded-full font-bold">🛌 Nuit à bord</span>' : ''}
        </div>
        ${activeTransit.desc ? `<p class="text-xs text-amber-800 dark:text-amber-100 whitespace-pre-line font-mono bg-white/40 dark:bg-slate-900/40 p-2 rounded-xl border border-amber-200/50 dark:border-amber-800/30">${activeTransit.desc}</p>` : ''}
      `;
      routeContainer.appendChild(transitEl);
    }

    if (activeHotel) {
      const hotelEl = document.createElement('div');
      hotelEl.className = 'bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl p-4 space-y-2 shadow-sm';
      hotelEl.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-blue-900 dark:text-blue-200 font-bold text-sm truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})"><i class="fa-solid fa-hotel text-blue-500 dark:text-blue-400 mr-2"></i>Hébergement : ${activeHotel.name}</span>
        </div>
        ${activeHotel.desc ? `<p class="text-xs text-blue-800 dark:text-blue-100">${activeHotel.desc}</p>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-blue-200 dark:border-blue-900/40">
          <button onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})" class="py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-crosshairs mr-1"></i> Centrer</button>
          <a href="${getGoogleMapsUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-location-arrow mr-1.5"></i> Maps</a>
          <a href="${getGeoUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="flex-1 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-compass mr-1.5"></i> GPS</a>
        </div>
      `;
      routeContainer.appendChild(hotelEl);
    }

    daySpotIds.forEach((spotId, idx) => {
      const spot = appState.spots.find(s => s.id === spotId);
      if (!spot) return;
      const segDist = dayRoute.segmentsDistances[idx] !== undefined ? dayRoute.segmentsDistances[idx] : 0;
      const parentSpot = spot.parentId ? appState.spots.find(p => p.id === spot.parentId) : null;

      const dayRouteInfo = getEffectiveDistanceAndDuration(`day_${curDay}`, dayRoute.totalDist);
      let segmentDisplay = `+${segDist.toFixed(1)} km`;
      if (dayRouteInfo.isOsrm && dayRouteInfo.durationMin && dayRoute.totalDist > 0) {
        const ratio = segDist / dayRoute.totalDist;
        const segmentMin = dayRouteInfo.durationMin * ratio;
        const durFormatted = formatDuration(segmentMin);
        segmentDisplay = `🚗 +${segDist.toFixed(1)} km${durFormatted ? ` (~${durFormatted})` : ''}`;
      } else {
        segmentDisplay = `+${segDist.toFixed(1)} km`;
      }

      const el = document.createElement('div');
      el.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm';
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate">
            <span class="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
            <div class="truncate">
              <span class="text-slate-900 dark:text-white font-bold text-sm truncate block cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})">${spot.name}</span>
              ${parentSpot ? `<span class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
            </div>
          </div>
          <span class="text-xs text-emerald-600 dark:text-emerald-400 font-mono shrink-0">${segmentDisplay}</span>
        </div>
        ${spot.desc ? `<p class="text-xs text-slate-600 dark:text-slate-300">${spot.desc}</p>` : ''}
        ${spot.imageBase64 ? `<div><img src="${spot.imageBase64}" class="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-slate-700"></div>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})" class="py-2.5 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-crosshairs mr-1"></i> Centrer</button>
          <a href="${getGoogleMapsUrl(spot.lat, spot.lng)}" target="_blank" class="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-location-arrow mr-1.5"></i> Maps</a>
          <a href="${getGeoUrl(spot.lat, spot.lng)}" target="_blank" class="flex-1 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-compass mr-1.5"></i> GPS</a>
        </div>
      `;
      routeContainer.appendChild(el);
    });

    dayBpIds.forEach(bpId => {
      const bp = appState.bonsPlans.find(b => b.id === bpId);
      if (!bp) return;
      const el = document.createElement('div');
      el.className = 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800/50 rounded-2xl p-4 space-y-2 shadow-sm';
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-amber-900 dark:text-amber-200 font-bold text-sm truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})"><i class="fa-solid fa-lightbulb text-amber-500 dark:text-amber-400 mr-2"></i>${bp.title} (${bp.category})</span>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-800 dark:text-amber-100">${bp.desc}</p>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-amber-200 dark:border-amber-900/40">
          <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-crosshairs mr-1"></i> Centrer</button>
          <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-location-arrow mr-1.5"></i> Maps</a>
          <a href="${getGeoUrl(bp.lat, bp.lng)}" target="_blank" class="flex-1 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-compass mr-1.5"></i> GPS</a>
        </div>
      `;
      routeContainer.appendChild(el);
    });
  }

  const dayRouteInfo = getEffectiveDistanceAndDuration(`day_${curDay}`, dayRoute.totalDist);
  const distEl = document.getElementById('travelerDayDistance');
  if (distEl) {
    const durStr = dayRouteInfo.durationMin ? ` (~${formatDuration(dayRouteInfo.durationMin)})` : '';
    distEl.innerText = dayRouteInfo.isOsrm 
      ? `🚗 ${dayRouteInfo.distanceKm.toFixed(1)} km${durStr}`
      : `${dayRouteInfo.distanceKm.toFixed(1)} km`;
  }
}

function changeTravelerDay(delta) {
  const nextDay = appState.currentSelectedDay + delta;
  if (nextDay >= 0 && nextDay < getTotalDays()) {
    appState.currentSelectedDay = nextDay;
    renderApp();
  }
}

function renderStructureUI() {
  const container = document.getElementById('tabContentStructure');
  if (!container) return;
  container.innerHTML = '';

  const depTransit = getTransits().find(t => t.id === 'transit_dep_first');
  const depTransitCalc = depTransit ? calculateTransitDistances(depTransit) : null;
  const depRouteInfo = depTransitCalc ? getEffectiveDistanceAndDuration(depTransit.id, depTransitCalc.totalDist) : null;

  const depTransitSpots = appState.spots.filter(s => s.target === 'transit_dep_first');
  const depTransitBps = appState.bonsPlans.filter(bp => bp.target === 'transit_dep_first');

  const depEl = document.createElement('div');
  depEl.id = `card-endpoint-departure`;
  depEl.className = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm';
  
  let depTransitSpotsHtml = depTransitSpots.length > 0 ? depTransitSpots.map((s, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-800/60">
      <span class="text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${idx + 1}) ${s.name}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editSpot('${s.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignSpot('${s.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  let depTransitBpsHtml = depTransitBps.length > 0 ? depTransitBps.map((bp, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30">
      <span class="text-amber-900 dark:text-amber-200 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">(${idx + 1}) ${bp.title}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editBonPlan('${bp.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignBonPlan('${bp.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  depEl.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="truncate cursor-pointer" onclick="centerMapOnCoords(${appState.departurePoint.lat}, ${appState.departurePoint.lng})">
        <h4 class="font-bold text-sm text-slate-900 dark:text-white flex items-center"><i class="fa-solid fa-flag-checkered text-emerald-500 mr-2"></i>${appState.departurePoint.name}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${appState.departurePoint.lat.toFixed(3)}, ${appState.departurePoint.lng.toFixed(3)}</p>
      </div>
      <div class="flex items-center space-x-1">
        <button onclick="centerMapOnCoords(${appState.departurePoint.lat}, ${appState.departurePoint.lng})" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="openEndpointModal('departure')" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
      </div>
    </div>
    ${depTransit ? `
      <div class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
        <div class="font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
          <span>${getTransitModeIcon(depTransit.mode)} ${depTransit.name} (${depTransit.mode || 'Voiture'})</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-mono">
            ${depRouteInfo && depRouteInfo.isOsrm 
              ? `🚗 ${depRouteInfo.distanceKm.toFixed(1)} km (~${formatDuration(depRouteInfo.durationMin)})` 
              : `${depTransitCalc ? depTransitCalc.totalDist.toFixed(1) : 0} km`}
          </span>
        </div>
        ${depTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Spots :</span>${depTransitSpotsHtml}</div>` : ''}
        ${depTransitBps.length > 0 ? `<div class="space-y-1"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Bons plans :</span>${depTransitBpsHtml}</div>` : ''}
        <div class="text-right pt-1">
          <button onclick="editTransitModal('${depTransit.id}')" class="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
        </div>
      </div>
    ` : ''}
  `;
  container.appendChild(depEl);

  const computedDates = getZoneComputedDates();

  appState.zones.forEach((zone, index) => {
    const comp = computedDates[zone.id] || { checkinDay: 0, checkoutDay: 0, nights: 0 };
    const checkinDate = deltaToDateStr(comp.checkinDay);
    const checkoutDate = deltaToDateStr(comp.checkoutDay);
    const zoneDist = calculateZoneTotalDistance(zone);
    const zoneHotels = appState.hotels.filter(h => h.zoneId === zone.id);

    let zoneSpots = [];
    let zoneBps = [];
    for (let d = comp.checkinDay; d <= comp.checkoutDay; d++) {
      (appState.dailyItineraries[d] || []).forEach(sId => {
        const s = appState.spots.find(x => x.id === sId);
        if (s && !zoneSpots.some(x => x.spot.id === s.id)) zoneSpots.push({ spot: s, day: d });
      });
      (appState.dailyBonsPlans[d] || []).forEach(bpId => {
        const bp = appState.bonsPlans.find(x => x.id === bpId);
        if (bp && !zoneBps.some(x => x.bonPlan.id === bp.id)) zoneBps.push({ bonPlan: bp, day: d });
      });
    }

    let zoneSpotsHtml = zoneSpots.length > 0 ? zoneSpots.map((item, idx) => `
      <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-800/60">
        <span class="text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${item.spot.lat}, ${item.spot.lng})">(${idx + 1}) ${item.spot.name}</span>
        <div class="flex items-center space-x-1 shrink-0">
          <button onclick="centerMapOnCoords(${item.spot.lat}, ${item.spot.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <button onclick="editSpot('${item.spot.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="detachSpotFromDay(${item.day}, '${item.spot.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
        </div>
      </div>
    `).join('') : '';

    let zoneBpsHtml = zoneBps.length > 0 ? zoneBps.map((item, idx) => `
      <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30">
        <span class="text-amber-900 dark:text-amber-200 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${item.bonPlan.lat}, ${item.bonPlan.lng})">(${idx + 1}) ${item.bonPlan.title}</span>
        <div class="flex items-center space-x-1 shrink-0">
          <button onclick="centerMapOnCoords(${item.bonPlan.lat}, ${item.bonPlan.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <button onclick="editBonPlan('${item.bonPlan.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="detachBonPlanFromDay(${item.day}, '${item.bonPlan.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
        </div>
      </div>
    `).join('') : '';

    const zoneEl = document.createElement('div');
    zoneEl.id = `card-zone-${zone.id}`;
    zoneEl.className = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm';
    
    let html = `
      <div class="border-b border-slate-200 dark:border-slate-800 pb-3" style="border-left: 4px solid ${zone.color}">
        <div class="pl-2 space-y-1">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-slate-900 dark:text-white">${zone.name}</h4>
            <div class="flex items-center space-x-1 shrink-0">
              ${index > 0 ? `<button onclick="moveZoneOrder(${index}, -1)" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>` : ''}
              ${index < appState.zones.length - 1 ? `<button onclick="moveZoneOrder(${index}, 1)" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>` : ''}
              <button onclick="editZone('${zone.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteZone('${zone.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 rounded transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
          <div class="cursor-pointer hover:opacity-80 inline-block transition" onclick="jumpToDay(${comp.checkinDay})" title="Cliquer pour aller au premier jour J+${comp.checkinDay} dans le planning">
            <span class="text-xs text-indigo-600 dark:text-indigo-300 font-mono font-bold bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/60 flex items-center w-fit">
              <i class="fa-solid fa-calendar-days mr-1.5 text-indigo-500 dark:text-indigo-400"></i>J+${comp.checkinDay} ➔ J+${comp.checkoutDay} (${comp.nights} nuit(s)) <i class="fa-solid fa-arrow-right ml-1 text-[10px]"></i>
            </span>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap pt-1">
            <span>🗓️ ${checkinDate} au ${checkoutDate}</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-mono">📍 Bilan secteur : ${zoneDist.toFixed(1)} km</span>
          </div>
        </div>
      </div>

      ${zoneSpots.length > 0 ? `<div class="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg"><span class="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Spots programmés :</span>${zoneSpotsHtml}</div>` : ''}
      ${zoneBps.length > 0 ? `<div class="space-y-1 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg"><span class="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Bons plans du secteur :</span>${zoneBpsHtml}</div>` : ''}

      <div class="space-y-2">
        <div class="text-xs font-semibold text-slate-500 dark:text-slate-400">Hébergements de la zone</div>
    `;

    if (zoneHotels.length === 0) {
      html += `<div class="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-between">
        <span><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Aucun hébergement (0 nuit) !</span>
        <button onclick="openHotelModal()" class="bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">+ Hébergement</button>
      </div>`;
    } else {
      zoneHotels.forEach(h => {
        html += `
          <div id="card-hotel-${h.id}" class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div class="truncate cursor-pointer hover:opacity-80" onclick="centerMapOnCoords(${h.lat}, ${h.lng})">
              <span class="text-slate-900 dark:text-white font-semibold flex items-center"><i class="fa-solid fa-hotel text-blue-500 dark:text-blue-400 mr-1.5"></i>${h.name}</span>
              <span class="text-slate-500 dark:text-slate-400 block truncate">${h.nights || 0} nuit(s) • Rayon : ${h.radiusKm || 50} km</span>
              ${h.desc ? `<span class="text-slate-600 dark:text-slate-300 block italic truncate mt-0.5 text-[11px]">${h.desc}</span>` : ''}
            </div>
            <div class="flex items-center space-x-1 shrink-0 ml-2">
              <button onclick="centerMapOnCoords(${h.lat}, ${h.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
              <button onclick="editHotel('${h.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteHotel('${h.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 rounded transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;

    const nextTransitId = index < appState.zones.length - 1 ? `transit_${zone.id}_${appState.zones[index+1].id}` : null;
    const nextTransit = nextTransitId ? getTransits().find(t => t.id === nextTransitId) : null;
    const nextTransitCalc = nextTransit ? calculateTransitDistances(nextTransit) : null;
    const nextRouteInfo = (nextTransit && nextTransitCalc) ? getEffectiveDistanceAndDuration(nextTransit.id, nextTransitCalc.totalDist) : null;
    const nextTransitSpots = nextTransit ? appState.spots.filter(s => s.target === nextTransit.id) : [];

    if (nextTransit) {
      html += `
        <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
          <div class="font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
            <span>${getTransitModeIcon(nextTransit.mode)} ${nextTransit.name} (${nextTransit.mode || 'Voiture'})</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-mono">
              ${nextRouteInfo && nextRouteInfo.isOsrm 
                ? `🚗 ${nextRouteInfo.distanceKm.toFixed(1)} km (~${formatDuration(nextRouteInfo.durationMin)})` 
                : `${nextTransitCalc ? nextTransitCalc.totalDist.toFixed(1) : 0} km`}
            </span>
          </div>
          ${nextTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Spots en transit :</span>${nextTransitSpots.map((s, sIdx) => `<div class="flex items-center justify-between py-0.5 px-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800"><span class="text-slate-700 dark:text-slate-300 cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${sIdx + 1}) ${s.name}</span><div class="flex space-x-1"><button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="text-emerald-600 dark:text-emerald-400 p-1" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button><button onclick="editSpot('${s.id}')" class="text-indigo-600 dark:text-indigo-400 p-1"><i class="fa-solid fa-pen-to-square"></i></button></div></div>`).join('')}</div>` : ''}
          <div class="text-right pt-1">
            <button onclick="editTransitModal('${nextTransit.id}')" class="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
          </div>
        </div>
      `;
    }

    zoneEl.innerHTML = html;
    container.appendChild(zoneEl);
  });

  const arrTransit = getTransits().find(t => t.id === 'transit_last_arr');
  const arrTransitCalc = arrTransit ? calculateTransitDistances(arrTransit) : null;
  const arrRouteInfo = (arrTransit && arrTransitCalc) ? getEffectiveDistanceAndDuration(arrTransit.id, arrTransitCalc.totalDist) : null;
  const arrTransitSpots = appState.spots.filter(s => s.target === 'transit_last_arr');
  const arrTransitBps = appState.bonsPlans.filter(bp => bp.target === 'transit_last_arr');

  const arrEl = document.createElement('div');
  arrEl.id = `card-endpoint-arrival`;
  arrEl.className = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm';

  let arrTransitSpotsHtml = arrTransitSpots.length > 0 ? arrTransitSpots.map((s, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-50 dark:bg-slate-900/80 rounded border border-slate-200 dark:border-slate-800/60">
      <span class="text-slate-700 dark:text-slate-300 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${idx + 1}) ${s.name}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editSpot('${s.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignSpot('${s.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  let arrTransitBpsHtml = arrTransitBps.length > 0 ? arrTransitBps.map((bp, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-50 dark:bg-amber-950/20 rounded border border-amber-200 dark:border-amber-900/30">
      <span class="text-amber-900 dark:text-amber-200 font-medium cursor-pointer hover:text-emerald-600 dark:hover:text-emerald-400" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">(${idx + 1}) ${bp.title}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editBonPlan('${bp.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignBonPlan('${bp.id}')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  arrEl.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="truncate cursor-pointer" onclick="centerMapOnCoords(${appState.arrivalPoint.lat}, ${appState.arrivalPoint.lng})">
        <h4 class="font-bold text-sm text-slate-900 dark:text-white flex items-center"><i class="fa-solid fa-house-flag text-blue-500 mr-2"></i>${appState.arrivalPoint.name}</h4>
        <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">${appState.arrivalPoint.lat.toFixed(3)}, ${appState.arrivalPoint.lng.toFixed(3)}</p>
      </div>
      <div class="flex items-center space-x-1">
        <button onclick="centerMapOnCoords(${appState.arrivalPoint.lat}, ${appState.arrivalPoint.lng})" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="openEndpointModal('arrival')" class="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
      </div>
    </div>
    ${arrTransit ? `
      <div class="mt-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs space-y-2 bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg">
        <div class="font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
          <span>${getTransitModeIcon(arrTransit.mode)} ${arrTransit.name} (${arrTransit.mode || 'Voiture'})</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-mono">
            ${arrRouteInfo && arrRouteInfo.isOsrm 
              ? `🚗 ${arrRouteInfo.distanceKm.toFixed(1)} km (~${formatDuration(arrRouteInfo.durationMin)})` 
              : `${arrTransitCalc ? arrTransitCalc.totalDist.toFixed(1) : 0} km`}
          </span>
        </div>
        ${arrTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Spots :</span>${arrTransitSpotsHtml}</div>` : ''}
        ${arrTransitBps.length > 0 ? `<div class="space-y-1"><span class="text-slate-500 dark:text-slate-400 font-semibold block">Bons plans :</span>${arrTransitBpsHtml}</div>` : ''}
        <div class="text-right pt-1">
          <button onclick="editTransitModal('${arrTransit.id}')" class="p-1 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
        </div>
      </div>
    ` : ''}
  `;
  container.appendChild(arrEl);
}

function detachSpotFromDay(day, spotId) {
  if (appState.dailyItineraries[day]) {
    appState.dailyItineraries[day] = appState.dailyItineraries[day].filter(id => id !== spotId);
    renderApp();
  }
}

function detachBonPlanFromDay(day, bonPlanId) {
  if (appState.dailyBonsPlans[day]) {
    appState.dailyBonsPlans[day] = appState.dailyBonsPlans[day].filter(id => id !== bonPlanId);
    renderApp();
  }
}

// ==========================================
// 5. PLANNING QUOTIDIEN
// ==========================================

function renderPlanningUI() {
  const curDay = appState.currentSelectedDay;
  const dateStr = deltaToDateStr(curDay);

  const dayLabel = document.getElementById('selectedDayLabel');
  const dayDate = document.getElementById('selectedDayDate');
  if (dayLabel) dayLabel.innerText = `Jour J+${curDay}`;
  if (dayDate) dayDate.innerText = dateStr;

  const dayRoute = calculateDayRoute(curDay);
  const computed = getZoneComputedDates();
  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  const activeHotel = dayRoute.activeHotel;

  const banner = document.getElementById('dayContextBanner');
  if (banner) {
    if (dayRoute.transits && dayRoute.transits.length > 0) {
      const t = dayRoute.transits[0];
      const tCalc = calculateTransitDistances(t);
      const tRouteInfo = getEffectiveDistanceAndDuration(t.id, tCalc.totalDist);
      const modeIcon = getTransitModeIcon(t.mode);
      const durStr = tRouteInfo.durationMin ? ` (~${formatDuration(tRouteInfo.durationMin)})` : '';
      banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-amber-50 dark:bg-amber-950/45 border-amber-300 dark:border-amber-800/80 text-amber-900 dark:text-amber-200 flex justify-between items-center flex-wrap gap-2';
      banner.innerHTML = `<div><span class="mr-2 text-base">${modeIcon}</span><strong>${t.name} :</strong> Mode : <em>${t.mode || 'Voiture'}</em> • Distance transit : <span class="text-emerald-600 dark:text-emerald-400 font-mono font-bold">${tRouteInfo.isOsrm ? `🚗 ${tRouteInfo.distanceKm.toFixed(1)} km${durStr}` : `${tCalc.totalDist.toFixed(1)} km`}</span>.</div><button onclick="editTransitModal('${t.id}')" class="bg-amber-200 dark:bg-amber-800/60 hover:bg-amber-300 dark:hover:bg-amber-700 text-amber-950 dark:text-white px-2.5 py-1 rounded-lg text-xs font-semibold"><i class="fa-solid fa-gear mr-1"></i>Configurer</button>`;
    } else if (currentZone) {
      banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-200 flex justify-between items-center flex-wrap gap-2';
      banner.innerHTML = `<div><i class="fa-solid fa-map-pin text-indigo-600 dark:text-indigo-400 mr-2"></i>Secteur actif : <strong>${currentZone.name}</strong></div>${activeHotel ? `<span class="text-xs bg-indigo-100 dark:bg-indigo-900 px-2.5 py-1 rounded-lg text-indigo-700 dark:text-indigo-300 cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})"><i class="fa-solid fa-hotel mr-1"></i>${activeHotel.name}</span>` : ''}`;
    } else {
      banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400';
      banner.innerHTML = `<i class="fa-solid fa-circle-info mr-2"></i>Aucun secteur défini pour cette journée.`;
    }
  }

  const addSelect = document.getElementById('addSpotToDaySelect');
  if (addSelect) {
    addSelect.innerHTML = '<option value="">-- Choisir un spot --</option>';
    appState.spots.forEach(s => { 
      const parentSpot = s.parentId ? appState.spots.find(p => p.id === s.parentId) : null;
      const label = parentSpot ? `↳ ${s.name} (Sous-spot de ${parentSpot.name})` : s.name;
      addSelect.innerHTML += `<option value="${s.id}">${label}</option>`; 
    });
  }

  const addBpSelect = document.getElementById('addBonPlanToDaySelect');
  if (addBpSelect) {
    addBpSelect.innerHTML = '<option value="">-- Choisir un bon plan --</option>';
    appState.bonsPlans.forEach(bp => { addBpSelect.innerHTML += `<option value="${bp.id}">${bp.title} (${bp.category})</option>`; });
  }

  const routeContainer = document.getElementById('dayRouteList');
  if (!routeContainer) return;
  routeContainer.innerHTML = '';

  const daySpotIds = appState.dailyItineraries[curDay] || [];
  const dayBpIds = appState.dailyBonsPlans[curDay] || [];

  let transitBps = [];
  let activeTransitId = '';
  if (dayRoute.transits && dayRoute.transits.length > 0) {
    activeTransitId = dayRoute.transits[0].id;
    transitBps = appState.bonsPlans.filter(bp => bp.target === activeTransitId);
  }

  if (daySpotIds.length === 0 && dayBpIds.length === 0 && transitBps.length === 0 && !dayRoute.originPoint && dayRoute.transitSpots.length === 0 && !activeHotel) {
    routeContainer.innerHTML = '<p class="text-xs sm:text-sm text-slate-500 italic py-2">Aucun spot ou bon plan programmé pour cette journée.</p>';
  } else {
    if (activeHotel) {
      const hotelItem = document.createElement('div');
      hotelItem.id = `card-hotel-${activeHotel.id}`;
      hotelItem.className = 'bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
      hotelItem.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})">
            <i class="fa-solid fa-hotel text-blue-500 dark:text-blue-400 shrink-0 text-base"></i>
            <span class="text-blue-900 dark:text-blue-200 font-semibold truncate">Hébergement : ${activeHotel.name}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editHotel('${activeHotel.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        </div>
        ${activeHotel.desc ? `<p class="text-xs text-blue-800 dark:text-blue-100/90 pl-6">${activeHotel.desc}</p>` : ''}
      `;
      routeContainer.appendChild(hotelItem);
    }

    if (dayRoute.originPoint && !activeHotel) {
      const originItem = document.createElement('div');
      originItem.id = `card-endpoint-${dayRoute.originPoint.id || 'dep'}`;
      originItem.className = 'bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs sm:text-sm flex justify-between items-center text-slate-600 dark:text-slate-400';
      originItem.innerHTML = `
        <span class="cursor-pointer hover:text-slate-900 dark:hover:text-white" onclick="centerMapOnCoords(${dayRoute.originPoint.lat}, ${dayRoute.originPoint.lng})"><i class="fa-solid fa-house text-indigo-500 dark:text-indigo-400 mr-2"></i>Départ : <strong>${dayRoute.originPoint.name || 'Hébergement / Point'}</strong></span>
        <div class="flex space-x-1">
          <button onclick="centerMapOnCoords(${dayRoute.originPoint.lat}, ${dayRoute.originPoint.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(dayRoute.originPoint.lat, dayRoute.originPoint.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
        </div>
      `;
      routeContainer.appendChild(originItem);
    }

    if (dayRoute.transitSpots && dayRoute.transitSpots.length > 0) {
      dayRoute.transitSpots.forEach((ts, tIdx) => {
        const transitSegDist = dayRoute.segmentsDistances[tIdx] !== undefined ? dayRoute.segmentsDistances[tIdx] : 0;
        const parentSpot = ts.parentId ? appState.spots.find(p => p.id === ts.parentId) : null;
        
        const transitRouteInfo = activeTransitId ? getEffectiveDistanceAndDuration(activeTransitId, dayRoute.totalDist) : { isOsrm: false, durationMin: null };
        let transitSegDisplay = `+${transitSegDist.toFixed(1)} km`;
        if (transitRouteInfo.isOsrm && transitRouteInfo.durationMin && dayRoute.totalDist > 0) {
          const ratio = transitSegDist / dayRoute.totalDist;
          const segmentMin = transitRouteInfo.durationMin * ratio;
          const durFormatted = formatDuration(segmentMin);
          transitSegDisplay = `🚗 +${transitSegDist.toFixed(1)} km${durFormatted ? ` (~${durFormatted})` : ''}`;
        } else {
          transitSegDisplay = `+${transitSegDist.toFixed(1)} km`;
        }

        const tItem = document.createElement('div');
        tItem.id = `card-spot-${ts.id}`;
        tItem.className = 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/50 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
        tItem.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 truncate">
              <span class="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer" onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})" title="Centrer">T</span>
              <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})">
                <span class="text-amber-900 dark:text-amber-200 font-semibold truncate block">${ts.name} <span class="text-xs text-amber-600 dark:text-amber-400">(Transit)</span></span>
                ${parentSpot ? `<span class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <button onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
              <a href="${getGoogleMapsUrl(ts.lat, ts.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
              <button onclick="editSpot('${ts.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="moveTransitSpot('${activeTransitId}', ${tIdx}, -1)" class="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>
              <button onclick="moveTransitSpot('${activeTransitId}', ${tIdx}, 1)" class="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>
              <button onclick="unassignSpot('${ts.id}')" class="p-1.5 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
            </div>
          </div>
          ${ts.desc ? `<p class="text-xs text-slate-600 dark:text-slate-300 pl-8">${ts.desc}</p>` : ''}
          ${ts.imageBase64 ? `<div class="pl-8 pt-1.5"><img src="${ts.imageBase64}" class="w-28 h-20 object-cover rounded-xl border border-slate-300 dark:border-slate-700"></div>` : ''}
          <div class="text-xs text-emerald-600 dark:text-emerald-400 font-mono pl-8">➔ Distance : ${transitSegDisplay}</div>
        `;
        routeContainer.appendChild(tItem);
      });
    }

    daySpotIds.forEach((spotId, idx) => {
      const spot = appState.spots.find(s => s.id === spotId);
      if (!spot) return;

      const offsetIndex = (dayRoute.transitSpots ? dayRoute.transitSpots.length : 0) + idx;
      const segDist = dayRoute.segmentsDistances[offsetIndex] !== undefined ? dayRoute.segmentsDistances[offsetIndex] : 0;
      const parentSpot = spot.parentId ? appState.spots.find(p => p.id === spot.parentId) : null;

      const dayRouteInfo = getEffectiveDistanceAndDuration(`day_${curDay}`, dayRoute.totalDist);
      let segmentDisplay = `+${segDist.toFixed(1)} km`;
      if (dayRouteInfo.isOsrm && dayRouteInfo.durationMin && dayRoute.totalDist > 0) {
        const ratio = segDist / dayRoute.totalDist;
        const segmentMin = dayRouteInfo.durationMin * ratio;
        const durFormatted = formatDuration(segmentMin);
        segmentDisplay = `🚗 +${segDist.toFixed(1)} km${durFormatted ? ` (~${durFormatted})` : ''}`;
      } else {
        segmentDisplay = `+${segDist.toFixed(1)} km`;
      }

      const item = document.createElement('div');
      item.id = `card-spot-${spot.id}`;
      item.className = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-1 text-xs sm:text-sm shadow-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate">
            <span class="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})" title="Centrer">${idx + 1}</span>
            <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})">
              <span class="text-slate-900 dark:text-slate-200 font-semibold truncate block">${spot.name}</span>
              ${parentSpot ? `<span class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(spot.lat, spot.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editSpot('${spot.id}')" class="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="moveSpotInDay(${curDay}, ${idx}, -1)" class="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>
            <button onclick="moveSpotInDay(${curDay}, ${idx}, 1)" class="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>
            <button onclick="removeSpotFromDay(${curDay}, ${idx})" class="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-500 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
          </div>
        </div>
        ${spot.desc ? `<p class="text-xs text-slate-600 dark:text-slate-300 pl-8">${spot.desc}</p>` : ''}
        ${spot.url ? `<div class="pl-8 pt-0.5"><a href="${spot.url}" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${spot.url}</span></a></div>` : ''}
        <div class="text-xs text-emerald-600 dark:text-emerald-400 font-mono pl-8 pt-0.5">➔ Distance : ${segmentDisplay}</div>
        ${spot.imageBase64 ? `<div class="pl-8 pt-1.5"><img src="${spot.imageBase64}" class="w-28 h-20 object-cover rounded-xl border border-slate-200 dark:border-slate-700"></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });

    transitBps.forEach(bp => {
      const item = document.createElement('div');
      item.id = `card-bonplan-${bp.id}`;
      item.className = 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 rounded-xl p-3 space-y-1 text-xs sm:text-sm shadow-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">
            <i class="fa-solid fa-lightbulb text-amber-500 dark:text-amber-400 shrink-0"></i>
            <span class="text-amber-900 dark:text-amber-200 font-semibold truncate">[Transit] ${bp.title}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editBonPlan('${bp.id}')" class="p-1.5 text-amber-600 dark:text-amber-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-800 dark:text-amber-100 pl-6">${bp.desc}</p>` : ''}
        ${bp.url ? `<div class="pl-6"><a href="${bp.url}" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });

    dayBpIds.forEach((bpId, idx) => {
      const bp = appState.bonsPlans.find(b => b.id === bpId);
      if (!bp) return;

      const item = document.createElement('div');
      item.id = `card-bonplan-${bp.id}`;
      item.className = 'bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 rounded-xl p-3 space-y-1 text-xs sm:text-sm shadow-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">
            <i class="fa-solid fa-lightbulb text-amber-500 dark:text-amber-400 shrink-0"></i>
            <span class="text-amber-900 dark:text-amber-200 font-semibold truncate">${bp.title}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editBonPlan('${bp.id}')" class="p-1.5 text-amber-600 dark:text-amber-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="removeBonPlanFromDay(${curDay}, ${idx})" class="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-500 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
          </div>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-800 dark:text-amber-100 pl-6">${bp.desc}</p>` : ''}
        ${bp.url ? `<div class="pl-6"><a href="${bp.url}" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });
  }

  const dayRouteInfo = getEffectiveDistanceAndDuration(`day_${curDay}`, dayRoute.totalDist);
  const dayDistEl = document.getElementById('dayRouteDistance');
  if (dayDistEl) {
    const durStr = dayRouteInfo.durationMin ? ` (~${formatDuration(dayRouteInfo.durationMin)})` : '';
    dayDistEl.innerText = dayRouteInfo.isOsrm 
      ? `🚗 ${dayRouteInfo.distanceKm.toFixed(1)} km${durStr}`
      : `${dayRouteInfo.distanceKm.toFixed(1)} km`;
  }
}

function changeDay(delta) {
  const nextDay = appState.currentSelectedDay + delta;
  const maxDays = getTotalDays();
  if (nextDay >= 0 && nextDay < maxDays) {
    appState.currentSelectedDay = nextDay;
    renderApp();
  }
}

function addSpotToCurrentDay() {
  const select = document.getElementById('addSpotToDaySelect');
  if (!select) return;
  const spotId = select.value;
  if (!spotId) return;
  const curDay = appState.currentSelectedDay;
  if (!appState.dailyItineraries[curDay]) appState.dailyItineraries[curDay] = [];
  if (!appState.dailyItineraries[curDay].includes(spotId)) appState.dailyItineraries[curDay].push(spotId);
  renderApp();
}

function addBonPlanToCurrentDay() {
  const select = document.getElementById('addBonPlanToDaySelect');
  if (!select) return;
  const bpId = select.value;
  if (!bpId) return;
  const curDay = appState.currentSelectedDay;
  if (!appState.dailyBonsPlans[curDay]) appState.dailyBonsPlans[curDay] = [];
  if (!appState.dailyBonsPlans[curDay].includes(bpId)) appState.dailyBonsPlans[curDay].push(bpId);
  renderApp();
}

function moveSpotInDay(day, idx, direction) {
  const list = appState.dailyItineraries[day];
  if (!list) return;
  const targetIdx = idx + direction;
  if (targetIdx >= 0 && targetIdx < list.length) {
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    renderApp();
  }
}

function moveTransitSpot(transitId, idx, direction) {
  if (!appState.transitSpotOrder || !appState.transitSpotOrder[transitId]) return;
  const list = appState.transitSpotOrder[transitId];
  const targetIdx = idx + direction;
  if (targetIdx >= 0 && targetIdx < list.length) {
    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;
    renderApp();
  }
}

function removeSpotFromDay(day, idx) {
  if (appState.dailyItineraries[day]) {
    appState.dailyItineraries[day].splice(idx, 1);
    renderApp();
  }
}

function removeBonPlanFromDay(day, idx) {
  if (appState.dailyBonsPlans[day]) {
    appState.dailyBonsPlans[day].splice(idx, 1);
    renderApp();
  }
}

// ==========================================
// 6. LISTE DE TOUS LES SPOTS ET BONS PLANS
// ==========================================

function renderAllSpotsUI() {
  const validTransits = getTransits();
  const spotsContainer = document.getElementById('allSpotsList');
  const bpContainer = document.getElementById('allBonsPlansList');
  if (!spotsContainer || !bpContainer) return;

  const countBadge = document.getElementById('allSpotsCountBadge');
  const spotsBadge = document.getElementById('allSpotsBadge');
  const bpBadge = document.getElementById('allBonsPlansBadge');

  if (countBadge) countBadge.innerText = appState.spots.length + appState.bonsPlans.length;
  if (spotsBadge) spotsBadge.innerText = appState.spots.length;
  if (bpBadge) bpBadge.innerText = appState.bonsPlans.length;

  spotsContainer.innerHTML = appState.spots.length === 0 ? '<p class="text-xs sm:text-sm text-slate-500 italic">Aucun spot créé</p>' : '';
  appState.spots.forEach(s => {
    let attachmentBadges = '';
    if (s.target) {
      const tObj = validTransits.find(t => t.id === s.target);
      attachmentBadges += `<span class="text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40 px-2 py-0.5 rounded-md font-medium">Transit : ${tObj ? tObj.name : s.target}</span>`;
    }

    let assignedDays = [];
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(s.id)) assignedDays.push(`J+${d}`);
    });

    if (assignedDays.length > 0) {
      attachmentBadges += `<span class="text-[11px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 px-2 py-0.5 rounded-md font-medium cursor-pointer hover:underline" onclick="jumpToDay(${assignedDays[0].replace('J+', '')})">Jours : ${assignedDays.join(', ')}</span>`;
    }

    let nearestZoneBadge = '';
    if (!s.target && assignedDays.length === 0) {
      attachmentBadges = '<span class="text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">Libre</span>';
      const nearest = getNearestZoneInfo(s.lat, s.lng);
      if (nearest) {
        nearestZoneBadge = `<span class="text-[11px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 px-2 py-0.5 rounded-md font-medium flex items-center" title="Proximité à vol d'oiseau calculée"><i class="fa-solid fa-location-crosshairs mr-1 text-indigo-500 dark:text-indigo-400"></i>📍 Proche : ${nearest.zoneName} (${nearest.distanceKm.toFixed(1)} km)</span>`;
      }
    }

    const parentSpot = s.parentId ? appState.spots.find(p => p.id === s.parentId) : null;
    const subSpots = appState.spots.filter(child => child.parentId === s.id);

    let assignmentSelectOptions = '<option value="">-- Rattacher... --</option>';
    validTransits.forEach(t => {
      const isSelected = s.target === t.id ? 'selected' : '';
      assignmentSelectOptions += `<option value="transit:${t.id}" ${isSelected}>Transit: ${t.name}</option>`;
    });
    const totalDays = getTotalDays();
    for (let d = 0; d < totalDays; d++) {
      const isAssignedToDay = assignedDays.includes(`J+${d}`);
      const isSelected = isAssignedToDay ? 'selected' : '';
      const contextDesc = getDayContextDescription(d);
      assignmentSelectOptions += `<option value="day:${d}" ${isSelected}>Jour J+${d} (${deltaToDateStr(d)}) - ${contextDesc}</option>`;
    }

    const el = document.createElement('div');
    el.id = `card-spot-${s.id}`;
    el.className = `bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5 text-xs sm:text-sm shadow-sm ${s.parentId ? 'ml-4 border-l-4 border-l-indigo-500' : ''}`;
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2.5 truncate">
          <i class="fa-solid ${s.parentId ? 'fa-turn-up rotate-90 text-indigo-500 dark:text-indigo-400' : 'fa-location-dot text-emerald-500 dark:text-emerald-400'} shrink-0 cursor-pointer hover:scale-125 transition" onclick="centerMapOnCoords(${s.lat}, ${s.lng})" title="Centrer sur la carte"></i>
          <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">
            <span class="text-slate-900 dark:text-white font-bold truncate block">${s.name}</span>
            ${parentSpot ? `<span class="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center space-x-1 flex-wrap">${nearestZoneBadge} ${attachmentBadges}</div>
      </div>
      ${s.desc ? `<p class="text-xs text-slate-600 dark:text-slate-400">${s.desc}</p>` : ''}
      ${s.url ? `<div><a href="${s.url}" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${s.url}</span></a></div>` : ''}
      ${subSpots.length > 0 ? `<div class="text-[11px] bg-slate-100 dark:bg-slate-900 p-2 rounded-lg text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800"><strong>Sous-spots associés (${subSpots.length}) :</strong> ${subSpots.map(sb => sb.name).join(', ')}</div>` : ''}
      ${s.imageBase64 ? `<div><img src="${s.imageBase64}" class="w-32 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700"></div>` : ''}
      <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
        <div class="flex items-center space-x-1.5">
          <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl transition" title="Centrer sur la carte"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(s.lat, s.lng)}" target="_blank" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl transition" title="Ouvrir dans Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>
          <button onclick="editSpot('${s.id}')" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl transition" title="Éditer le spot"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="createSubSpot('${s.id}')" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded-xl transition text-xs font-semibold" title="Ajouter un sous-spot"><i class="fa-solid fa-folder-plus mr-1"></i>+ Sous-spot</button>
          <button onclick="deleteSpot('${s.id}')" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl transition" title="Supprimer définitivement"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <select onchange="universalAssignSpot('${s.id}', this.value)" class="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium">
          ${assignmentSelectOptions}
        </select>
      </div>
    `;
    spotsContainer.appendChild(el);
  });

  bpContainer.innerHTML = appState.bonsPlans.length === 0 ? '<p class="text-xs sm:text-sm text-slate-500 italic">Aucun bon plan créé</p>' : '';
  appState.bonsPlans.forEach(bp => {
    let bpAttachmentLabel = '<span class="text-[11px] bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-md font-medium">Libre</span>';
    let nearestZoneBadge = '';

    let assignedDaysBp = [];
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d] && appState.dailyBonsPlans[d].includes(bp.id)) assignedDaysBp.push(`J+${d}`);
    });

    if (bp.target) {
      const tObj = validTransits.find(t => t.id === bp.target);
      bpAttachmentLabel = `<span class="text-[11px] bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800/40 px-2 py-0.5 rounded-md font-medium">Transit : ${tObj ? tObj.name : bp.target}</span>`;
    } else if (assignedDaysBp.length > 0) {
      bpAttachmentLabel = `<span class="text-[11px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 px-2 py-0.5 rounded-md font-medium cursor-pointer hover:underline" onclick="jumpToDay(${assignedDaysBp[0].replace('J+', '')})">Jours : ${assignedDaysBp.join(', ')}</span>`;
    } else {
      const nearest = getNearestZoneInfo(bp.lat, bp.lng);
      if (nearest) {
        nearestZoneBadge = `<span class="text-[11px] bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 px-2 py-0.5 rounded-md font-medium flex items-center" title="Proximité à vol d'oiseau calculée"><i class="fa-solid fa-location-crosshairs mr-1 text-indigo-500 dark:text-indigo-400"></i>📍 Proche : ${nearest.zoneName} (${nearest.distanceKm.toFixed(1)} km)</span>`;
      }
    }

    let bpAssignmentOptions = '<option value="">-- Rattacher... --</option>';
    validTransits.forEach(t => {
      const isSelected = bp.target === t.id ? 'selected' : '';
      bpAssignmentOptions += `<option value="transit:${t.id}" ${isSelected}>Transit: ${t.name}</option>`;
    });
    const totalDays = getTotalDays();
    for (let d = 0; d < totalDays; d++) {
      const isAssignedToDay = assignedDaysBp.includes(`J+${d}`);
      const isSelected = isAssignedToDay ? 'selected' : '';
      const contextDesc = getDayContextDescription(d);
      bpAssignmentOptions += `<option value="day:${d}" ${isSelected}>Jour J+${d} (${deltaToDateStr(d)}) - ${contextDesc}</option>`;
    }

    const el = document.createElement('div');
    el.id = `card-bonplan-${bp.id}`;
    el.className = 'bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5 text-xs sm:text-sm shadow-sm';
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2.5 truncate">
          <i class="fa-solid fa-lightbulb text-amber-500 dark:text-amber-400 shrink-0 cursor-pointer hover:scale-125 transition" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" title="Centrer sur la carte"></i>
          <span class="text-slate-900 dark:text-white font-bold truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">${bp.title} <span class="text-xs text-amber-600 dark:text-amber-400 font-normal">(${bp.category})</span></span>
        </div>
        <div class="flex items-center space-x-1 flex-wrap">${nearestZoneBadge} ${bpAttachmentLabel}</div>
      </div>
      ${bp.desc ? `<p class="text-xs text-slate-600 dark:text-slate-400">${bp.desc}</p>` : ''}
      ${bp.url ? `<div><a href="${bp.url}" target="_blank" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      <div class="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 gap-2 flex-wrap">
        <div class="flex items-center space-x-1.5">
          <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl transition" title="Centrer sur la carte"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded-xl transition" title="Ouvrir dans Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>
          <button onclick="editBonPlan('${bp.id}')" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded-xl transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteBonPlan('${bp.id}')" class="p-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 rounded-xl transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <select onchange="universalAssignBonPlan('${bp.id}', this.value)" class="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium">
          ${bpAssignmentOptions}
        </select>
      </div>
    `;
    bpContainer.appendChild(el);
  });
}

function checkCoherence() {
  const alerts = [];
  
  appState.zones.forEach(zone => {
    const zoneHotels = appState.hotels.filter(h => h.zoneId === zone.id);
    if (zoneHotels.length === 0) {
      alerts.push({ type: 'danger', text: `⚠️ La zone "${zone.name}" n'a aucun hébergement rattaché.` });
    } else {
      const computed = getZoneComputedDates();
      const comp = computed[zone.id];
      if (comp) {
        const hotel = zoneHotels[0];
        const radius = hotel.radiusKm !== undefined ? hotel.radiusKm : 50;
        
        for (let d = comp.checkinDay; d < comp.checkoutDay; d++) {
          const daySpots = (appState.dailyItineraries[d] || []).map(id => appState.spots.find(s => s.id === id)).filter(Boolean);
          daySpots.forEach(s => {
            const dist = haversineDistanceKm(hotel.lat, hotel.lng, s.lat, s.lng);
            if (dist > radius) {
              alerts.push({ 
                type: 'warning', 
                text: `⚠️ Le spot "${s.name}" (Jour J+${d}) est situé à ${dist.toFixed(1)} km de l'hébergement "${hotel.name}" (supérieur au rayon de confort de ${radius} km).` 
              });
            }
          });
        }
      }
    }
  });

  const totalDays = getTotalDays();
  const transits = getTransits();
  for (let d = 0; d < totalDays; d++) {
    const daySpots = appState.dailyItineraries[d] || [];
    const hasNightTransit = transits.some(t => t.day === d && t.isNightTransit);
    
    if (daySpots.length === 0 && !hasNightTransit) {
      const dateStr = deltaToDateStr(d);
      alerts.push({
        type: 'info',
        text: `ℹ️ Jour J+${d} (${dateStr}) : Aucun spot n'est actuellement rattaché à cette journée (journée libre ou de repos).`
      });
    }
  }

  const badge = document.getElementById('alertBadge');
  if (badge) {
    if (alerts.length > 0) { badge.innerText = alerts.length; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
  }

  const container = document.getElementById('coherenceList');
  if (container) {
    container.innerHTML = alerts.length === 0 ? '<p class="text-emerald-600 dark:text-emerald-400 text-sm">✅ Aucune anomalie détectée !</p>' : '';
    alerts.forEach(a => {
      const el = document.createElement('div');
      let styleClass = 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200';
      if (a.type === 'danger') {
        styleClass = 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';
      } else if (a.type === 'info') {
        styleClass = 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-800/60 text-sky-900 dark:text-sky-200';
      }
      el.className = `p-3 rounded-xl border text-sm ${styleClass}`;
      el.innerText = a.text;
      container.appendChild(el);
    });
  }
}

function openCoherenceModal() { openModal('coherenceModal'); }

function switchLeftTab(tab) {
  appState.activeTab = tab;
  ['Structure', 'Planning', 'AllSpots'].forEach(t => {
    const content = document.getElementById(`tabContent${t}`);
    const btn = document.getElementById(`tabBtn${t}`);
    if (content) content.classList.add('hidden');
    if (btn) btn.className = 'flex-1 py-2.5 text-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200';
  });

  if (tab === 'structure') {
    document.getElementById('tabContentStructure')?.classList.remove('hidden');
    const btn = document.getElementById('tabBtnStructure');
    if (btn) btn.className = 'flex-1 py-2.5 text-center text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 font-semibold';
    renderStructureUI();
  } else if (tab === 'planning') {
    document.getElementById('tabContentPlanning')?.classList.remove('hidden');
    const btn = document.getElementById('tabBtnPlanning');
    if (btn) btn.className = 'flex-1 py-2.5 text-center text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 font-semibold';
    renderPlanningUI();
  } else {
    document.getElementById('tabContentAllSpots')?.classList.remove('hidden');
    const btn = document.getElementById('tabBtnAllSpots');
    if (btn) btn.className = 'flex-1 py-2.5 text-center text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-500 font-semibold flex items-center justify-center space-x-1.5';
    renderAllSpotsUI();
  }

  setTimeout(() => { if (map) { map.invalidateSize(); renderMapMarkers(); } }, 150);
  renderTimelineHeader();
}

// ==========================================
// 7. ENRICHISSEMENT ET AFFICHAGE OSRM
// ==========================================

async function enrichTripWithOsrmRoutes() {
  if (typeof initRouteCache === 'function') initRouteCache();
  const totalDays = getTotalDays();
  
  const transits = getTransits();
  for (const t of transits) {
    const tCalc = calculateTransitDistances(t);
    const points = [];
    if (tCalc.originPoint) points.push(tCalc.originPoint);
    tCalc.transitSpots.forEach(s => points.push(s));
    if (tCalc.destPoint) points.push(tCalc.destPoint);

    if (points.length >= 2 && typeof fetchOsrmRoute === 'function') {
      const osrmRoutes = await fetchOsrmRoute(points, t.mode);
      if (osrmRoutes) {
        appState.routeCache[t.id] = osrmRoutes;
      }
    }
  }

  for (let d = 0; d < totalDays; d++) {
    const dayRoute = calculateDayRoute(d);
    let points = [];
    if (dayRoute.originPoint) points.push(dayRoute.originPoint);
    dayRoute.transitSpots.forEach(s => points.push(s));
    dayRoute.spots.forEach(s => points.push(s));
    if (dayRoute.destPoint) points.push(dayRoute.destPoint);

    if (points.length >= 2 && typeof fetchOsrmRoute === 'function') {
      const osrmRoutes = await fetchOsrmRoute(points, 'Voiture');
      if (osrmRoutes) {
        appState.routeCache[`day_${d}`] = osrmRoutes;
      }
    }
  }
}

function getEffectiveDistanceAndDuration(cacheKey, fallbackDistanceKm) {
  if (appState.routeCache && appState.routeCache[cacheKey]) {
    const routes = appState.routeCache[cacheKey];
    if (routes && routes.length > 0) {
      return {
        distanceKm: routes[0].distanceKm,
        durationMin: routes[0].durationMin,
        isOsrm: true,
        alternatives: routes.slice(1)
      };
    }
  }
  return {
    distanceKm: fallbackDistanceKm,
    durationMin: null,
    isOsrm: false,
    alternatives: []
  };
}

// ==========================================
// 8. GÉNÉRATION DU ROADBOOK & IMPRESSION PDF
// ==========================================

async function generateRoadbookContent() {
  await enrichTripWithOsrmRoutes();
  const roadbookPrintArea = document.getElementById('roadbookPrintArea');
  if (!roadbookPrintArea) return;
  const computedDates = getZoneComputedDates();
  const totalTripDist = calculateTotalTripDistance();
  const totalDays = getTotalDays();
  const j0DateStr = appState.pivotDate ? new Date(appState.pivotDate).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Non définie';

  let html = `
    <div class="border-b-2 border-slate-900 pb-6 mb-8 avoid-break">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-xs font-bold uppercase tracking-widest text-indigo-600">Carnet de Voyage / Roadbook</span>
          <h1 class="text-4xl font-extrabold text-slate-900 mt-1">${appState.name || 'Mon Voyage'}</h1>
          <p class="text-slate-600 mt-2 text-sm">Feuille de route, itinéraire quotidien et informations pratiques.</p>
        </div>
        <div class="text-right text-sm text-slate-600">
          <p><span class="font-semibold text-slate-900">Départ :</span> ${appState.departurePoint.name}</p>
          <p><span class="font-semibold text-slate-900">Arrivée :</span> ${appState.arrivalPoint.name}</p>
          <p><span class="font-semibold text-slate-900">Date (J0) :</span> ${j0DateStr}</p>
          <p><span class="font-semibold text-slate-900">Durée / Distance :</span> ${totalDays} jours • <strong class="text-indigo-600">${totalTripDist.toFixed(1)} km</strong></p>
        </div>
      </div>
    </div>

    <div class="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-8 avoid-break">
      <h2 class="text-lg font-bold text-slate-800 mb-3 flex items-center"><i class="fas fa-map-signs mr-2 text-indigo-600"></i> Récapitulatif des Secteurs & Hébergements</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
  `;

  appState.zones.forEach(zone => {
    const comp = computedDates[zone.id] || { checkinDay: 0, checkoutDay: 0, nights: 0 };
    const checkinDate = deltaToDateStr(comp.checkinDay);
    const checkoutDate = deltaToDateStr(comp.checkoutDay);
    const zoneHotels = appState.hotels.filter(h => h.zoneId === zone.id);
    const zoneDist = calculateZoneTotalDistance(zone);

    html += `
      <div class="p-3 bg-white rounded-lg border border-slate-200 flex flex-col justify-between" style="border-left: 4px solid ${zone.color}">
        <div class="flex justify-between items-start">
          <div>
            <span class="font-bold text-slate-800 block">${zone.name}</span>
            ${zone.desc ? `<p class="text-xs text-slate-500 mt-0.5">${zone.desc}</p>` : ''}
            <span class="text-xs text-slate-500">J+${comp.checkinDay} ➔ J+${comp.checkoutDay} (${comp.nights} nuit(s) • ${checkinDate} à ${checkoutDate})</span>
            <span class="text-xs font-mono font-bold text-emerald-600 block mt-1">Distance secteur (local) : ${zoneDist.toFixed(1)} km</span>
          </div>
        </div>
        ${zoneHotels.length > 0 ? `
          <div class="mt-2 pt-2 border-t border-slate-100 text-xs text-blue-950 space-y-1">
            <div><i class="fas fa-hotel mr-1 text-blue-600"></i> <strong>Hébergement(s) :</strong> ${zoneHotels.map(h => h.name + (h.desc ? ` (${h.desc})` : '')).join(', ')}</div>
            ${zoneHotels.map(h => h.url ? `<div><a href="${h.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${h.url}</a></div>` : '').join('')}
          </div>
        ` : '<div class="mt-2 text-xs text-amber-600 italic">⚠️ Aucun hébergement configuré (0 nuit)</div>'}
      </div>
    `;
  });

  html += `</div></div><div class="page-break"></div><div class="space-y-6"><h2 class="text-2xl font-bold text-slate-900 border-b pb-2">Programme Calendrier Jour par Jour</h2>`;

  for (let day = 0; day < totalDays; day++) {
    const dateStr = deltaToDateStr(day);
    const currentZone = appState.zones.find(z => { const comp = computedDates[z.id]; return comp && day >= comp.checkinDay && day <= comp.checkoutDay; });
    const dayRoute = calculateDayRoute(day);
    const activeHotel = dayRoute.activeHotel;
    const dayRouteInfo = getEffectiveDistanceAndDuration(`day_${day}`, dayRoute.totalDist);

    const daySpotsIds = appState.dailyItineraries[day] || [];
    const daySpots = daySpotsIds.map(id => appState.spots.find(s => s.id === id)).filter(Boolean);
    const dayBpIds = appState.dailyBonsPlans[day] || [];
    const dayBonsPlans = dayBpIds.map(id => appState.bonsPlans.find(bp => bp.id === id)).filter(Boolean);

    let transitBps = [];
    if (dayRoute.transits && dayRoute.transits.length > 0) {
      const tId = dayRoute.transits[0].id;
      transitBps = appState.bonsPlans.filter(bp => bp.target === tId);
    }

    const durText = dayRouteInfo.durationMin ? ` (~${formatDuration(dayRouteInfo.durationMin)})` : '';

    html += `
      <div class="avoid-break border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Jour J+${day}</span>
            <h3 class="text-lg font-bold text-slate-900">${dateStr}</h3>
          </div>
          <div class="text-right flex items-center space-x-2">
            <span class="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
              Total jour : ${dayRouteInfo.isOsrm ? '🚗 ' : ''}${dayRouteInfo.distanceKm.toFixed(1)} km${durText}
            </span>
            ${currentZone ? `<span class="inline-block px-2.5 py-1 rounded text-xs font-bold text-white" style="background-color: ${currentZone.color}">${currentZone.name}</span>` : '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Sans zone</span>'}
          </div>
        </div>
    `;

    if (dayRoute.transits && dayRoute.transits.length > 0) {
      const t = dayRoute.transits[0];
      const tCalc = calculateTransitDistances(t);
      const tRouteInfo = getEffectiveDistanceAndDuration(t.id, tCalc.totalDist);
      const modeIcon = getTransitModeIcon(t.mode);
      const tDurStr = tRouteInfo.durationMin ? ` (~${formatDuration(tRouteInfo.durationMin)})` : '';
      html += `<div class="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900 flex items-center justify-between"><div><span class="mr-2 text-sm">${modeIcon}</span><strong>${t.name} :</strong> Mode : <em>${t.mode || 'Voiture'}</em>.</div><span class="font-mono font-bold text-emerald-700">${tRouteInfo.isOsrm ? `🚗 ${tRouteInfo.distanceKm.toFixed(1)} km${tDurStr}` : `+${tCalc.totalDist.toFixed(1)} km`}</span></div>`;
    }

    if (activeHotel) {
      html += `<div class="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg text-xs text-blue-900 flex flex-col space-y-1"><div class="flex justify-between items-center"><span><i class="fas fa-hotel mr-1.5 text-blue-600"></i><strong>Hébergement actif :</strong> ${activeHotel.name}</span><span class="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Rayon: ${activeHotel.radiusKm || 50} km</span></div>${activeHotel.desc ? `<div class="text-blue-800 italic">${activeHotel.desc}</div>` : ''}${activeHotel.url ? `<div><a href="${activeHotel.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${activeHotel.url}</a></div>` : ''}</div>`;
    }

    html += `<div class="space-y-1.5"><h4 class="text-xs font-bold text-slate-500 uppercase">Spots prévus</h4>`;
    const combinedDisplaySpots = [...(dayRoute.transitSpots || []), ...daySpots];
    if (combinedDisplaySpots.length === 0) {
      html += `<p class="text-xs text-slate-400 italic">Aucun spot programmé pour cette journée.</p>`;
    } else {
      html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">`;
      combinedDisplaySpots.forEach((s, idx) => {
        const segDist = dayRoute.segmentsDistances[idx] !== undefined ? dayRoute.segmentsDistances[idx] : 0;
        const isTransitSpot = dayRoute.transitSpots && dayRoute.transitSpots.includes(s);
        const parentSpot = s.parentId ? appState.spots.find(p => p.id === s.parentId) : null;

        let segDisplay = `+${segDist.toFixed(1)} km`;
        if (dayRouteInfo.isOsrm && dayRouteInfo.durationMin && dayRoute.totalDist > 0) {
          const ratio = segDist / dayRoute.totalDist;
          const segmentMin = dayRouteInfo.durationMin * ratio;
          const durFormatted = formatDuration(segmentMin);
          segDisplay = `+${segDist.toFixed(1)} km${durFormatted ? ` (~${durFormatted})` : ''}`;
        }

        html += `
          <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div class="font-bold text-slate-800 flex items-center justify-between">
              <span class="flex items-center"><span class="w-4 h-4 rounded-full ${isTransitSpot ? 'bg-amber-600' : 'bg-emerald-600'} text-white text-[10px] flex items-center justify-center mr-1.5 font-mono">${isTransitSpot ? 'T' : idx + 1}</span>${s.name} ${isTransitSpot ? '(Transit)' : ''}</span>
              <span class="text-[10px] text-emerald-600 font-mono">${segDisplay}</span>
            </div>
            ${parentSpot ? `<div class="text-[10px] text-indigo-600 font-medium">↳ Sous-spot de : ${parentSpot.name}</div>` : ''}
            ${s.desc ? `<p class="text-slate-600">${s.desc}</p>` : ''}
            ${s.url ? `<div><a href="${s.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${s.url}</a></div>` : ''}
            ${s.imageBase64 ? `<div class="pt-1"><img src="${s.imageBase64}" class="w-full h-36 object-cover rounded border border-slate-300"></div>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }
    html += `</div>`;

    const allDayBPs = [...transitBps, ...dayBonsPlans];
    if (allDayBPs.length > 0) {
      html += `<div class="space-y-1.5 pt-2"><h4 class="text-xs font-bold text-amber-600 uppercase">Bons Plans du jour</h4><div class="grid grid-cols-1 md:grid-cols-2 gap-2">`;
      allDayBPs.forEach(bp => {
        html += `
          <div class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-xs space-y-1">
            <div class="font-bold text-amber-950 flex justify-between">
              <span><i class="fas fa-lightbulb text-amber-600 mr-1.5"></i>${bp.title}</span>
              <span class="text-[10px] bg-amber-200 px-1.5 py-0.5 rounded text-amber-900">${bp.category}</span>
            </div>
            ${bp.desc ? `<p class="text-amber-900">${bp.desc}</p>` : ''}
            ${bp.url ? `<div><a href="${bp.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${bp.url}</a></div>` : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    }
    html += `</div>`;
  }

  html += `</div><div class="page-break"></div><div class="space-y-6 pt-4"><div class="border-b pb-3"><h2 class="text-2xl font-bold text-slate-900 flex items-center"><i class="fas fa-compass text-amber-500 mr-3"></i> Répertoire Global</h2></div>`;

  if (appState.spots.length === 0 && appState.bonsPlans.length === 0) {
    html += `<p class="text-sm text-slate-400 italic">Aucun élément enregistré.</p>`;
  } else {
    if (appState.spots.length > 0) {
      html += `<div class="avoid-break space-y-3"><h3 class="text-lg font-bold text-slate-800 border-l-4 border-emerald-500 pl-2">Tous les Spots</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;
      appState.spots.forEach(s => {
        const parentSpot = s.parentId ? appState.spots.find(p => p.id === s.parentId) : null;
        html += `
          <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <h4 class="font-bold text-slate-800"><i class="fas fa-location-dot text-emerald-600 mr-1.5"></i>${s.name}</h4>
            ${parentSpot ? `<div class="text-[10px] text-indigo-600 font-medium">↳ Sous-spot de : ${parentSpot.name}</div>` : ''}
            ${s.desc ? `<p class="text-slate-600">${s.desc}</p>` : ''}
            ${s.url ? `<div><a href="${s.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${s.url}</a></div>` : ''}
            ${s.imageBase64 ? `<div class="pt-1"><img src="${s.imageBase64}" class="w-full h-36 object-cover rounded border border-slate-300"></div>` : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    }

    if (appState.bonsPlans.length > 0) {
      html += `<div class="avoid-break space-y-3 pt-4"><h3 class="text-lg font-bold text-slate-800 border-l-4 border-amber-500 pl-2">Tous les Bons Plans</h3><div class="grid grid-cols-1 md:grid-cols-2 gap-3">`;
      appState.bonsPlans.forEach(bp => {
        html += `
          <div class="p-3 bg-amber-50/70 rounded-lg border border-amber-200 text-xs space-y-1">
            <div class="font-bold text-amber-900 flex justify-between">
              <span><i class="fas fa-lightbulb text-amber-600 mr-1.5"></i>${bp.title}</span>
              <span class="text-[10px] bg-amber-200/60 px-1.5 py-0.5 rounded text-amber-800 font-medium">${bp.category}</span>
            </div>
            ${bp.desc ? `<p class="text-amber-800">${bp.desc}</p>` : ''}
            ${bp.url ? `<div><a href="${bp.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${bp.url}</a></div>` : ''}
          </div>
        `;
      });
      html += `</div></div>`;
    }
  }

  html += `</div>`;
  roadbookPrintArea.innerHTML = html;
}
