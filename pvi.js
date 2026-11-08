if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => {
      console.log('Service Worker skipped/failed', err);
    });
  });
}

let appState = {
  viewMode: 'designer',
  name: "Mon Voyage GeoVoyage",
  pivotDate: "2025-11-22",
  currentSelectedDay: 0,
  activeTab: 'structure',
  departurePoint: { name: "Ollainville", lat: 48.591, lng: 2.217 },
  arrivalPoint: { name: "Arrivée", lat: 43.8333, lng: 5.7833 },
  customTransits: [],
  zones: [
    { id: 'z_manosque', name: 'Zone Manosque', desc: 'Secteur Manosque et environs', color: '#6366f1' }
  ],
  hotels: [
    { id: 'h_ibis_manosque', name: 'IBIS Manosque', zoneId: 'z_manosque', desc: '3 nuit(s)', nights: 3, lat: 43.8333, lng: 5.7833, radiusKm: 15, url: '' }
  ],
  spots: [
    { id: 's_beaune', name: 'Beaune', target: 'transit_dep_first', parentId: '', desc: 'Etape spot en transit', lat: 47.0260, lng: 4.8400 }
  ],
  bonsPlans: [
    { id: 'bp_mouette', title: 'La mouette à vélo', category: 'Conseil pratique', target: 'transit_dep_first', lat: 47.0260, lng: 4.8400, desc: '' },
    { id: 'bp_rn7', title: 'Resto de la RN7', category: 'Restaurant', target: 'transit_dep_first', lat: 46.5667, lng: 4.9000, desc: '' }
  ],
  dailyItineraries: {},
  dailyBonsPlans: {},
  transitSpotOrder: {
    'transit_dep_first': ['s_beaune']
  },
  mapFocusMode: false
};

let map = null;
let mapMarkers = [];
let routePolyline = null;
let mapPickMode = null;
let shouldFitBoundsOnce = true;

function saveToLocalStorage() {
  try {
    localStorage.setItem('geoVoyageState', JSON.stringify(appState));
  } catch (e) {
    console.error("Erreur de sauvegarde localStorage", e);
  }
}

function loadFromLocalStorage() {
  try {
    const saved = localStorage.getItem('geoVoyageState');
    if (saved) {
      appState = JSON.parse(saved);
      if (!appState.dailyBonsPlans) appState.dailyBonsPlans = {};
      if (!appState.transitSpotOrder) appState.transitSpotOrder = {};
      if (!appState.customTransits) appState.customTransits = [];
      if (!appState.activeTab) appState.activeTab = 'structure';
      if (!appState.viewMode) appState.viewMode = 'designer';
      if (!appState.name) appState.name = "Mon Voyage GeoVoyage";
      if (appState.mapFocusMode === undefined) appState.mapFocusMode = false;
      if (appState.spots) appState.spots.forEach(s => { if (s.parentId === undefined) s.parentId = ''; });
      return true;
    }
  } catch (e) {
    console.error("Erreur de chargement localStorage", e);
  }
  return false;
}

window.onload = async function() {
  loadFromLocalStorage();
  
  const tripNameInput = document.getElementById('tripNameInput');
  tripNameInput.value = appState.name;
  tripNameInput.addEventListener('input', (e) => {
    appState.name = e.target.value || 'Mon Voyage';
    saveToLocalStorage();
  });

  document.getElementById('pivotDateInput').value = appState.pivotDate;
  document.getElementById('pivotDateInput').addEventListener('change', (e) => {
    appState.pivotDate = e.target.value;
    renderApp();
  });

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
    openPrintRoadbookBtn.addEventListener('click', () => {
      generateRoadbookContent();
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

function loadDemoData() {
  if (appState.zones.length > 0 && !confirm("Voulez-vous charger la démo ? Cela remplacera votre voyage actuel.")) {
    return;
  }
  appState.name = "Voyage Provence Démo";
  document.getElementById('tripNameInput').value = appState.name;
  appState.departurePoint = { name: "Ollainville", lat: 48.591, lng: 2.217 };
  appState.arrivalPoint = { name: "Zone Manosque (Arrivée)", lat: 43.8333, lng: 5.7833 };
  appState.pivotDate = "2025-11-22";
  appState.zones = [
    { id: 'z_manosque', name: 'Zone Manosque', desc: 'Secteur Manosque et environs', color: '#6366f1' }
  ];
  appState.hotels = [
    { id: 'h_ibis_manosque', name: 'IBIS Manosque', zoneId: 'z_manosque', desc: '3 nuit(s)', nights: 3, lat: 43.8333, lng: 5.7833, radiusKm: 15, url: '' }
  ];
  appState.spots = [
    { id: 's_beaune', name: 'Beaune', target: 'transit_dep_first', parentId: '', desc: 'Etape spot en transit', lat: 47.0260, lng: 4.8400 }
  ];
  appState.transitSpotOrder = {
    'transit_dep_first': ['s_beaune']
  };
  appState.bonsPlans = [
    { id: 'bp_mouette', title: 'La mouette à vélo', category: 'Conseil pratique', target: 'transit_dep_first', lat: 47.0260, lng: 4.8400, desc: '' },
    { id: 'bp_rn7', title: 'Resto de la RN7', category: 'Restaurant', target: 'transit_dep_first', lat: 46.5667, lng: 4.9000, desc: '' }
  ];
  appState.customTransits = [];
  appState.dailyItineraries = {};
  appState.dailyBonsPlans = {};
  shouldFitBoundsOnce = true;
  renderApp();
}

function resetTrip() {
  if (!confirm("Voulez-vous vraiment effacer tout le voyage pour en planifier un nouveau ?")) return;
  appState.name = "Mon Voyage";
  document.getElementById('tripNameInput').value = appState.name;
  appState.zones = []; appState.hotels = []; appState.spots = []; appState.bonsPlans = []; appState.customTransits = [];
  appState.dailyItineraries = {}; appState.dailyBonsPlans = {}; appState.transitSpotOrder = {}; appState.currentSelectedDay = 0;
  shouldFitBoundsOnce = true;
  saveToLocalStorage();
  renderApp();
}

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
    modeBtnDesigner.className = 'px-3 py-1.5 rounded-lg transition text-slate-400 hover:text-white';
    modeBtnTraveler.className = 'px-3 py-1.5 rounded-lg transition bg-indigo-600 text-white';
    designerElements.forEach(el => el.classList.add('hidden'));
    renderTravelerUI();
  } else {
    travelerView.classList.add('hidden');
    designerView.classList.remove('hidden');
    modeBtnDesigner.className = 'px-3 py-1.5 rounded-lg transition bg-indigo-600 text-white';
    modeBtnTraveler.className = 'px-3 py-1.5 rounded-lg transition text-slate-400 hover:text-white';
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
    icon.className = 'fa-solid fa-compress text-indigo-400';
  } else {
    leftCol.classList.remove('hidden');
    rightCol.className = 'lg:col-span-7 flex flex-col h-[500px] lg:h-auto min-h-[400px] relative';
    icon.className = 'fa-solid fa-expand text-indigo-400';
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

function deltaToDateObj(deltaDays) {
  const pivot = new Date(appState.pivotDate);
  pivot.setDate(pivot.getDate() + parseInt(deltaDays || 0));
  return pivot;
}

function deltaToDateStr(deltaDays) {
  return deltaToDateObj(deltaDays).toISOString().split('T')[0];
}

function deltaToFormattedDateStr(deltaDays) {
  const d = deltaToDateObj(deltaDays);
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function deltaToShortDateStr(deltaDays) {
  const d = deltaToDateObj(deltaDays);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
    btn.className = `px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition flex items-center space-x-1.5 ${isSelected ? 'ring-2 ring-white shadow-lg scale-105' : 'opacity-80 hover:opacity-100'}`;
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

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getNearestZoneInfo(lat, lng) {
  if (!appState.zones || appState.zones.length === 0) return null;
  let minDistance = Infinity;
  let nearestZone = null;

  appState.zones.forEach(zone => {
    const hotel = appState.hotels.find(h => h.zoneId === zone.id);
    const refLat = hotel ? hotel.lat : null;
    const refLng = hotel ? hotel.lng : null;

    if (refLat !== null && refLng !== null) {
      const dist = haversineDistanceKm(lat, lng, refLat, refLng);
      if (dist < minDistance) {
        minDistance = dist;
        nearestZone = zone;
      }
    }
  });

  if (nearestZone && minDistance !== Infinity) {
    return { zoneName: nearestZone.name, color: nearestZone.color, distanceKm: minDistance };
  }
  return null;
}

function getGoogleMapsUrl(lat, lng) { return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`; }
function getGeoUrl(lat, lng) { return `geo:${lat},${lng}?q=${lat},${lng}`; }

function getTransitModeIcon(mode) {
  switch (mode) {
    case 'Autocar': return '🚌';
    case 'Transports en commun': return '🚆';
    case 'Bateau': return '⛴️';
    case 'Avion': return '✈️';
    case 'Vélo': return '🚲';
    case 'À pied': return '🥾';
    default: return '🚗';
  }
}

function getZoneComputedDates() {
  let currentDay = 0;
  let mapping = {};
  appState.zones.forEach(zone => {
    const hotel = appState.hotels.find(h => h.zoneId === zone.id);
    const nights = hotel ? (parseInt(hotel.nights) || 1) : 1;
    const checkinDay = currentDay;
    const checkoutDay = currentDay + nights;
    mapping[zone.id] = { checkinDay, checkoutDay, nights };
    currentDay = checkoutDay;
  });
  return mapping;
}

function getTotalDays() {
  const computed = getZoneComputedDates();
  let maxDay = 0;
  appState.zones.forEach(z => {
    if (computed[z.id] && computed[z.id].checkoutDay > maxDay) maxDay = computed[z.id].checkoutDay;
  });
  return Math.max(1, maxDay + 1);
}

function getTransits() {
  const computed = getZoneComputedDates();
  const transits = [];
  if (appState.zones.length === 0) return transits;

  const firstZone = appState.zones[0];
  transits.push({ id: 'transit_dep_first', name: `Transit Départ ➔ ${firstZone.name}`, day: 0, mode: 'Voiture', fromType: 'dep', toType: 'zone', toZone: firstZone });

  for (let i = 0; i < appState.zones.length - 1; i++) {
    const from = appState.zones[i];
    const to = appState.zones[i+1];
    const compFrom = computed[from.id];
    transits.push({ id: `transit_${from.id}_${to.id}`, name: `Transit : ${from.name} ➔ ${to.name}`, day: compFrom ? compFrom.checkoutDay : 0, mode: 'Voiture', from, to });
  }

  (appState.customTransits || []).forEach(ct => {
    const existing = transits.find(t => t.id === ct.id);
    if (existing) {
      existing.mode = ct.mode || existing.mode;
      existing.desc = ct.desc || existing.desc;
      existing.name = ct.name || existing.name;
    } else {
      transits.push(ct);
    }
  });

  const lastZone = appState.zones[appState.zones.length - 1];
  const compLast = computed[lastZone.id];
  transits.push({ id: 'transit_last_arr', name: `Transit ${lastZone.name} ➔ Arrivée (Retour)`, day: compLast ? compLast.checkoutDay : 0, mode: 'Voiture', fromType: 'zone', fromZone: lastZone, toType: 'arr' });

  return transits;
}

function getDayContextDescription(curDay) {
  const computed = getZoneComputedDates();
  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  if (!currentZone) return "Hors secteur (Départ / Arrivée)";
  const activeHotel = appState.hotels.find(h => {
    const comp = computed[h.zoneId];
    return comp && curDay >= comp.checkinDay && curDay < comp.checkoutDay;
  });
  const hotelStr = activeHotel ? ` / Hôtel : ${activeHotel.name}` : '';
  return `Secteur : ${currentZone.name}${hotelStr}`;
}

function calculateTransitDistances(transit) {
  let originPoint = null;
  let destPoint = null;

  if (transit.id === 'transit_dep_first') {
    originPoint = appState.departurePoint;
    destPoint = transit.toZone ? (appState.hotels.find(h => h.zoneId === transit.toZone.id) || appState.arrivalPoint) : appState.arrivalPoint;
  } else if (transit.id === 'transit_last_arr') {
    originPoint = transit.fromZone ? (appState.hotels.find(h => h.zoneId === transit.fromZone.id) || appState.departurePoint) : appState.departurePoint;
    destPoint = appState.arrivalPoint;
  } else {
    originPoint = transit.from ? (appState.hotels.find(h => h.zoneId === transit.from.id) || appState.departurePoint) : appState.departurePoint;
    destPoint = transit.to ? (appState.hotels.find(h => h.zoneId === transit.to.id) || appState.arrivalPoint) : appState.arrivalPoint;
  }

  const rawTransitSpots = appState.spots.filter(s => s.target === transit.id);
  if (!appState.transitSpotOrder) appState.transitSpotOrder = {};
  let orderedIds = appState.transitSpotOrder[transit.id] || [];
  rawTransitSpots.forEach(s => { if (!orderedIds.includes(s.id)) orderedIds.push(s.id); });
  orderedIds = orderedIds.filter(id => rawTransitSpots.some(s => s.id === id));
  appState.transitSpotOrder[transit.id] = orderedIds;

  const transitSpots = orderedIds.map(id => rawTransitSpots.find(s => s.id === id)).filter(Boolean);

  let points = [];
  if (originPoint) points.push({ name: originPoint.name || "Départ / Hébergement", lat: originPoint.lat, lng: originPoint.lng });
  transitSpots.forEach(s => points.push({ name: s.name, lat: s.lat, lng: s.lng }));
  if (destPoint) points.push({ name: destPoint.name || "Arrivée / Hébergement", lat: destPoint.lat, lng: destPoint.lng });

  let segments = [];
  let totalDist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const d = haversineDistanceKm(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
    segments.push({ fromName: points[i].name, toName: points[i+1].name, distanceKm: d });
    totalDist += d;
  }
  return { originPoint, destPoint, transitSpots, segments, totalDist };
}

function calculateDayRoute(curDay) {
  const daySpotIds = appState.dailyItineraries[curDay] || [];
  const spots = daySpotIds.map(id => appState.spots.find(s => s.id === id)).filter(Boolean);
  const computed = getZoneComputedDates();
  
  const activeHotel = appState.hotels.find(h => {
    const comp = computed[h.zoneId];
    return comp && curDay >= comp.checkinDay && curDay < comp.checkoutDay;
  });

  let originPoint = null;
  let destPoint = null;
  let transitSpots = [];

  const transits = getTransits().filter(t => t.day === curDay);
  const isTransit = transits.length > 0;

  if (isTransit) {
    const t = transits[0];
    const tCalc = calculateTransitDistances(t);
    originPoint = tCalc.originPoint;
    destPoint = tCalc.destPoint;
    transitSpots = tCalc.transitSpots;
  } else if (activeHotel) {
    originPoint = activeHotel;
    destPoint = activeHotel;
  } else if (curDay === 0) {
    originPoint = appState.departurePoint;
    destPoint = appState.zones.length > 0 ? (appState.hotels.find(h => h.zoneId === appState.zones[0].id) || appState.arrivalPoint) : appState.arrivalPoint;
  } else {
    originPoint = appState.arrivalPoint;
    destPoint = appState.arrivalPoint;
  }

  let fullCoords = [];
  if (originPoint) fullCoords.push([originPoint.lat, originPoint.lng]);
  transitSpots.forEach(s => fullCoords.push([s.lat, s.lng]));
  spots.forEach(s => fullCoords.push([s.lat, s.lng]));
  if (destPoint) fullCoords.push([destPoint.lat, destPoint.lng]);

  let segmentsDistances = [];
  let totalDist = 0;
  for (let i = 0; i < fullCoords.length - 1; i++) {
    const d = haversineDistanceKm(fullCoords[i][0], fullCoords[i][1], fullCoords[i+1][0], fullCoords[i+1][1]);
    segmentsDistances.push(d);
    totalDist += d;
  }
  return { fullCoords, segmentsDistances, totalDist, originPoint, destPoint, spots, transits, transitSpots, activeHotel };
}

function calculateZoneTotalDistance(zone) {
  const computed = getZoneComputedDates();
  const comp = computed[zone.id];
  if (!comp) return 0;
  let zoneDist = 0;
  for (let d = comp.checkinDay + 1; d < comp.checkoutDay; d++) {
    zoneDist += calculateDayRoute(d).totalDist;
  }
  return zoneDist;
}

function calculateTotalTripDistance() {
  let tripDist = 0;
  const totalDays = getTotalDays();
  for (let d = 0; d < totalDays; d++) tripDist += calculateDayRoute(d).totalDist;
  return tripDist;
}

function renderApp() {
  const maxDays = getTotalDays();
  if (appState.currentSelectedDay >= maxDays) appState.currentSelectedDay = Math.max(0, maxDays - 1);

  document.getElementById('totalDaysBadge').innerText = `${maxDays} jours`;
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

function cleanOrphanTransitsAndTargets() {
  const validTransits = getTransits().map(t => t.id);
  appState.spots.forEach(s => { if (s.target && !validTransits.includes(s.target)) s.target = ''; });
  appState.bonsPlans.forEach(bp => { if (bp.target && !validTransits.includes(bp.target)) bp.target = ''; });
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

function renderTravelerUI() {
  const curDay = appState.currentSelectedDay;
  const formattedDate = deltaToFormattedDateStr(curDay);
  const shortDate = deltaToShortDateStr(curDay);

  document.getElementById('travelerDayLabel').innerText = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
  document.getElementById('travelerDayDate').innerText = `${shortDate} (J+${curDay})`;

  const dayRoute = calculateDayRoute(curDay);
  const computed = getZoneComputedDates();
  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  const activeHotel = dayRoute.activeHotel;

  const banner = document.getElementById('travelerContextBanner');
  if (currentZone) {
    banner.className = 'p-4 rounded-2xl border text-sm bg-indigo-950/50 border-indigo-800/80 text-indigo-200 shadow-md space-y-2';
    banner.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold"><i class="fa-solid fa-map-pin text-indigo-400 mr-2"></i>Secteur : ${currentZone.name}</span>
      </div>
      ${activeHotel ? `
        <div class="pt-2 border-t border-indigo-900/60 flex items-center justify-between text-xs">
          <div>
            <i class="fa-solid fa-hotel text-blue-400 mr-1.5"></i><strong>Hôtel :</strong> ${activeHotel.name}
            ${activeHotel.desc ? `<div class="text-slate-300 mt-0.5 text-[11px] italic">${activeHotel.desc}</div>` : ''}
          </div>
          <div class="flex space-x-2 shrink-0">
            <button onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})" class="bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">Centrer</button>
            <a href="${getGoogleMapsUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">Maps</a>
            <a href="${getGeoUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="bg-sky-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">GPS</a>
          </div>
        </div>` : ''}
    `;
  } else {
    banner.className = 'p-4 rounded-2xl border text-sm bg-slate-950 border-slate-800 text-slate-400 shadow-md';
    banner.innerHTML = `<i class="fa-solid fa-circle-info mr-2"></i>Aucun secteur spécifique aujourd'hui.`;
  }

  const routeContainer = document.getElementById('travelerRouteList');
  routeContainer.innerHTML = '';

  const daySpotIds = appState.dailyItineraries[curDay] || [];
  const dayBpIds = appState.dailyBonsPlans[curDay] || [];

  if (daySpotIds.length === 0 && dayBpIds.length === 0 && !activeHotel) {
    routeContainer.innerHTML = '<p class="text-sm text-slate-500 italic py-4 text-center">Aucune étape enregistrée pour cette journée.</p>';
  } else {
    if (activeHotel) {
      const hotelEl = document.createElement('div');
      hotelEl.className = 'bg-blue-950/30 border border-blue-900/50 rounded-2xl p-4 space-y-2 shadow-sm';
      hotelEl.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-blue-200 font-bold text-sm truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})"><i class="fa-solid fa-hotel text-blue-400 mr-2"></i>Hébergement : ${activeHotel.name}</span>
        </div>
        ${activeHotel.desc ? `<p class="text-xs text-blue-100">${activeHotel.desc}</p>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-blue-900/40">
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

      const el = document.createElement('div');
      el.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5 shadow-sm';
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate">
            <span class="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
            <div class="truncate">
              <span class="text-white font-bold text-sm truncate block cursor-pointer hover:text-indigo-400" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})">${spot.name}</span>
              ${parentSpot ? `<span class="text-[11px] text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
            </div>
          </div>
          <span class="text-xs text-emerald-400 font-mono shrink-0">+${segDist.toFixed(1)} km</span>
        </div>
        ${spot.desc ? `<p class="text-xs text-slate-300">${spot.desc}</p>` : ''}
        ${spot.imageBase64 ? `<div><img src="${spot.imageBase64}" class="w-full h-40 object-cover rounded-xl border border-slate-700"></div>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-slate-800">
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
      el.className = 'bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 space-y-2 shadow-sm';
      el.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-amber-200 font-bold text-sm truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})"><i class="fa-solid fa-lightbulb text-amber-400 mr-2"></i>${bp.title} (${bp.category})</span>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-100">${bp.desc}</p>` : ''}
        <div class="flex space-x-2 pt-2 border-t border-amber-900/40">
          <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="py-2 px-3 bg-indigo-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-crosshairs mr-1"></i> Centrer</button>
          <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-location-arrow mr-1.5"></i> Maps</a>
          <a href="${getGeoUrl(bp.lat, bp.lng)}" target="_blank" class="flex-1 py-2 bg-sky-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center shadow"><i class="fa-solid fa-compass mr-1.5"></i> GPS</a>
        </div>
      `;
      routeContainer.appendChild(el);
    });
  }
  document.getElementById('travelerDayDistance').innerText = dayRoute.totalDist.toFixed(1) + ' km';
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
  const depTransitSpots = appState.spots.filter(s => s.target === 'transit_dep_first');
  const depTransitBps = appState.bonsPlans.filter(bp => bp.target === 'transit_dep_first');

  const depEl = document.createElement('div');
  depEl.id = `card-endpoint-departure`;
  depEl.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm';
  
  let depTransitSpotsHtml = depTransitSpots.length > 0 ? depTransitSpots.map((s, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-900/80 rounded border border-slate-800/60">
      <span class="text-slate-300 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${idx + 1}) ${s.name}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editSpot('${s.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignSpot('${s.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  let depTransitBpsHtml = depTransitBps.length > 0 ? depTransitBps.map((bp, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-950/20 rounded border border-amber-900/30">
      <span class="text-amber-200 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">(${idx + 1}) ${bp.title}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editBonPlan('${bp.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignBonPlan('${bp.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  depEl.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="truncate cursor-pointer" onclick="centerMapOnCoords(${appState.departurePoint.lat}, ${appState.departurePoint.lng})">
        <h4 class="font-bold text-sm text-white flex items-center"><i class="fa-solid fa-flag-checkered text-emerald-500 mr-2"></i>${appState.departurePoint.name}</h4>
        <p class="text-xs text-slate-400 font-mono">${appState.departurePoint.lat.toFixed(3)}, ${appState.departurePoint.lng.toFixed(3)}</p>
      </div>
      <div class="flex items-center space-x-1">
        <button onclick="centerMapOnCoords(${appState.departurePoint.lat}, ${appState.departurePoint.lng})" class="p-1.5 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="openEndpointModal('departure')" class="p-1.5 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
      </div>
    </div>
    ${depTransit ? `
      <div class="mt-2 pt-2 border-t border-slate-800/80 text-xs space-y-2 bg-slate-900/50 p-2.5 rounded-lg">
        <div class="font-semibold text-slate-200 flex justify-between items-center">
          <span>${getTransitModeIcon(depTransit.mode)} ${depTransit.name} (${depTransit.mode || 'Voiture'})</span>
          <span class="text-emerald-400 font-mono">${depTransitCalc ? depTransitCalc.totalDist.toFixed(1) : 0} km</span>
        </div>
        ${depTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-400 font-semibold block">Spots :</span>${depTransitSpotsHtml}</div>` : ''}
        ${depTransitBps.length > 0 ? `<div class="space-y-1"><span class="text-slate-400 font-semibold block">Bons plans :</span>${depTransitBpsHtml}</div>` : ''}
        <div class="text-right pt-1">
          <button onclick="editTransitModal('${depTransit.id}')" class="p-1 text-slate-400 hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
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
      <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-900/80 rounded border border-slate-800/60">
        <span class="text-slate-300 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${item.spot.lat}, ${item.spot.lng})">(${idx + 1}) ${item.spot.name}</span>
        <div class="flex items-center space-x-1 shrink-0">
          <button onclick="centerMapOnCoords(${item.spot.lat}, ${item.spot.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <button onclick="editSpot('${item.spot.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="detachSpotFromDay(${item.day}, '${item.spot.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
        </div>
      </div>
    `).join('') : '';

    let zoneBpsHtml = zoneBps.length > 0 ? zoneBps.map((item, idx) => `
      <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-950/20 rounded border border-amber-900/30">
        <span class="text-amber-200 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${item.bonPlan.lat}, ${item.bonPlan.lng})">(${idx + 1}) ${item.bonPlan.title}</span>
        <div class="flex items-center space-x-1 shrink-0">
          <button onclick="centerMapOnCoords(${item.bonPlan.lat}, ${item.bonPlan.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <button onclick="editBonPlan('${item.bonPlan.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="detachBonPlanFromDay(${item.day}, '${item.bonPlan.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
        </div>
      </div>
    `).join('') : '';

    const zoneEl = document.createElement('div');
    zoneEl.id = `card-zone-${zone.id}`;
    zoneEl.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3 shadow-sm';
    
    let html = `
      <div class="border-b border-slate-800 pb-3" style="border-left: 4px solid ${zone.color}">
        <div class="pl-2 space-y-1">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-sm text-white">${zone.name}</h4>
            <div class="flex items-center space-x-1 shrink-0">
              ${index > 0 ? `<button onclick="moveZoneOrder(${index}, -1)" class="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>` : ''}
              ${index < appState.zones.length - 1 ? `<button onclick="moveZoneOrder(${index}, 1)" class="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>` : ''}
              <button onclick="editZone('${zone.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteZone('${zone.id}')" class="p-1 hover:bg-slate-800 text-red-400 rounded transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
          <div class="cursor-pointer hover:opacity-80 inline-block transition" onclick="jumpToDay(${comp.checkinDay})" title="Cliquer pour aller au premier jour J+${comp.checkinDay} dans le planning">
            <span class="text-xs text-indigo-300 font-mono font-bold bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800/60 flex items-center w-fit">
              <i class="fa-solid fa-calendar-days mr-1.5 text-indigo-400"></i>J+${comp.checkinDay} ➔ J+${comp.checkoutDay} (${comp.nights} nuit(s)) <i class="fa-solid fa-arrow-right ml-1 text-[10px]"></i>
            </span>
          </div>
          <div class="flex items-center space-x-3 text-xs text-slate-400 flex-wrap pt-1">
            <span>🗓️ ${checkinDate} au ${checkoutDate}</span>
            <span class="text-emerald-400 font-mono">📍 Bilan secteur : ${zoneDist.toFixed(1)} km</span>
          </div>
        </div>
      </div>

      ${zoneSpots.length > 0 ? `<div class="space-y-1 bg-slate-900/50 p-2.5 rounded-lg"><span class="text-xs font-semibold text-slate-400 block">Spots programmés :</span>${zoneSpotsHtml}</div>` : ''}
      ${zoneBps.length > 0 ? `<div class="space-y-1 bg-slate-900/50 p-2.5 rounded-lg"><span class="text-xs font-semibold text-slate-400 block">Bons plans du secteur :</span>${zoneBpsHtml}</div>` : ''}

      <div class="space-y-2">
        <div class="text-xs font-semibold text-slate-400">Hébergements de la zone</div>
    `;

    if (zoneHotels.length === 0) {
      html += `<div class="text-xs text-amber-400 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/60 flex items-center justify-between">
        <span><i class="fa-solid fa-triangle-exclamation mr-1.5"></i> Aucun hébergement (0 nuit) !</span>
        <button onclick="openHotelModal()" class="bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs font-semibold">+ Hébergement</button>
      </div>`;
    } else {
      zoneHotels.forEach(h => {
        html += `
          <div id="card-hotel-${h.id}" class="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between text-xs">
            <div class="truncate cursor-pointer hover:opacity-80" onclick="centerMapOnCoords(${h.lat}, ${h.lng})">
              <span class="text-white font-semibold flex items-center"><i class="fa-solid fa-hotel text-blue-400 mr-1.5"></i>${h.name}</span>
              <span class="text-slate-400 block truncate">${h.nights || 0} nuit(s) • Rayon : ${h.radiusKm || 15} km</span>
              ${h.desc ? `<span class="text-slate-300 block italic truncate mt-0.5 text-[11px]">${h.desc}</span>` : ''}
            </div>
            <div class="flex items-center space-x-1 shrink-0 ml-2">
              <button onclick="centerMapOnCoords(${h.lat}, ${h.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
              <button onclick="editHotel('${h.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="deleteHotel('${h.id}')" class="p-1 hover:bg-slate-800 text-red-400 rounded transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
            </div>
          </div>
        `;
      });
    }

    html += `</div>`;

    const nextTransitId = index < appState.zones.length - 1 ? `transit_${zone.id}_${appState.zones[index+1].id}` : null;
    const nextTransit = nextTransitId ? getTransits().find(t => t.id === nextTransitId) : null;
    const nextTransitCalc = nextTransit ? calculateTransitDistances(nextTransit) : null;
    const nextTransitSpots = nextTransit ? appState.spots.filter(s => s.target === nextTransit.id) : [];

    if (nextTransit) {
      html += `
        <div class="mt-3 pt-3 border-t border-slate-800 text-xs space-y-2 bg-slate-900/50 p-2.5 rounded-lg">
          <div class="font-semibold text-slate-200 flex justify-between items-center">
            <span>${getTransitModeIcon(nextTransit.mode)} ${nextTransit.name} (${nextTransit.mode || 'Voiture'})</span>
            <span class="text-emerald-400 font-mono">${nextTransitCalc ? nextTransitCalc.totalDist.toFixed(1) : 0} km</span>
          </div>
          ${nextTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-400 font-semibold block">Spots en transit :</span>${nextTransitSpots.map((s, sIdx) => `<div class="flex items-center justify-between py-0.5 px-2 bg-slate-900 rounded border border-slate-800"><span class="text-slate-300 cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${sIdx + 1}) ${s.name}</span><div class="flex space-x-1"><button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="text-emerald-400 p-1" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button><button onclick="editSpot('${s.id}')" class="text-indigo-400 p-1"><i class="fa-solid fa-pen-to-square"></i></button></div></div>`).join('')}</div>` : ''}
          <div class="text-right pt-1">
            <button onclick="editTransitModal('${nextTransit.id}')" class="p-1 text-slate-400 hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
          </div>
        </div>
      `;
    }

    zoneEl.innerHTML = html;
    container.appendChild(zoneEl);
  });

  const arrTransit = getTransits().find(t => t.id === 'transit_last_arr');
  const arrTransitCalc = arrTransit ? calculateTransitDistances(arrTransit) : null;
  const arrTransitSpots = appState.spots.filter(s => s.target === 'transit_last_arr');
  const arrTransitBps = appState.bonsPlans.filter(bp => bp.target === 'transit_last_arr');

  const arrEl = document.createElement('div');
  arrEl.id = `card-endpoint-arrival`;
  arrEl.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm';

  let arrTransitSpotsHtml = arrTransitSpots.length > 0 ? arrTransitSpots.map((s, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-slate-900/80 rounded border border-slate-800/60">
      <span class="text-slate-300 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">(${idx + 1}) ${s.name}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editSpot('${s.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignSpot('${s.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  let arrTransitBpsHtml = arrTransitBps.length > 0 ? arrTransitBps.map((bp, idx) => `
    <div class="flex items-center justify-between text-xs py-1 px-2 bg-amber-950/20 rounded border border-amber-900/30">
      <span class="text-amber-200 font-medium cursor-pointer hover:text-emerald-400" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">(${idx + 1}) ${bp.title}</span>
      <div class="flex items-center space-x-1 shrink-0">
        <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="editBonPlan('${bp.id}')" class="p-1 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
        <button onclick="unassignBonPlan('${bp.id}')" class="p-1 hover:bg-slate-800 text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
      </div>
    </div>
  `).join('') : '';

  arrEl.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="truncate cursor-pointer" onclick="centerMapOnCoords(${appState.arrivalPoint.lat}, ${appState.arrivalPoint.lng})">
        <h4 class="font-bold text-sm text-white flex items-center"><i class="fa-solid fa-house-flag text-blue-500 mr-2"></i>${appState.arrivalPoint.name}</h4>
        <p class="text-xs text-slate-400 font-mono">${appState.arrivalPoint.lat.toFixed(3)}, ${appState.arrivalPoint.lng.toFixed(3)}</p>
      </div>
      <div class="flex items-center space-x-1">
        <button onclick="centerMapOnCoords(${appState.arrivalPoint.lat}, ${appState.arrivalPoint.lng})" class="p-1.5 hover:bg-slate-800 text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
        <button onclick="openEndpointModal('arrival')" class="p-1.5 hover:bg-slate-800 text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
      </div>
    </div>
    ${arrTransit ? `
      <div class="mt-2 pt-2 border-t border-slate-800/80 text-xs space-y-2 bg-slate-900/50 p-2.5 rounded-lg">
        <div class="font-semibold text-slate-200 flex justify-between items-center">
          <span>${getTransitModeIcon(arrTransit.mode)} ${arrTransit.name} (${arrTransit.mode || 'Voiture'})</span>
          <span class="text-emerald-400 font-mono">${arrTransitCalc ? arrTransitCalc.totalDist.toFixed(1) : 0} km</span>
        </div>
        ${arrTransitSpots.length > 0 ? `<div class="space-y-1"><span class="text-slate-400 font-semibold block">Spots :</span>${arrTransitSpotsHtml}</div>` : ''}
        ${arrTransitBps.length > 0 ? `<div class="space-y-1"><span class="text-slate-400 font-semibold block">Bons plans :</span>${arrTransitBpsHtml}</div>` : ''}
        <div class="text-right pt-1">
          <button onclick="editTransitModal('${arrTransit.id}')" class="p-1 text-slate-400 hover:text-indigo-400 text-xs transition"><i class="fa-solid fa-pen-to-square mr-1"></i>Configurer transit</button>
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

function renderPlanningUI() {
  const curDay = appState.currentSelectedDay;
  const dateStr = deltaToDateStr(curDay);

  document.getElementById('selectedDayLabel').innerText = `Jour J+${curDay}`;
  document.getElementById('selectedDayDate').innerText = dateStr;

  const dayRoute = calculateDayRoute(curDay);
  const computed = getZoneComputedDates();
  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  const activeHotel = dayRoute.activeHotel;

  const banner = document.getElementById('dayContextBanner');
  if (dayRoute.transits && dayRoute.transits.length > 0) {
    const t = dayRoute.transits[0];
    const tCalc = calculateTransitDistances(t);
    const modeIcon = getTransitModeIcon(t.mode);
    banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-amber-950/40 border-amber-800/80 text-amber-200 flex justify-between items-center flex-wrap gap-2';
    banner.innerHTML = `<div><span class="mr-2 text-base">${modeIcon}</span><strong>${t.name} :</strong> Mode : <em>${t.mode || 'Voiture'}</em> • Distance transit : <span class="text-emerald-400 font-mono font-bold">${tCalc.totalDist.toFixed(1)} km</span>.</div><button onclick="editTransitModal('${t.id}')" class="bg-amber-800/60 hover:bg-amber-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold"><i class="fa-solid fa-gear mr-1"></i>Configurer</button>`;
  } else if (currentZone) {
    banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-indigo-950/40 border-indigo-800/80 text-indigo-200 flex justify-between items-center flex-wrap gap-2';
    banner.innerHTML = `<div><i class="fa-solid fa-map-pin text-indigo-400 mr-2"></i>Secteur actif : <strong>${currentZone.name}</strong></div>${activeHotel ? `<span class="text-xs bg-indigo-900 px-2.5 py-1 rounded-lg text-indigo-300 cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})"><i class="fa-solid fa-hotel mr-1"></i>${activeHotel.name}</span>` : ''}`;
  } else {
    banner.className = 'p-3.5 rounded-xl border text-xs sm:text-sm bg-slate-950 border-slate-800 text-slate-400';
    banner.innerHTML = `<i class="fa-solid fa-circle-info mr-2"></i>Aucun secteur défini pour cette journée.`;
  }

  const addSelect = document.getElementById('addSpotToDaySelect');
  addSelect.innerHTML = '<option value="">-- Choisir un spot --</option>';
  appState.spots.forEach(s => { 
    const parentSpot = s.parentId ? appState.spots.find(p => p.id === s.parentId) : null;
    const label = parentSpot ? `↳ ${s.name} (Sous-spot de ${parentSpot.name})` : s.name;
    addSelect.innerHTML += `<option value="${s.id}">${label}</option>`; 
  });

  const addBpSelect = document.getElementById('addBonPlanToDaySelect');
  addBpSelect.innerHTML = '<option value="">-- Choisir un bon plan --</option>';
  appState.bonsPlans.forEach(bp => { addBpSelect.innerHTML += `<option value="${bp.id}">${bp.title} (${bp.category})</option>`; });

  const routeContainer = document.getElementById('dayRouteList');
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
      hotelItem.className = 'bg-blue-950/30 border border-blue-900/50 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
      hotelItem.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})">
            <i class="fa-solid fa-hotel text-blue-400 shrink-0 text-base"></i>
            <span class="text-blue-200 font-semibold truncate">Hébergement : ${activeHotel.name}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${activeHotel.lat}, ${activeHotel.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(activeHotel.lat, activeHotel.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editHotel('${activeHotel.id}')" class="p-1.5 text-slate-400 hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        </div>
        ${activeHotel.desc ? `<p class="text-xs text-blue-100/90 pl-6">${activeHotel.desc}</p>` : ''}
      `;
      routeContainer.appendChild(hotelItem);
    }

    if (dayRoute.originPoint && !activeHotel) {
      const originItem = document.createElement('div');
      originItem.id = `card-endpoint-${dayRoute.originPoint.id || 'dep'}`;
      originItem.className = 'bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-xs sm:text-sm flex justify-between items-center text-slate-400';
      originItem.innerHTML = `
        <span class="cursor-pointer hover:text-white" onclick="centerMapOnCoords(${dayRoute.originPoint.lat}, ${dayRoute.originPoint.lng})"><i class="fa-solid fa-house text-indigo-400 mr-2"></i>Départ : <strong>${dayRoute.originPoint.name || 'Hébergement / Point'}</strong></span>
        <div class="flex space-x-1">
          <button onclick="centerMapOnCoords(${dayRoute.originPoint.lat}, ${dayRoute.originPoint.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(dayRoute.originPoint.lat, dayRoute.originPoint.lng)}" target="_blank" class="p-1.5 text-slate-500 hover:text-emerald-400" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
        </div>
      `;
      routeContainer.appendChild(originItem);
    }

    if (dayRoute.transitSpots && dayRoute.transitSpots.length > 0) {
      dayRoute.transitSpots.forEach((ts, tIdx) => {
        const transitSegDist = dayRoute.segmentsDistances[tIdx] !== undefined ? dayRoute.segmentsDistances[tIdx] : 0;
        const parentSpot = ts.parentId ? appState.spots.find(p => p.id === ts.parentId) : null;
        
        const tItem = document.createElement('div');
        tItem.id = `card-spot-${ts.id}`;
        tItem.className = 'bg-amber-950/20 border border-amber-800/50 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
        tItem.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2 truncate">
              <span class="w-6 h-6 rounded-full bg-amber-600 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer" onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})" title="Centrer">T</span>
              <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})">
                <span class="text-amber-200 font-semibold truncate block">${ts.name} <span class="text-xs text-amber-400">(Transit)</span></span>
                ${parentSpot ? `<span class="text-[11px] text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
              </div>
            </div>
            <div class="flex items-center space-x-1 shrink-0">
              <button onclick="centerMapOnCoords(${ts.lat}, ${ts.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
              <a href="${getGoogleMapsUrl(ts.lat, ts.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
              <button onclick="editSpot('${ts.id}')" class="p-1.5 text-slate-400 hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
              <button onclick="moveTransitSpot('${activeTransitId}', ${tIdx}, -1)" class="p-1.5 text-slate-400 hover:text-white transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>
              <button onclick="moveTransitSpot('${activeTransitId}', ${tIdx}, 1)" class="p-1.5 text-slate-400 hover:text-white transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>
              <button onclick="unassignSpot('${ts.id}')" class="p-1.5 text-slate-400 hover:text-amber-400 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
            </div>
          </div>
          ${ts.desc ? `<p class="text-xs text-slate-300 pl-8">${ts.desc}</p>` : ''}
          ${ts.imageBase64 ? `<div class="pl-8 pt-1.5"><img src="${ts.imageBase64}" class="w-28 h-20 object-cover rounded-xl border border-slate-700"></div>` : ''}
          <div class="text-xs text-emerald-400 font-mono pl-8">➔ Distance : +${transitSegDist.toFixed(1)} km</div>
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

      const item = document.createElement('div');
      item.id = `card-spot-${spot.id}`;
      item.className = 'bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2.5 truncate">
            <span class="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})" title="Centrer">${idx + 1}</span>
            <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})">
              <span class="text-slate-200 font-semibold truncate block">${spot.name}</span>
              ${parentSpot ? `<span class="text-[11px] text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
            </div>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${spot.lat}, ${spot.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(spot.lat, spot.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editSpot('${spot.id}')" class="p-1.5 text-slate-400 hover:text-indigo-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="moveSpotInDay(${curDay}, ${idx}, -1)" class="p-1.5 text-slate-400 hover:text-white transition" title="Monter"><i class="fa-solid fa-arrow-up text-xs"></i></button>
            <button onclick="moveSpotInDay(${curDay}, ${idx}, 1)" class="p-1.5 text-slate-400 hover:text-white transition" title="Descendre"><i class="fa-solid fa-arrow-down text-xs"></i></button>
            <button onclick="removeSpotFromDay(${curDay}, ${idx})" class="p-1.5 text-amber-400 hover:text-amber-300 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
          </div>
        </div>
        ${spot.desc ? `<p class="text-xs text-slate-300 pl-8">${spot.desc}</p>` : ''}
        ${spot.url ? `<div class="pl-8 pt-0.5"><a href="${spot.url}" target="_blank" class="text-xs text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${spot.url}</span></a></div>` : ''}
        <div class="text-xs text-emerald-400 font-mono pl-8 pt-0.5">➔ Distance : +${segDist.toFixed(1)} km</div>
        ${spot.imageBase64 ? `<div class="pl-8 pt-1.5"><img src="${spot.imageBase64}" class="w-28 h-20 object-cover rounded-xl border border-slate-700"></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });

    transitBps.forEach(bp => {
      const item = document.createElement('div');
      item.id = `card-bonplan-${bp.id}`;
      item.className = 'bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">
            <i class="fa-solid fa-lightbulb text-amber-400 shrink-0"></i>
            <span class="text-amber-200 font-semibold truncate">[Transit] ${bp.title}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editBonPlan('${bp.id}')" class="p-1.5 text-slate-400 hover:text-amber-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
          </div>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-100 pl-6">${bp.desc}</p>` : ''}
        ${bp.url ? `<div class="pl-6"><a href="${bp.url}" target="_blank" class="text-xs text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });

    dayBpIds.forEach((bpId, idx) => {
      const bp = appState.bonsPlans.find(b => b.id === bpId);
      if (!bp) return;

      const item = document.createElement('div');
      item.id = `card-bonplan-${bp.id}`;
      item.className = 'bg-amber-950/20 border border-amber-800/40 rounded-xl p-3 space-y-1 text-xs sm:text-sm';
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2 truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">
            <i class="fa-solid fa-lightbulb text-amber-400 shrink-0"></i>
            <span class="text-amber-200 font-semibold truncate">${bp.title}</span>
          </div>
          <div class="flex items-center space-x-1 shrink-0">
            <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>
            <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-1.5 text-slate-400 hover:text-emerald-400 transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>
            <button onclick="editBonPlan('${bp.id}')" class="p-1.5 text-slate-400 hover:text-amber-400 transition" title="Modifier"><i class="fa-solid fa-pen-to-square"></i></button>
            <button onclick="removeBonPlanFromDay(${curDay}, ${idx})" class="p-1.5 text-amber-400 hover:text-amber-300 transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>
          </div>
        </div>
        ${bp.desc ? `<p class="text-xs text-amber-100 pl-6">${bp.desc}</p>` : ''}
        ${bp.url ? `<div class="pl-6"><a href="${bp.url}" target="_blank" class="text-xs text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      `;
      routeContainer.appendChild(item);
    });
  }

  document.getElementById('dayRouteDistance').innerText = dayRoute.totalDist.toFixed(1) + ' km';
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
  const spotId = document.getElementById('addSpotToDaySelect').value;
  if (!spotId) return;
  const curDay = appState.currentSelectedDay;
  if (!appState.dailyItineraries[curDay]) appState.dailyItineraries[curDay] = [];
  if (!appState.dailyItineraries[curDay].includes(spotId)) appState.dailyItineraries[curDay].push(spotId);
  renderApp();
}

function addBonPlanToCurrentDay() {
  const bpId = document.getElementById('addBonPlanToDaySelect').value;
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

function renderAllSpotsUI() {
  const validTransits = getTransits();
  const spotsContainer = document.getElementById('allSpotsList');
  const bpContainer = document.getElementById('allBonsPlansList');

  document.getElementById('allSpotsCountBadge').innerText = appState.spots.length + appState.bonsPlans.length;
  document.getElementById('allSpotsBadge').innerText = appState.spots.length;
  document.getElementById('allBonsPlansBadge').innerText = appState.bonsPlans.length;

  spotsContainer.innerHTML = appState.spots.length === 0 ? '<p class="text-xs sm:text-sm text-slate-500 italic">Aucun spot créé</p>' : '';
  appState.spots.forEach(s => {
    let attachmentBadges = '';
    if (s.target) {
      const tObj = validTransits.find(t => t.id === s.target);
      attachmentBadges += `<span class="text-[11px] bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-md font-medium">Transit : ${tObj ? tObj.name : s.target}</span>`;
    }

    let assignedDays = [];
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(s.id)) assignedDays.push(`J+${d}`);
    });

    if (assignedDays.length > 0) {
      attachmentBadges += `<span class="text-[11px] bg-indigo-950 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded-md font-medium cursor-pointer hover:underline" onclick="jumpToDay(${assignedDays[0].replace('J+', '')})">Jours : ${assignedDays.join(', ')}</span>`;
    }

    let nearestZoneBadge = '';
    if (!s.target && assignedDays.length === 0) {
      attachmentBadges = '<span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">Libre</span>';
      const nearest = getNearestZoneInfo(s.lat, s.lng);
      if (nearest) {
        nearestZoneBadge = `<span class="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-md font-medium flex items-center" title="Proximité à vol d'oiseau calculée"><i class="fa-solid fa-location-crosshairs mr-1 text-indigo-400"></i>📍 Proche : ${nearest.zoneName} (${nearest.distanceKm.toFixed(1)} km)</span>`;
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
    el.className = `bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5 text-xs sm:text-sm shadow-sm ${s.parentId ? 'ml-4 border-l-4 border-l-indigo-500' : ''}`;
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2.5 truncate">
          <i class="fa-solid ${s.parentId ? 'fa-turn-up rotate-90 text-indigo-400' : 'fa-location-dot text-emerald-400'} shrink-0 cursor-pointer hover:scale-125 transition" onclick="centerMapOnCoords(${s.lat}, ${s.lng})" title="Centrer sur la carte"></i>
          <div class="truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${s.lat}, ${s.lng})">
            <span class="text-white font-bold truncate block">${s.name}</span>
            ${parentSpot ? `<span class="text-[11px] text-indigo-400 font-medium block">↳ Sous-spot de : ${parentSpot.name}</span>` : ''}
          </div>
        </div>
        <div class="flex items-center space-x-1 flex-wrap">${nearestZoneBadge} ${attachmentBadges}</div>
      </div>
      ${s.desc ? `<p class="text-xs text-slate-400">${s.desc}</p>` : ''}
      ${s.url ? `<div><a href="${s.url}" target="_blank" class="text-xs text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${s.url}</span></a></div>` : ''}
      ${subSpots.length > 0 ? `<div class="text-[11px] bg-slate-900 p-2 rounded-lg text-slate-300 border border-slate-800"><strong>Sous-spots associés (${subSpots.length}) :</strong> ${subSpots.map(sb => sb.name).join(', ')}</div>` : ''}
      ${s.imageBase64 ? `<div><img src="${s.imageBase64}" class="w-32 h-24 object-cover rounded-xl border border-slate-700"></div>` : ''}
      <div class="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 flex-wrap">
        <div class="flex items-center space-x-1.5">
          <button onclick="centerMapOnCoords(${s.lat}, ${s.lng})" class="p-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl transition" title="Centrer sur la carte"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(s.lat, s.lng)}" target="_blank" class="p-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl transition" title="Ouvrir dans Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>
          <button onclick="editSpot('${s.id}')" class="p-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 rounded-xl transition" title="Éditer le spot"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="createSubSpot('${s.id}')" class="p-2 bg-slate-900 hover:bg-slate-800 text-amber-400 rounded-xl transition text-xs font-semibold" title="Ajouter un sous-spot"><i class="fa-solid fa-folder-plus mr-1"></i>+ Sous-spot</button>
          <button onclick="deleteSpot('${s.id}')" class="p-2 bg-slate-900 hover:bg-slate-800 text-red-400 rounded-xl transition" title="Supprimer définitivement"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <select onchange="universalAssignSpot('${s.id}', this.value)" class="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium">
          ${assignmentSelectOptions}
        </select>
      </div>
    `;
    spotsContainer.appendChild(el);
  });

  bpContainer.innerHTML = appState.bonsPlans.length === 0 ? '<p class="text-xs sm:text-sm text-slate-500 italic">Aucun bon plan créé</p>' : '';
  appState.bonsPlans.forEach(bp => {
    let bpAttachmentLabel = '<span class="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-medium">Libre</span>';
    let nearestZoneBadge = '';

    let assignedDaysBp = [];
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d] && appState.dailyBonsPlans[d].includes(bp.id)) assignedDaysBp.push(`J+${d}`);
    });

    if (bp.target) {
      const tObj = validTransits.find(t => t.id === bp.target);
      bpAttachmentLabel = `<span class="text-[11px] bg-amber-950/60 text-amber-300 border border-amber-800/40 px-2 py-0.5 rounded-md font-medium">Transit : ${tObj ? tObj.name : bp.target}</span>`;
    } else if (assignedDaysBp.length > 0) {
      bpAttachmentLabel = `<span class="text-[11px] bg-indigo-950 text-indigo-300 border border-indigo-800/40 px-2 py-0.5 rounded-md font-medium cursor-pointer hover:underline" onclick="jumpToDay(${assignedDaysBp[0].replace('J+', '')})">Jours : ${assignedDaysBp.join(', ')}</span>`;
    } else {
      const nearest = getNearestZoneInfo(bp.lat, bp.lng);
      if (nearest) {
        nearestZoneBadge = `<span class="text-[11px] bg-indigo-950/80 text-indigo-300 border border-indigo-700/50 px-2 py-0.5 rounded-md font-medium flex items-center" title="Proximité à vol d'oiseau calculée"><i class="fa-solid fa-location-crosshairs mr-1 text-indigo-400"></i>📍 Proche : ${nearest.zoneName} (${nearest.distanceKm.toFixed(1)} km)</span>`;
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
    el.className = 'bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col space-y-2.5 text-xs sm:text-sm shadow-sm';
    el.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2.5 truncate">
          <i class="fa-solid fa-lightbulb text-amber-400 shrink-0 cursor-pointer hover:scale-125 transition" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" title="Centrer sur la carte"></i>
          <span class="text-white font-bold truncate cursor-pointer hover:underline" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})">${bp.title} <span class="text-xs text-amber-400 font-normal">(${bp.category})</span></span>
        </div>
        <div class="flex items-center space-x-1 flex-wrap">${nearestZoneBadge} ${bpAttachmentLabel}</div>
      </div>
      ${bp.desc ? `<p class="text-xs text-slate-400">${bp.desc}</p>` : ''}
      ${bp.url ? `<div><a href="${bp.url}" target="_blank" class="text-xs text-indigo-400 hover:underline flex items-center"><i class="fa-solid fa-link mr-1"></i><span class="truncate">${bp.url}</span></a></div>` : ''}
      <div class="flex items-center justify-between pt-2 border-t border-slate-800 gap-2 flex-wrap">
        <div class="flex items-center space-x-1.5">
          <button onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})" class="p-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl transition" title="Centrer sur la carte"><i class="fa-solid fa-crosshairs"></i></button>
          <a href="${getGoogleMapsUrl(bp.lat, bp.lng)}" target="_blank" class="p-2 bg-slate-900 hover:bg-slate-800 text-emerald-400 rounded-xl transition" title="Ouvrir dans Google Maps"><i class="fa-solid fa-map-location-dot"></i></a>
          <button onclick="editBonPlan('${bp.id}')" class="p-2 bg-slate-900 hover:bg-slate-800 text-indigo-400 rounded-xl transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>
          <button onclick="deleteBonPlan('${bp.id}')" class="p-2 bg-slate-900 hover:bg-slate-800 text-red-400 rounded-xl transition" title="Supprimer"><i class="fa-solid fa-trash-can"></i></button>
        </div>
        <select onchange="universalAssignBonPlan('${bp.id}', this.value)" class="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-xl px-2.5 py-2 focus:outline-none focus:border-indigo-500 font-medium">
          ${bpAssignmentOptions}
        </select>
      </div>
    `;
    bpContainer.appendChild(el);
  });
}

function renderMapMarkers() {
  if (!map) return;
  mapMarkers.forEach(m => map.removeLayer(m));
  mapMarkers = [];
  if (routePolyline) { map.removeLayer(routePolyline); routePolyline = null; }

  if (appState.departurePoint) {
    const m = L.marker([appState.departurePoint.lat, appState.departurePoint.lng], {
      icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="custom-leaflet-marker bg-emerald-700 cursor-pointer" style="width:28px;height:28px;" onclick="centerMapOnCoords(${appState.departurePoint.lat}, ${appState.departurePoint.lng})"><i class="fa-solid fa-flag-checkered text-xs"></i></div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map);
    m.bindPopup(`<b>Départ :</b> ${appState.departurePoint.name}<br><button onclick="locateAndHighlightItem('endpoint', 'departure')" class="mt-2 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded">Localiser dans la liste</button>`);
    mapMarkers.push(m);
  }

  if (appState.arrivalPoint) {
    const m = L.marker([appState.arrivalPoint.lat, appState.arrivalPoint.lng], {
      icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="custom-leaflet-marker bg-blue-700 cursor-pointer" style="width:28px;height:28px;" onclick="centerMapOnCoords(${appState.arrivalPoint.lat}, ${appState.arrivalPoint.lng})"><i class="fa-solid fa-house-flag text-xs"></i></div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map);
    m.bindPopup(`<b>Arrivée :</b> ${appState.arrivalPoint.name}<br><button onclick="locateAndHighlightItem('endpoint', 'arrival')" class="mt-2 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded">Localiser dans la liste</button>`);
    mapMarkers.push(m);
  }

  appState.hotels.forEach(h => {
    const m = L.marker([h.lat, h.lng], {
      icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="custom-leaflet-marker bg-blue-600 cursor-pointer" style="width:28px;height:28px;" onclick="centerMapOnCoords(${h.lat}, ${h.lng})"><i class="fa-solid fa-hotel text-xs"></i></div>`, iconSize: [28, 28], iconAnchor: [14, 14] })
    }).addTo(map);
    m.bindPopup(`<b>${h.name}</b><br><span class="text-xs text-slate-500">${h.desc || ''}</span><br><button onclick="locateAndHighlightItem('hotel', '${h.id}')" class="mt-2 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded">Localiser dans la liste</button>`);
    mapMarkers.push(m);

    if (h.radiusKm) {
      const circle = L.circle([h.lat, h.lng], { radius: h.radiusKm * 1000, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1 }).addTo(map);
      mapMarkers.push(circle);
    }
  });

  appState.spots.forEach(s => {
    const isSub = !!s.parentId;
    const m = L.marker([s.lat, s.lng], {
      icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="custom-leaflet-marker ${isSub ? 'bg-indigo-600' : (s.target ? 'bg-amber-600' : 'bg-emerald-500')} cursor-pointer" style="width:26px;height:26px;" onclick="centerMapOnCoords(${s.lat}, ${s.lng})"><i class="fa-solid ${isSub ? 'fa-turn-up rotate-90' : 'fa-location-dot'} text-xs"></i></div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
    }).addTo(map);
    m.bindPopup(`<b>Spot : ${s.name}</b> ${isSub ? '<br><span class="text-xs text-indigo-400">(Sous-spot)</span>' : ''}<br><span class="text-xs text-slate-500">${s.desc || ''}</span><br><button onclick="locateAndHighlightItem('spot', '${s.id}')" class="mt-2 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded">Localiser dans la liste</button>`);
    mapMarkers.push(m);
  });

  appState.bonsPlans.forEach(bp => {
    const m = L.marker([bp.lat, bp.lng], {
      icon: L.divIcon({ className: 'custom-div-icon', html: `<div class="custom-leaflet-marker bg-amber-500 text-slate-950 cursor-pointer" style="width:26px;height:26px;" onclick="centerMapOnCoords(${bp.lat}, ${bp.lng})"><i class="fa-solid fa-lightbulb text-xs"></i></div>`, iconSize: [26, 26], iconAnchor: [13, 13] })
    }).addTo(map);
    m.bindPopup(`<b>Bon Plan : ${bp.title}</b> (${bp.category})<br><button onclick="locateAndHighlightItem('bonplan', '${bp.id}')" class="mt-2 text-xs bg-indigo-600 text-white px-2.5 py-1 rounded">Localiser dans la liste</button>`);
    mapMarkers.push(m);
  });

  let allTripCoords = [];
  const totalDays = getTotalDays();
  for (let d = 0; d < totalDays; d++) {
    const dayRoute = calculateDayRoute(d);
    if (dayRoute.fullCoords.length > 0) {
      if (allTripCoords.length === 0) {
        allTripCoords = allTripCoords.concat(dayRoute.fullCoords);
      } else {
        const last = allTripCoords[allTripCoords.length - 1];
        const first = dayRoute.fullCoords[0];
        if (last[0] === first[0] && last[1] === first[1]) {
          allTripCoords = allTripCoords.concat(dayRoute.fullCoords.slice(1));
        } else {
          allTripCoords = allTripCoords.concat(dayRoute.fullCoords);
        }
      }
    }
  }

  if (allTripCoords.length > 1) {
    routePolyline = L.polyline(allTripCoords, { color: '#6366f1', weight: 4, dashArray: '8, 8', opacity: 0.8 }).addTo(map);
  }

  if (shouldFitBoundsOnce) {
    let allPoints = [];
    if (appState.departurePoint) allPoints.push([appState.departurePoint.lat, appState.departurePoint.lng]);
    if (appState.arrivalPoint) allPoints.push([appState.arrivalPoint.lat, appState.arrivalPoint.lng]);
    appState.hotels.forEach(h => allPoints.push([h.lat, h.lng]));
    appState.spots.forEach(s => allPoints.push([s.lat, s.lng]));
    appState.bonsPlans.forEach(bp => allPoints.push([bp.lat, bp.lng]));

    if (allPoints.length > 0) {
      map.fitBounds(allPoints, { padding: [50, 50], maxZoom: 13 });
    }
    shouldFitBoundsOnce = false;
  }
}

function editTransitModal(transitId) {
  const transits = getTransits();
  const t = transits.find(x => x.id === transitId);
  if (!t) return;
  document.getElementById('transitId').value = t.id;
  document.getElementById('transitName').value = t.name;
  document.getElementById('transitMode').value = t.mode || 'Voiture';
  document.getElementById('transitDesc').value = t.desc || '';
  openModal('transitModal');
}

function saveTransit(e) {
  e.preventDefault();
  const id = document.getElementById('transitId').value;
  const name = document.getElementById('transitName').value;
  const mode = document.getElementById('transitMode').value;
  const desc = document.getElementById('transitDesc').value;

  if (!appState.customTransits) appState.customTransits = [];
  let custom = appState.customTransits.find(x => x.id === id);
  if (custom) {
    custom.name = name;
    custom.mode = mode;
    custom.desc = desc;
  } else {
    appState.customTransits.push({ id, name, mode, desc });
  }

  closeModal('transitModal');
  renderApp();
}

function openEndpointModal(type) {
  document.getElementById('endpointType').value = type;
  const point = type === 'departure' ? appState.departurePoint : appState.arrivalPoint;
  document.getElementById('endpointModalTitle').innerText = type === 'departure' ? "Modifier le Point de Départ" : "Modifier le Point d'Arrivée";
  document.getElementById('endpointName').value = point.name;
  document.getElementById('endpointLat').value = point.lat;
  document.getElementById('endpointLng').value = point.lng;
  document.getElementById('endpointSearchQuery').value = '';
  document.getElementById('endpointSearchResults').classList.add('hidden');
  openModal('endpointModal');
}

async function searchEndpointAddress() {
  const query = document.getElementById('endpointSearchQuery').value;
  if (!query) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
  const data = await res.json();
  const resultsContainer = document.getElementById('endpointSearchResults');
  resultsContainer.innerHTML = '';
  resultsContainer.classList.remove('hidden');

  data.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'p-2.5 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-300';
    div.innerText = item.display_name;
    div.onclick = () => {
      document.getElementById('endpointName').value = item.display_name.split(',')[0];
      document.getElementById('endpointLat').value = parseFloat(item.lat);
      document.getElementById('endpointLng').value = parseFloat(item.lon);
      resultsContainer.classList.add('hidden');
    };
    resultsContainer.appendChild(div);
  });
}

async function searchSpotAddress() {
  const q = document.getElementById('spotSearchQuery').value;
  if (!q) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const container = document.getElementById('spotSearchResults');
  container.innerHTML = '';
  container.classList.remove('hidden');

  data.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-300';
    div.innerText = item.display_name;
    div.onclick = () => {
      if (!document.getElementById('spotName').value) document.getElementById('spotName').value = item.display_name.split(',')[0];
      document.getElementById('spotLat').value = parseFloat(item.lat).toFixed(6);
      document.getElementById('spotLng').value = parseFloat(item.lon).toFixed(6);
      container.classList.add('hidden');
    };
    container.appendChild(div);
  });
}

async function searchHotelAddress() {
  const q = document.getElementById('hotelSearchQuery').value;
  if (!q) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const container = document.getElementById('hotelSearchResults');
  container.innerHTML = '';
  container.classList.remove('hidden');

  data.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-300';
    div.innerText = item.display_name;
    div.onclick = () => {
      if (!document.getElementById('hotelName').value) document.getElementById('hotelName').value = item.display_name.split(',')[0];
      document.getElementById('hotelLat').value = parseFloat(item.lat).toFixed(6);
      document.getElementById('hotelLng').value = parseFloat(item.lon).toFixed(6);
      container.classList.add('hidden');
    };
    container.appendChild(div);
  });
}

async function searchBpAddress() {
  const q = document.getElementById('bpSearchQuery').value;
  if (!q) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const container = document.getElementById('bpSearchResults');
  container.innerHTML = '';
  container.classList.remove('hidden');

  data.slice(0, 5).forEach(item => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-300';
    div.innerText = item.display_name;
    div.onclick = () => {
      if (!document.getElementById('bonPlanTitle').value) document.getElementById('bonPlanTitle').value = item.display_name.split(',')[0];
      document.getElementById('bonPlanLat').value = parseFloat(item.lat).toFixed(6);
      document.getElementById('bonPlanLng').value = parseFloat(item.lon).toFixed(6);
      container.classList.add('hidden');
    };
    container.appendChild(div);
  });
}

function filterSpotParentOptions() {
  const currentSpotId = document.getElementById('spotId').value;
  const currentLat = parseFloat(document.getElementById('spotLat').value) || null;
  const currentLng = parseFloat(document.getElementById('spotLng').value) || null;
  const searchText = (document.getElementById('spotParentSearch').value || '').toLowerCase();
  const container = document.getElementById('spotParentDropdown');

  container.innerHTML = '';
  container.classList.remove('hidden');

  const noneDiv = document.createElement('div');
  noneDiv.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-400 font-semibold';
  noneDiv.innerText = '-- Aucun (Spot Autonome / Macro) --';
  noneDiv.onclick = () => {
    document.getElementById('spotParentId').value = '';
    document.getElementById('spotParentSearch').value = '';
    container.classList.add('hidden');
  };
  container.appendChild(noneDiv);

  let eligible = appState.spots.filter(s => s.id !== currentSpotId && !s.parentId);
  
  eligible.forEach(s => {
    s._dist = (currentLat !== null && currentLng !== null) ? haversineDistanceKm(currentLat, currentLng, s.lat, s.lng) : Infinity;
  });

  eligible.sort((a, b) => {
    if (a._dist !== b._dist) return a._dist - b._dist;
    return a.name.localeCompare(b.name);
  });

  const filtered = eligible.filter(s => s.name.toLowerCase().includes(searchText));

  filtered.forEach(s => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-200 flex justify-between items-center';
    const distStr = s._dist !== Infinity ? `<span class="text-[10px] text-indigo-400 font-mono">${s._dist.toFixed(1)} km</span>` : '';
    div.innerHTML = `<span>${s.name}</span>${distStr}`;
    div.onclick = () => {
      document.getElementById('spotParentId').value = s.id;
      document.getElementById('spotParentSearch').value = s.name;
      container.classList.add('hidden');
    };
    container.appendChild(div);
  });
}

function filterSpotTargetOptions() {
  const searchText = (document.getElementById('spotTargetSearch').value || '').toLowerCase();
  const container = document.getElementById('spotTargetDropdown');

  container.innerHTML = '';
  container.classList.remove('hidden');

  const addOption = (label, type, val) => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-200 text-xs';
    div.innerText = label;
    div.onclick = () => {
      document.getElementById('spotTargetType').value = type;
      document.getElementById('spotTargetValue').value = val;
      document.getElementById('spotTargetSearch').value = label;
      container.classList.add('hidden');
    };
    container.appendChild(div);
  };

  if ("libre".includes(searchText)) addOption('-- Aucun (Libre) --', '', '');

  const totalDays = getTotalDays();
  for (let d = 0; d < totalDays; d++) {
    const contextDesc = getDayContextDescription(d);
    const label = `🗓️ Jour J+${d} (${deltaToDateStr(d)}) — ${contextDesc}`;
    if (label.toLowerCase().includes(searchText)) {
      addOption(label, 'day', d);
    }
  }

  getTransits().forEach(t => {
    const label = `🚗 Transit: ${t.name}`;
    if (label.toLowerCase().includes(searchText)) {
      addOption(label, 'transit', t.id);
    }
  });
}

function filterBpTargetOptions() {
  const searchText = (document.getElementById('bpTargetSearch').value || '').toLowerCase();
  const container = document.getElementById('bpTargetDropdown');

  container.innerHTML = '';
  container.classList.remove('hidden');

  const addOption = (label, type, val) => {
    const div = document.createElement('div');
    div.className = 'p-2 hover:bg-slate-900 cursor-pointer border-b border-slate-800 text-slate-200 text-xs';
    div.innerText = label;
    div.onclick = () => {
      document.getElementById('bpTargetType').value = type;
      document.getElementById('bpTargetValue').value = val;
      document.getElementById('bpTargetSearch').value = label;
      container.classList.add('hidden');
    };
    container.appendChild(div);
  };

  if ("libre".includes(searchText)) addOption('-- Aucun (Libre) --', '', '');

  const totalDays = getTotalDays();
  for (let d = 0; d < totalDays; d++) {
    const contextDesc = getDayContextDescription(d);
    const label = `🗓️ Jour J+${d} (${deltaToDateStr(d)}) — ${contextDesc}`;
    if (label.toLowerCase().includes(searchText)) {
      addOption(label, 'day', d);
    }
  }

  getTransits().forEach(t => {
    const label = `🚗 Transit: ${t.name}`;
    if (label.toLowerCase().includes(searchText)) {
      addOption(label, 'transit', t.id);
    }
  });
}

function saveEndpoint(e) {
  e.preventDefault();
  const type = document.getElementById('endpointType').value;
  const name = document.getElementById('endpointName').value;
  const lat = parseFloat(document.getElementById('endpointLat').value);
  const lng = parseFloat(document.getElementById('endpointLng').value);

  if (type === 'departure') appState.departurePoint = { name, lat, lng };
  else appState.arrivalPoint = { name, lat, lng };

  cleanOrphanTransitsAndTargets();
  closeModal('endpointModal');
  renderApp();
}

function startMapPickEndpoint() {
  mapPickMode = 'endpoint_' + document.getElementById('endpointType').value;
  document.getElementById('mapPickingNotice').classList.remove('hidden');
  closeModal('endpointModal');
}

function startMapPick(type) {
  mapPickMode = type;
  document.getElementById('mapPickingNotice').classList.remove('hidden');
  closeModal('spotModal'); closeModal('hotelModal'); closeModal('bonPlanModal');
}

function cancelMapPick() {
  mapPickMode = null;
  document.getElementById('mapPickingNotice').classList.add('hidden');
}

function onMapClick(e) {
  if (!mapPickMode) return;
  const { lat, lng } = e.latlng;

  if (mapPickMode === 'endpoint_departure') {
    appState.departurePoint.lat = parseFloat(lat.toFixed(6));
    appState.departurePoint.lng = parseFloat(lng.toFixed(6));
    cleanOrphanTransitsAndTargets();
    renderApp();
  } else if (mapPickMode === 'endpoint_arrival') {
    appState.arrivalPoint.lat = parseFloat(lat.toFixed(6));
    appState.arrivalPoint.lng = parseFloat(lng.toFixed(6));
    cleanOrphanTransitsAndTargets();
    renderApp();
  } else if (mapPickMode === 'spot') {
    document.getElementById('spotLat').value = lat.toFixed(6);
    document.getElementById('spotLng').value = lng.toFixed(6);
    openModal('spotModal');
  } else if (mapPickMode === 'hotel') {
    document.getElementById('hotelLat').value = lat.toFixed(6);
    document.getElementById('hotelLng').value = lng.toFixed(6);
    openModal('hotelModal');
  } else if (mapPickMode === 'bonplan') {
    document.getElementById('bonPlanLat').value = lat.toFixed(6);
    document.getElementById('bonPlanLng').value = lng.toFixed(6);
    openModal('bonPlanModal');
  }
  cancelMapPick();
}

function handlePhotoUpload(event, targetType) {
  const file = event.target.files[0];
  if (!file) return;

  EXIF.getData(file, function() {
    const lat = EXIF.getTag(this, "GPSLatitude");
    const lon = EXIF.getTag(this, "GPSLongitude");
    const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
    const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

    if (lat && lon) {
      const latDeg = lat[0] + lat[1]/60 + lat[2]/3600;
      const lonDeg = lon[0] + lon[1]/60 + lon[2]/3600;
      const finalLat = (latRef === "S") ? -latDeg : latDeg;
      const finalLon = (lonRef === "W") ? -lonDeg : lonDeg;

      if (targetType === 'spot') {
        document.getElementById('spotLat').value = finalLat.toFixed(6);
        document.getElementById('spotLng').value = finalLon.toFixed(6);
      }
    }
  });

  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_SIZE = 800;

      if (width > height) {
        if (width > MAX_SIZE) {
          height *= MAX_SIZE / width;
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width *= MAX_SIZE / height;
          height = MAX_SIZE;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

      document.getElementById('spotImgThumb').src = compressedDataUrl;
      document.getElementById('spotPhotoPreview').classList.remove('hidden');
      document.getElementById('spotForm').dataset.imageBase64 = compressedDataUrl;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeSpotImage() {
  document.getElementById('spotImgThumb').src = '';
  document.getElementById('spotPhotoPreview').classList.add('hidden');
  delete document.getElementById('spotForm').dataset.imageBase64;
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function openZoneModal() {
  document.getElementById('zoneForm').reset();
  document.getElementById('zoneId').value = '';
  document.getElementById('zoneModalTitle').innerText = "Ajouter une Zone";
  openModal('zoneModal');
}

function editZone(id) {
  const zone = appState.zones.find(z => z.id === id);
  if (!zone) return;
  document.getElementById('zoneId').value = zone.id;
  document.getElementById('zoneName').value = zone.name;
  document.getElementById('zoneDesc').value = zone.desc || '';
  document.getElementById('zoneColor').value = zone.color || '#6366f1';
  document.getElementById('zoneModalTitle').innerText = "Éditer la Zone";
  openModal('zoneModal');
}

function saveZone(e) {
  e.preventDefault();
  const id = document.getElementById('zoneId').value || 'z_' + Date.now();
  const name = document.getElementById('zoneName').value;
  const desc = document.getElementById('zoneDesc').value;
  const color = document.getElementById('zoneColor').value;
  const existingZone = appState.zones.find(z => z.id === id);

  if (existingZone) { existingZone.name = name; existingZone.desc = desc; existingZone.color = color; }
  else { appState.zones.push({ id, name, desc, color }); }

  cleanOrphanTransitsAndTargets();
  closeModal('zoneModal');
  renderApp();
}

function deleteZone(id) {
  if (!confirm('Supprimer cette zone ? Les hébergements rattachés seront supprimés.')) return;
  appState.zones = appState.zones.filter(z => z.id !== id);
  appState.hotels = appState.hotels.filter(h => h.zoneId !== id);
  cleanOrphanTransitsAndTargets();
  renderApp();
}

function openSpotModal(defaultName = '', defaultDesc = '', parentId = '') {
  document.getElementById('spotForm').reset();
  document.getElementById('spotId').value = '';
  document.getElementById('spotPhotoPreview').classList.add('hidden');
  delete document.getElementById('spotForm').dataset.imageBase64;
  document.getElementById('spotModalTitle').innerText = parentId ? "Ajouter un Sous-Spot" : "Ajouter un Spot";
  
  document.getElementById('spotParentId').value = parentId;
  const parentObj = parentId ? appState.spots.find(s => s.id === parentId) : null;
  document.getElementById('spotParentSearch').value = parentObj ? parentObj.name : '';
  
  document.getElementById('spotTargetType').value = '';
  document.getElementById('spotTargetValue').value = '';
  document.getElementById('spotTargetSearch').value = '';

  if (defaultName) document.getElementById('spotName').value = defaultName;
  if (defaultDesc) document.getElementById('spotDesc').value = defaultDesc;
  openModal('spotModal');
}

function createSubSpot(parentId) {
  const parentSpot = appState.spots.find(s => s.id === parentId);
  if (!parentSpot) return;
  openSpotModal('', '', parentId);
  document.getElementById('spotLat').value = parentSpot.lat;
  document.getElementById('spotLng').value = parentSpot.lng;
}

function editSpot(id) {
  const spot = appState.spots.find(s => s.id === id);
  if (!spot) return;

  document.getElementById('spotId').value = spot.id;
  document.getElementById('spotName').value = spot.name;
  document.getElementById('spotLat').value = spot.lat;
  document.getElementById('spotLng').value = spot.lng;
  document.getElementById('spotDesc').value = spot.desc || '';
  document.getElementById('spotUrl').value = spot.url || '';

  document.getElementById('spotParentId').value = spot.parentId || '';
  const parentObj = spot.parentId ? appState.spots.find(s => s.id === spot.parentId) : null;
  document.getElementById('spotParentSearch').value = parentObj ? parentObj.name : '';

  let targetType = '';
  let targetVal = '';
  let targetLabel = '';

  if (spot.target) {
    targetType = 'transit';
    targetVal = spot.target;
    const tObj = getTransits().find(t => t.id === spot.target);
    targetLabel = `🚗 Transit: ${tObj ? tObj.name : spot.target}`;
  } else {
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(spot.id)) {
        targetType = 'day';
        targetVal = d;
        const contextDesc = getDayContextDescription(parseInt(d));
        targetLabel = `🗓️ Jour J+${d} (${deltaToDateStr(d)}) — ${contextDesc}`;
      }
    });
  }

  document.getElementById('spotTargetType').value = targetType;
  document.getElementById('spotTargetValue').value = targetVal;
  document.getElementById('spotTargetSearch').value = targetLabel;

  if (spot.imageBase64) {
    document.getElementById('spotImgThumb').src = spot.imageBase64;
    document.getElementById('spotPhotoPreview').classList.remove('hidden');
    document.getElementById('spotForm').dataset.imageBase64 = spot.imageBase64;
  } else {
    document.getElementById('spotPhotoPreview').classList.add('hidden');
    delete document.getElementById('spotForm').dataset.imageBase64;
  }

  document.getElementById('spotModalTitle').innerText = "Éditer le Spot";
  openModal('spotModal');
}

function saveSpot(e) {
  e.preventDefault();
  const id = document.getElementById('spotId').value || 's_' + Date.now();
  const name = document.getElementById('spotName').value;
  const parentId = document.getElementById('spotParentId').value || '';
  const lat = parseFloat(document.getElementById('spotLat').value);
  const lng = parseFloat(document.getElementById('spotLng').value);
  const desc = document.getElementById('spotDesc').value;
  const url = document.getElementById('spotUrl').value;
  
  const targetType = document.getElementById('spotTargetType').value;
  const targetValue = document.getElementById('spotTargetValue').value;

  let target = '';
  if (targetType === 'transit') target = targetValue;

  let imageBase64 = null;
  if (document.getElementById('spotForm').dataset.imageBase64) {
    imageBase64 = document.getElementById('spotForm').dataset.imageBase64;
  }

  const existingIndex = appState.spots.findIndex(s => s.id === id);
  const spotData = { id, name, parentId, target, lat, lng, desc, url, imageBase64 };

  if (existingIndex >= 0) appState.spots[existingIndex] = spotData;
  else appState.spots.push(spotData);

  Object.keys(appState.dailyItineraries).forEach(d => {
    appState.dailyItineraries[d] = (appState.dailyItineraries[d] || []).filter(sId => sId !== id);
  });

  if (targetType === 'day' && targetValue !== '') {
    const dayNum = parseInt(targetValue);
    if (!appState.dailyItineraries[dayNum]) appState.dailyItineraries[dayNum] = [];
    appState.dailyItineraries[dayNum].push(id);
  }

  closeModal('spotModal');
  renderApp();
}

function universalAssignSpot(spotId, selectionValue) {
  const spot = appState.spots.find(s => s.id === spotId);
  if (!spot) return;

  spot.target = '';
  Object.keys(appState.dailyItineraries).forEach(d => {
    appState.dailyItineraries[d] = (appState.dailyItineraries[d] || []).filter(id => id !== spotId);
  });

  if (!selectionValue) {
    renderApp();
    return;
  }

  const [type, val] = selectionValue.split(':');
  if (type === 'transit') {
    spot.target = val;
  } else if (type === 'day') {
    const dayNum = parseInt(val);
    if (!appState.dailyItineraries[dayNum]) appState.dailyItineraries[dayNum] = [];
    if (!appState.dailyItineraries[dayNum].includes(spotId)) {
      appState.dailyItineraries[dayNum].push(spotId);
    }
  }
  renderApp();
}

function unassignSpot(spotId) { universalAssignSpot(spotId, ''); }

function deleteSpot(id) {
  if (!confirm('Voulez-vous supprimer définitivement ce spot du voyage ?')) return;
  appState.spots = appState.spots.filter(s => s.id !== id);
  appState.spots.forEach(s => { if (s.parentId === id) s.parentId = ''; });
  Object.keys(appState.dailyItineraries).forEach(day => {
    appState.dailyItineraries[day] = appState.dailyItineraries[day].filter(sId => sId !== id);
  });
  renderApp();
}

function openHotelModal(defaultName = '', defaultDesc = '') {
  if (appState.zones.length === 0) {
    alert("Veuillez d'abord créer au moins une zone avant d'ajouter un hôtel !");
    return;
  }
  document.getElementById('hotelForm').reset();
  document.getElementById('hotelId').value = '';
  document.getElementById('hotelNights').value = 1;
  document.getElementById('hotelModalTitle').innerText = "Ajouter un Hébergement";
  populateHotelZoneSelect();
  document.getElementById('hotelZoneSelect').value = '';
  if (defaultName) document.getElementById('hotelName').value = defaultName;
  if (defaultDesc) document.getElementById('hotelDesc').value = defaultDesc;
  openModal('hotelModal');
}

function editHotel(id) {
  const hotel = appState.hotels.find(h => h.id === id);
  if (!hotel) return;
  populateHotelZoneSelect();

  document.getElementById('hotelId').value = hotel.id;
  document.getElementById('hotelName').value = hotel.name;
  document.getElementById('hotelZoneSelect').value = hotel.zoneId;
  document.getElementById('hotelNights').value = hotel.nights || 1;
  document.getElementById('hotelLat').value = hotel.lat;
  document.getElementById('hotelLng').value = hotel.lng;
  document.getElementById('hotelDesc').value = hotel.desc || '';
  document.getElementById('hotelUrl').value = hotel.url || '';
  document.getElementById('hotelRadiusKm').value = hotel.radiusKm || 15;
  document.getElementById('hotelModalTitle').innerText = "Éditer l'Hébergement";
  openModal('hotelModal');
}

function populateHotelZoneSelect() {
  const select = document.getElementById('hotelZoneSelect');
  select.innerHTML = '<option value="" disabled selected>-- Choisir une zone obligatoirement --</option>';
  appState.zones.forEach(z => { select.innerHTML += `<option value="${z.id}">${z.name}</option>`; });
}

function adjustHotelNights(delta) {
  const input = document.getElementById('hotelNights');
  let val = parseInt(input.value) || 1;
  val = Math.max(1, val + delta);
  input.value = val;
}

function saveHotel(e) {
  e.preventDefault();
  const id = document.getElementById('hotelId').value || 'h_' + Date.now();
  const name = document.getElementById('hotelName').value;
  const zoneId = document.getElementById('hotelZoneSelect').value;
  const nights = parseInt(document.getElementById('hotelNights').value) || 1;
  const lat = parseFloat(document.getElementById('hotelLat').value);
  const lng = parseFloat(document.getElementById('hotelLng').value);
  const desc = document.getElementById('hotelDesc').value;
  const url = document.getElementById('hotelUrl').value;
  const radiusKm = parseFloat(document.getElementById('hotelRadiusKm').value) || 15;

  if (!zoneId) { alert("Veuillez sélectionner une zone pour cet hébergement."); return; }

  const hotelData = { id, name, zoneId, nights, lat, lng, desc, url, radiusKm };
  const existingIndex = appState.hotels.findIndex(h => h.id === id);

  if (existingIndex >= 0) { appState.hotels[existingIndex] = hotelData; }
  else {
    appState.hotels = appState.hotels.filter(h => h.zoneId !== zoneId);
    appState.hotels.push(hotelData);
  }

  cleanOrphanTransitsAndTargets();
  closeModal('hotelModal');
  renderApp();
}

function deleteHotel(id) {
  if (!confirm('Voulez-vous vraiment supprimer cet hébergement ?')) return;
  appState.hotels = appState.hotels.filter(h => h.id !== id);
  cleanOrphanTransitsAndTargets();
  renderApp();
}

function openBonPlanModal(defaultName = '', defaultDesc = '') {
  document.getElementById('bonPlanForm').reset();
  document.getElementById('bonPlanId').value = '';
  document.getElementById('bonPlanModalTitle').innerText = "Ajouter un Bon Plan";
  document.getElementById('bpTargetType').value = '';
  document.getElementById('bpTargetValue').value = '';
  document.getElementById('bpTargetSearch').value = '';
  if (defaultName) document.getElementById('bonPlanTitle').value = defaultName;
  if (defaultDesc) document.getElementById('bonPlanDesc').value = defaultDesc;
  openModal('bonPlanModal');
}

function editBonPlan(id) {
  const bp = appState.bonsPlans.find(b => b.id === id);
  if (!bp) return;

  document.getElementById('bonPlanId').value = bp.id;
  document.getElementById('bonPlanTitle').value = bp.title;
  document.getElementById('bonPlanCategory').value = bp.category;
  document.getElementById('bonPlanLat').value = bp.lat;
  document.getElementById('bonPlanLng').value = bp.lng;
  document.getElementById('bonPlanDesc').value = bp.desc || '';
  document.getElementById('bonPlanUrl').value = bp.url || '';

  let targetType = '';
  let targetVal = '';
  let targetLabel = '';

  if (bp.target) {
    targetType = 'transit';
    targetVal = bp.target;
    const tObj = getTransits().find(t => t.id === bp.target);
    targetLabel = `🚗 Transit: ${tObj ? tObj.name : bp.target}`;
  } else {
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d] && appState.dailyBonsPlans[d].includes(bp.id)) {
        targetType = 'day';
        targetVal = d;
        const contextDesc = getDayContextDescription(parseInt(d));
        targetLabel = `🗓️ Jour J+${d} (${deltaToDateStr(d)}) — ${contextDesc}`;
      }
    });
  }

  document.getElementById('bpTargetType').value = targetType;
  document.getElementById('bpTargetValue').value = targetVal;
  document.getElementById('bpTargetSearch').value = targetLabel;

  document.getElementById('bonPlanModalTitle').innerText = "Éditer le Bon Plan";
  openModal('bonPlanModal');
}

function saveBonPlan(e) {
  e.preventDefault();
  const id = document.getElementById('bonPlanId').value || 'bp_' + Date.now();
  const title = document.getElementById('bonPlanTitle').value;
  const category = document.getElementById('bonPlanCategory').value;
  const lat = parseFloat(document.getElementById('bonPlanLat').value);
  const lng = parseFloat(document.getElementById('bonPlanLng').value);
  const desc = document.getElementById('bonPlanDesc').value;
  const url = document.getElementById('bonPlanUrl').value;

  const targetType = document.getElementById('bpTargetType').value;
  const targetValue = document.getElementById('bpTargetValue').value;

  let target = '';
  if (targetType === 'transit') target = targetValue;

  const bpData = { id, title, category, target, lat, lng, desc, url };
  const existingIndex = appState.bonsPlans.findIndex(bp => bp.id === id);

  if (existingIndex >= 0) appState.bonsPlans[existingIndex] = bpData;
  else appState.bonsPlans.push(bpData);

  Object.keys(appState.dailyBonsPlans).forEach(d => {
    appState.dailyBonsPlans[d] = (appState.dailyBonsPlans[d] || []).filter(bId => bId !== id);
  });

  if (targetType === 'day' && targetValue !== '') {
    const dayNum = parseInt(targetValue);
    if (!appState.dailyBonsPlans[dayNum]) appState.dailyBonsPlans[dayNum] = [];
    appState.dailyBonsPlans[dayNum].push(id);
  }

  closeModal('bonPlanModal');
  renderApp();
}

function universalAssignBonPlan(bpId, selectionValue) {
  const bp = appState.bonsPlans.find(b => b.id === bpId);
  if (!bp) return;

  bp.target = '';
  Object.keys(appState.dailyBonsPlans).forEach(d => {
    appState.dailyBonsPlans[d] = (appState.dailyBonsPlans[d] || []).filter(id => id !== bpId);
  });

  if (!selectionValue) {
    renderApp();
    return;
  }

  const [type, val] = selectionValue.split(':');
  if (type === 'transit') {
    bp.target = val;
  } else if (type === 'day') {
    const dayNum = parseInt(val);
    if (!appState.dailyBonsPlans[dayNum]) appState.dailyBonsPlans[dayNum] = [];
    if (!appState.dailyBonsPlans[dayNum].includes(bpId)) {
      appState.dailyBonsPlans[dayNum].push(bpId);
    }
  }
  renderApp();
}

function unassignBonPlan(bpId) { universalAssignBonPlan(bpId, ''); }

function deleteBonPlan(id) {
  if (!confirm('Voulez-vous supprimer définitivement ce bon plan du voyage ?')) return;
  appState.bonsPlans = appState.bonsPlans.filter(bp => bp.id !== id);
  Object.keys(appState.dailyBonsPlans).forEach(day => {
    appState.dailyBonsPlans[day] = appState.dailyBonsPlans[day].filter(bId => bId !== id);
  });
  renderApp();
}

async function searchLocation() {
  const q = document.getElementById('nominatimQuery').value;
  if (!q) return;
  const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
  const data = await res.json();
  const container = document.getElementById('searchResults');
  container.innerHTML = '';
  container.classList.remove('hidden');

  data.slice(0, 5).forEach(item => {
    const el = document.createElement('div');
    el.className = 'p-3 hover:bg-slate-800 cursor-pointer text-sm text-slate-300';
    el.innerText = item.display_name;
    el.onclick = () => {
      const lat = parseFloat(item.lat);
      const lon = parseFloat(item.lon);
      const shortName = (item.display_name.split(',')[0] || '').replace(/'/g, "\\'");
      const fullDesc = item.display_name.replace(/'/g, "\\'");

      map.setView([lat, lon], 13);
      L.popup()
        .setLatLng([lat, lon])
        .setContent(`
          <div class="text-xs font-sans p-1.5 space-y-2">
            <b>${item.display_name.split(',')[0]}</b>
            <div class="flex gap-1.5">
              <button onclick="quickAdd('spot', ${lat}, ${lon}, '${shortName}', '${fullDesc}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs">+ Spot</button>
              <button onclick="quickAdd('hotel', ${lat}, ${lon}, '${shortName}', '${fullDesc}')" class="bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs">+ Hôtel</button>
              <button onclick="quickAdd('bonplan', ${lat}, ${lon}, '${shortName}', '${fullDesc}')" class="bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs">+ Bon Plan</button>
            </div>
          </div>
        `)
        .openOn(map);
      container.classList.add('hidden');
    };
    container.appendChild(el);
  });
}

function quickAdd(type, lat, lng, name = '', desc = '') {
  map.closePopup();
  if (type === 'spot') { openSpotModal(name, desc); document.getElementById('spotLat').value = lat; document.getElementById('spotLng').value = lng; }
  else if (type === 'hotel') { openHotelModal(name, desc); document.getElementById('hotelLat').value = lat; document.getElementById('hotelLng').value = lng; }
  else if (type === 'bonplan') { openBonPlanModal(name, desc); document.getElementById('bonPlanLat').value = lat; document.getElementById('bonPlanLng').value = lng; }
}

function checkCoherence() {
  const alerts = [];
  appState.zones.forEach(zone => {
    const zoneHotels = appState.hotels.filter(h => h.zoneId === zone.id);
    if (zoneHotels.length === 0) {
      alerts.push({ type: 'danger', text: `⚠️ La zone "${zone.name}" n'a aucun hébergement rattaché.` });
    }
  });

  const badge = document.getElementById('alertBadge');
  if (alerts.length > 0) { badge.innerText = alerts.length; badge.classList.remove('hidden'); }
  else { badge.classList.add('hidden'); }

  const container = document.getElementById('coherenceList');
  container.innerHTML = alerts.length === 0 ? '<p class="text-emerald-400 text-sm">✅ Aucune anomalie détectée !</p>' : '';
  alerts.forEach(a => {
    const el = document.createElement('div');
    el.className = `p-3 rounded-xl border text-sm ${a.type === 'danger' ? 'bg-red-950/50 border-red-800 text-red-200' : 'bg-amber-950/50 border-amber-800 text-amber-200'}`;
    el.innerText = a.text;
    container.appendChild(el);
  });
}

function openCoherenceModal() { openModal('coherenceModal'); }

function switchLeftTab(tab) {
  appState.activeTab = tab;
  document.getElementById('tabContentStructure').classList.add('hidden');
  document.getElementById('tabContentPlanning').classList.add('hidden');
  document.getElementById('tabContentAllSpots').classList.add('hidden');

  document.getElementById('tabBtnStructure').className = 'flex-1 py-2.5 text-center text-slate-400 hover:text-slate-200';
  document.getElementById('tabBtnPlanning').className = 'flex-1 py-2.5 text-center text-slate-400 hover:text-slate-200';
  document.getElementById('tabBtnAllSpots').className = 'flex-1 py-2.5 text-center text-slate-400 hover:text-slate-200 flex items-center justify-center space-x-1.5';

  if (tab === 'structure') {
    document.getElementById('tabContentStructure').classList.remove('hidden');
    document.getElementById('tabBtnStructure').className = 'flex-1 py-2.5 text-center text-indigo-400 border-b-2 border-indigo-500';
    renderStructureUI();
  } else if (tab === 'planning') {
    document.getElementById('tabContentPlanning').classList.remove('hidden');
    document.getElementById('tabBtnPlanning').className = 'flex-1 py-2.5 text-center text-indigo-400 border-b-2 border-indigo-500';
    renderPlanningUI();
  } else {
    document.getElementById('tabContentAllSpots').classList.remove('hidden');
    document.getElementById('tabBtnAllSpots').className = 'flex-1 py-2.5 text-center text-indigo-400 border-b-2 border-indigo-500 flex items-center justify-center space-x-1.5';
    renderAllSpotsUI();
  }

  setTimeout(() => { if (map) { map.invalidateSize(); renderMapMarkers(); } }, 150);
  renderTimelineHeader();
}

function generateRoadbookContent() {
  const roadbookPrintArea = document.getElementById('roadbookPrintArea');
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

    const daySpotsIds = appState.dailyItineraries[day] || [];
    const daySpots = daySpotsIds.map(id => appState.spots.find(s => s.id === id)).filter(Boolean);
    const dayBpIds = appState.dailyBonsPlans[day] || [];
    const dayBonsPlans = dayBpIds.map(id => appState.bonsPlans.find(bp => bp.id === id)).filter(Boolean);

    let transitBps = [];
    if (dayRoute.transits && dayRoute.transits.length > 0) {
      const tId = dayRoute.transits[0].id;
      transitBps = appState.bonsPlans.filter(bp => bp.target === tId);
    }

    html += `
      <div class="avoid-break border border-slate-200 rounded-xl p-4 bg-white shadow-sm space-y-3">
        <div class="flex justify-between items-center border-b pb-2">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">Jour J+${day}</span>
            <h3 class="text-lg font-bold text-slate-900">${dateStr}</h3>
          </div>
          <div class="text-right flex items-center space-x-2">
            <span class="text-xs font-mono font-bold bg-emerald-100 text-emerald-800 px-2 py-1 rounded">Total jour : ${dayRoute.totalDist.toFixed(1)} km</span>
            ${currentZone ? `<span class="inline-block px-2.5 py-1 rounded text-xs font-bold text-white" style="background-color: ${currentZone.color}">${currentZone.name}</span>` : '<span class="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">Sans zone</span>'}
          </div>
        </div>
    `;

    if (dayRoute.transits && dayRoute.transits.length > 0) {
      const t = dayRoute.transits[0];
      const tCalc = calculateTransitDistances(t);
      const modeIcon = getTransitModeIcon(t.mode);
      html += `<div class="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-xs text-amber-900 flex items-center justify-between"><div><span class="mr-2 text-sm">${modeIcon}</span><strong>${t.name} :</strong> Mode : <em>${t.mode || 'Voiture'}</em>.</div><span class="font-mono font-bold text-emerald-700">+${tCalc.totalDist.toFixed(1)} km</span></div>`;
    }

    if (activeHotel) {
      html += `<div class="bg-blue-50/70 border border-blue-200 p-2.5 rounded-lg text-xs text-blue-900 flex flex-col space-y-1"><div class="flex justify-between items-center"><span><i class="fas fa-hotel mr-1.5 text-blue-600"></i><strong>Hébergement actif :</strong> ${activeHotel.name}</span><span class="text-[10px] text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Rayon: ${activeHotel.radiusKm || 15} km</span></div>${activeHotel.desc ? `<div class="text-blue-800 italic">${activeHotel.desc}</div>` : ''}${activeHotel.url ? `<div><a href="${activeHotel.url}" target="_blank" class="text-indigo-600 hover:underline"><i class="fas fa-link mr-1"></i>${activeHotel.url}</a></div>` : ''}</div>`;
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
        html += `
          <div class="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
            <div class="font-bold text-slate-800 flex items-center justify-between">
              <span class="flex items-center"><span class="w-4 h-4 rounded-full ${isTransitSpot ? 'bg-amber-600' : 'bg-emerald-600'} text-white text-[10px] flex items-center justify-center mr-1.5 font-mono">${isTransitSpot ? 'T' : idx + 1}</span>${s.name} ${isTransitSpot ? '(Transit)' : ''}</span>
              <span class="text-[10px] text-emerald-600 font-mono">+${segDist.toFixed(1)} km</span>
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

function openClusteringModal() {
  if (appState.spots.length === 0) { alert("Aucun spot disponible !"); return; }
  document.getElementById('clusteringModal').classList.remove('hidden');
}

function runClusteringAlgorithm() {
  const radiusKm = parseFloat(document.getElementById('clusterRadiusInput').value) || 25;
  const minSpots = parseInt(document.getElementById('clusterMinSpotsInput').value) || 2;

  let unvisited = [...appState.spots];
  let clusters = [];

  while (unvisited.length > 0) {
    let current = unvisited.shift();
    let cluster = [current];

    for (let i = unvisited.length - 1; i >= 0; i--) {
      let other = unvisited[i];
      let dist = haversineDistanceKm(current.lat, current.lng, other.lat, other.lng);
      if (dist <= radiusKm) {
        cluster.push(other);
        unvisited.splice(i, 1);
      }
    }
    if (cluster.length >= minSpots) clusters.push(cluster);
  }

  if (clusters.length === 0) {
    alert(`Aucun groupe trouvé.`);
    closeModal('clusteringModal');
    return;
  }

  const colors = ['#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#06b6d4', '#84cc16'];
  let newZonesCount = 0;

  clusters.forEach((cluster, idx) => {
    const zoneId = 'z_cluster_' + Date.now() + '_' + idx;
    const zoneName = `Secteur ${cluster[0].name} (${cluster.length} spots)`;
    const color = colors[idx % colors.length];
    appState.zones.push({ id: zoneId, name: zoneName, color });
    newZonesCount++;
  });

  closeModal('clusteringModal');
  renderApp();
  alert(`${newZonesCount} Secteur(s) généré(s) !`);
}

async function exportZIP() {
  const zip = new JSZip();
  zip.file("voyage.json", JSON.stringify(appState, null, 2));
  const manifest = { version: "2.63", exportedAt: new Date().toISOString(), totalSpots: appState.spots.length, totalZones: appState.zones.length };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const content = await zip.generateAsync({ type: "blob" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(content);

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}_${hh}${min}${ss}`;

  const rawTripName = (appState.name || 'MonVoyage').trim();
  const safeTripName = rawTripName.replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_');

  link.download = `${safeTripName}_${timestamp}.pvi`;
  link.click();
}

async function importZIP(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const textContent = await file.text();
    if (textContent.trim().startsWith('{')) {
      appState = JSON.parse(textContent);
      finalizeImportData();
      return;
    }
  } catch (e) {}

  try {
    const zip = await JSZip.loadAsync(file);
    if (zip.file("voyage.json")) {
      const voyageDataText = await zip.file("voyage.json").async("string");
      appState = JSON.parse(voyageDataText);
      finalizeImportData();
    } else {
      alert("Fichier PVI/ZIP invalide : voyage.json introuvable.");
    }
  } catch (err) {
    alert("Erreur lors de l'importation du fichier.");
  }
}

function finalizeImportData() {
  if (!appState.dailyBonsPlans) appState.dailyBonsPlans = {};
  if (!appState.transitSpotOrder) appState.transitSpotOrder = {};
  if (!appState.customTransits) appState.customTransits = [];
  if (!appState.activeTab) appState.activeTab = 'structure';
  if (!appState.viewMode) appState.viewMode = 'designer';
  if (!appState.name) appState.name = "Mon Voyage";
  if (appState.mapFocusMode === undefined) appState.mapFocusMode = false;
  if (appState.spots) appState.spots.forEach(s => { if (s.parentId === undefined) s.parentId = ''; });

  shouldFitBoundsOnce = true;

  document.getElementById('tripNameInput').value = appState.name;
  document.getElementById('pivotDateInput').value = appState.pivotDate;
  renderApp();
  alert("Importation réussie !");
}
