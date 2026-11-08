
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

function cleanOrphanTransitsAndTargets() {
  const validTransits = getTransits().map(t => t.id);
  appState.spots.forEach(s => { if (s.target && !validTransits.includes(s.target)) s.target = ''; });
  appState.bonsPlans.forEach(bp => { if (bp.target && !validTransits.includes(bp.target)) bp.target = ''; });
}
