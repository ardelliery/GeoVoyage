/* ==========================================================================
   GeoVoyage - État de l'Application et Logique Métier (state.js)
   Version finale avec gestion complète du Night Transit (fromPoint / toPoint)
   ========================================================================== */

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
  mapFocusMode: false,
  isCacheStale: false,
  routeCache: {}
};

let map = null;
let mapMarkers = [];
let routePolyline = null;
let mapPickMode = null;
let shouldFitBoundsOnce = true;

// === IndexedDB pour la persistance des données (fonctionne avec file://) ===
const DB_NAME = 'GeoVoyageDB';
const DB_STORE = 'appState';
const DB_VERSION = 1;

function saveToLocalStorage() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error("Erreur IndexedDB lors de la sauvegarde", request.error);
        reject(request.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
          console.log("IndexedDB: store créé");
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([DB_STORE], 'readwrite');
        const store = transaction.objectStore(DB_STORE);
        const putRequest = store.put(appState, 'mainState');
        
        putRequest.onsuccess = () => {
          console.log("IndexedDB: données sauvegardées avec succès");
          resolve();
        };
        
        putRequest.onerror = () => {
          console.error("Erreur lors de l'écriture IndexedDB", putRequest.error);
          reject(putRequest.error);
        };
        
        transaction.oncomplete = () => {
          db.close();
        };
      };
    } catch (e) {
      console.error("Erreur de sauvegarde IndexedDB", e);
      reject(e);
    }
  });
}

async function loadFromLocalStorage() {
  return new Promise(async (resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        console.error("Erreur IndexedDB lors du chargement", request.error);
        resolve(false);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(DB_STORE)) {
          db.createObjectStore(DB_STORE);
          console.log("IndexedDB: store créé");
        }
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const transaction = db.transaction([DB_STORE], 'readonly');
        const store = transaction.objectStore(DB_STORE);
        const getRequest = store.get('mainState');
        
        getRequest.onsuccess = async () => {
          if (getRequest.result) {
            const parsed = getRequest.result;
            console.log("[IndexedDB] === DONNÉES CHARGÉES ===");
            console.log("[IndexedDB] Zones:", parsed.zones?.length || 0);
            if (parsed.zones) {
              parsed.zones.forEach((z, i) => console.log(`[IndexedDB]   Zone ${i}: "${z.name}" (${z.id})`));
            }
            console.log("[IndexedDB] Spots:", parsed.spots?.length || 0);
            if (parsed.spots) {
              parsed.spots.forEach((s, i) => console.log(`[IndexedDB]   Spot ${i}: "${s.name}" (${s.id})`));
            }
            console.log("[IndexedDB] Hôtels:", parsed.hotels?.length || 0);
            if (parsed.hotels) {
              parsed.hotels.forEach((h, i) => console.log(`[IndexedDB]   Hôtel ${i}: "${h.name}" (${h.id})`));
            }
            console.log("[IndexedDB] Bons Plans:", parsed.bonsPlans?.length || 0);
            appState = parsed;
            if (!appState.dailyBonsPlans) appState.dailyBonsPlans = {};
            if (!appState.transitSpotOrder) appState.transitSpotOrder = {};
            if (!appState.customTransits) appState.customTransits = [];
            if (!appState.activeTab) appState.activeTab = 'structure';
            if (!appState.viewMode) appState.viewMode = 'designer';
            if (!appState.name) appState.name = "Mon Voyage GeoVoyage";
            if (appState.mapFocusMode === undefined) appState.mapFocusMode = false;
            if (appState.isCacheStale === undefined) appState.isCacheStale = false;
            if (!appState.routeCache) appState.routeCache = {};
            if (appState.spots) appState.spots.forEach(s => { if (s.parentId === undefined) s.parentId = ''; });
            
            console.log("[IndexedDB] === appState après chargement ===");
            console.log("[IndexedDB] Zones:", appState.zones?.length || 0);
            console.log("[IndexedDB] Spots:", appState.spots?.length || 0);
            
            db.close();
            updateRecalculateButtonState();
            resolve(true);
          } else {
            console.warn("[IndexedDB] Aucune donnée sauvegardée trouvée");
            db.close();
            resolve(false);
          }
        };
        
        getRequest.onerror = () => {
          console.error("Erreur lors de la lecture IndexedDB", getRequest.error);
          db.close();
          resolve(false);
        };
      };
    } catch (e) {
      console.error("Erreur de chargement IndexedDB", e);
      resolve(false);
    }
  });
}

function loadDemoData() {
  if (appState.zones.length > 0 && !confirm("Voulez-vous charger la démo ? Cela remplacera votre voyage actuel.")) {
    return;
  }
  appState.name = "Voyage Provence Démo";
  const tripNameInput = document.getElementById('tripNameInput');
  if (tripNameInput) tripNameInput.value = appState.name;
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
  invalidateRouteCache();
  renderApp();
}

function resetTrip() {
  if (!confirm("Voulez-vous vraiment effacer tout le voyage pour en planifier un nouveau ?")) return;
  appState.name = "Mon Voyage";
  const tripNameInput = document.getElementById('tripNameInput');
  if (tripNameInput) tripNameInput.value = appState.name;
  appState.zones = []; appState.hotels = []; appState.spots = []; appState.bonsPlans = []; appState.customTransits = [];
  appState.dailyItineraries = {}; appState.dailyBonsPlans = {}; appState.transitSpotOrder = {}; appState.currentSelectedDay = 0;
  shouldFitBoundsOnce = true;
  invalidateRouteCache();
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

/**
 * Résout le point géographique d'ancrage d'une zone :
 * 1. Priorité à l'hôtel de la zone s'il existe.
 * 2. Sinon, repli sur le point d'arrivée (toPoint) du transit menant à cette zone (ex: bus de nuit).
 * 3. Sinon, repli sur le point de départ (fromPoint) du transit quittant cette zone.
 */
function getZoneAnchorPoint(zoneId) {
  const hotel = appState.hotels.find(h => h.zoneId === zoneId);
  if (hotel && hotel.lat !== undefined && hotel.lng !== undefined) {
    return { name: hotel.name, lat: hotel.lat, lng: hotel.lng };
  }

  const zoneIndex = appState.zones.findIndex(z => z.id === zoneId);
  if (zoneIndex === -1) return null;

  const customTransitsList = Array.isArray(appState.customTransits) 
    ? appState.customTransits 
    : Object.values(appState.customTransits || {});

  const incomingTransitId = zoneIndex === 0 
    ? 'transit_dep_first' 
    : `transit_${appState.zones[zoneIndex - 1].id}_${zoneId}`;
  const incomingTransit = customTransitsList.find(ct => ct && ct.id === incomingTransitId);
  if (incomingTransit && incomingTransit.toPoint && incomingTransit.toPoint.lat !== undefined && incomingTransit.toPoint.lng !== undefined) {
    return incomingTransit.toPoint;
  }

  const outgoingTransitId = zoneIndex === appState.zones.length - 1 
    ? 'transit_last_arr' 
    : `transit_${zoneId}_${appState.zones[zoneIndex + 1].id}`;
  const outgoingTransit = customTransitsList.find(ct => ct && ct.id === outgoingTransitId);
  if (outgoingTransit && outgoingTransit.fromPoint && outgoingTransit.fromPoint.lat !== undefined && outgoingTransit.fromPoint.lng !== undefined) {
    return outgoingTransit.fromPoint;
  }

<<<<<<< HEAD
  // ➔ Fallback : chercher un spot assigné à une zone (via target transit inter-zone)
  const zoneTransitId = zoneIndex === 0 
    ? 'transit_dep_first' 
    : `transit_${appState.zones[zoneIndex - 1]?.id || ''}_${zoneId}`;
  const zoneSpot = appState.spots?.find(s => s.target === zoneTransitId && s.lat !== undefined && s.lng !== undefined);
  if (zoneSpot) {
    return { name: zoneSpot.name, lat: zoneSpot.lat, lng: zoneSpot.lng };
  }

  // ➔ Aucun anchor trouvé pour cette zone — on retourne null
  // Le transit ou la route du jour afficheront 0 ou un avertissement
  console.warn(`[ZoneAnchor] Aucun point d'ancrage trouvé pour la zone "${zoneId}" — le calcul sera approximatif ou nul.`);
=======
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
  return null;
}

function getNearestZoneInfo(lat, lng) {
  if (!appState.zones || appState.zones.length === 0) return null;
  let minDistance = Infinity;
  let nearestZone = null;

  appState.zones.forEach(zone => {
    const anchor = getZoneAnchorPoint(zone.id);
    const refLat = anchor ? anchor.lat : null;
    const refLng = anchor ? anchor.lng : null;

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

/**
<<<<<<< HEAD
 * Calcul des heures de lever/coucher du soleil
 * Formule NOAA simplifiée (précision ~1-2 minutes)
 *
 * Paramètres : latitude (-90 à +90), longitude (-180 à +180), date (YYYY-MM-DD)
 * Retourne : { sunriseLocal, sunsetLocal, timezoneOffset }
 */
function getSunTimes(latitude, longitude, dateStr) {
  if (latitude === undefined || longitude === undefined || isNaN(latitude) || isNaN(longitude)) {
    return { sunriseLocal: '--:--', sunsetLocal: '--:--', timezoneOffset: '--', error: 'Coordonnées invalides' };
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) {
    return { sunriseLocal: '--:--', sunsetLocal: '--:--', timezoneOffset: '--', error: 'Date invalide' };
  }

  const N = dayOfYear(year, month, day);

  // Angle B (en radians)
  const B = (2 * Math.PI / 365) * (N - 81);

  // Équation du temps (minutes)
  const eqOfTime = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  // Déclinaison solaire (degrés)
  const declination = 23.45 * Math.sin(2 * Math.PI / 365 * (N - 81));
  const declRad = declination * Math.PI / 180;

  // Latitude en radians
  const latRad = latitude * Math.PI / 180;

  // Angle horaire (degrés)
  const cosHA = (Math.cos(90.833 * Math.PI / 180) - Math.sin(latRad) * Math.sin(declRad))
              / (Math.cos(latRad) * Math.cos(declRad));

  if (cosHA > 1) return { sunriseLocal: '---', sunsetLocal: '---', timezoneOffset: '--', error: 'Nuit polaire' };
  if (cosHA < -1) return { sunriseLocal: '---', sunsetLocal: '---', timezoneOffset: '--', error: 'Jour polaire' };

  const ha = Math.acos(cosHA) * 180 / Math.PI;

  // Midi solaire (minutes UTC) — FORMULE CORRECTE
  const solarNoonUT = 720 - 4 * longitude - eqOfTime;

  // Lever et coucher (minutes UTC)
  const sunriseUT = solarNoonUT - ha * 4;
  const sunsetUT = solarNoonUT + ha * 4;

  // Fuseau horaire géographique basé sur la longitude + DST
  const offsetMin = getGeographicTimezoneOffset(longitude, month);

  // Format HH:MM
  const formatMin = (min) => {
    let m = Math.round(min);
    m = ((m % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mn = m % 60;
    return h.toString().padStart(2, '0') + ':' + mn.toString().padStart(2, '0');
  };

  const sunriseLocal = formatMin(sunriseUT + offsetMin);
  const sunsetLocal = formatMin(sunsetUT + offsetMin);

  // Fuseau au format +HH
  const offsetH = offsetMin / 60;
  const tzSign = offsetH >= 0 ? '+' : '';
  const timezoneOffset = tzSign + offsetH.toString();

  return { sunriseLocal, sunsetLocal, timezoneOffset, error: null };
}

/**
 * Jour de l'année (1-366)
 */
function dayOfYear(year, month, day) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const start = new Date(Date.UTC(year, 0, 1));
  return Math.floor((d - start) / 86400000) + 1;
}

/**
 * Fuseau horaire géographique en minutes basé sur la longitude, avec DST
 * Longitude / 15 → fuseau de base
 * +1h si DST (été dans hémisphère nord entre mars et octobre, hiver dans hémisphère sud entre octobre et mars)
 */
function getGeographicTimezoneOffset(longitude, month) {
  const baseOffsetHours = Math.round(longitude / 15);
  let dst = 0;

  // DST pour hémisphère nord (mars-octobre)
  if (month >= 3 && month <= 10) {
    dst = 1;
  }
  // DST pour hémisphère sud (octobre-mars) — seulement si latitude sud significative
  else if (month >= 10 || month <= 3) {
    dst = 0; // on garde simple : pas de DST par défaut
  }

  return (baseOffsetHours + dst) * 60;
}


/**
=======
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
 * Calcule les jours de début (checkinDay), fin (checkoutDay) et nuits d'hôtel effectives
 * pour chaque zone. Les transits de nuit qui ARRIVENT à une zone décalent le checkin.
 * Les transits de nuit qui PARTENT d'une zone décalent le checkout et le jour actuel.
 */
function getZoneComputedDates() {
  let currentDay = 0;
  let mapping = {};
  
  const customTransitsList = Array.isArray(appState.customTransits) 
    ? appState.customTransits 
    : Object.values(appState.customTransits || {});

  appState.zones.forEach((zone, index) => {
    const hotel = appState.hotels.find(h => h.zoneId === zone.id);
    const rawNights = hotel ? (parseInt(hotel.nights) || 0) : 0;
    
    // === Transit de nuit QUI ARRIVE à cette zone (décale le checkin) ===
    let nightTransitArrival = 0;
    if (index === 0) {
      // Transit initial du point de départ vers la première zone
      const depTransit = customTransitsList.find(t => t && t.id === 'transit_dep_first');
      if (depTransit && depTransit.isNightTransit) {
        nightTransitArrival = parseInt(depTransit.nightCount) || 1;
      }
    } else {
      // Transit inter-zones arrivant de la zone précédente
      const prevZoneId = appState.zones[index - 1].id;
      const interTransit = customTransitsList.find(t => t && t.id === `transit_${prevZoneId}_${zone.id}`);
      if (interTransit && interTransit.isNightTransit) {
        nightTransitArrival = parseInt(interTransit.nightCount) || 1;
      }
    }
    
    // === Transit de nuit QUI PART de cette zone (décale le checkout) ===
    let nightTransitDeparture = 0;
    if (index === appState.zones.length - 1) {
      // Transit retour partant de la dernière zone vers l'arrivée
      const arrTransit = customTransitsList.find(t => t && t.id === 'transit_last_arr');
      if (arrTransit && arrTransit.isNightTransit) {
        nightTransitDeparture = parseInt(arrTransit.nightCount) || 1;
      }
    } else {
      // Transit inter-zones partant vers la zone suivante
      const nextZoneId = appState.zones[index + 1].id;
      const interTransit = customTransitsList.find(t => t && t.id === `transit_${zone.id}_${nextZoneId}`);
      if (interTransit && interTransit.isNightTransit) {
        nightTransitDeparture = parseInt(interTransit.nightCount) || 1;
      }
    }
    
    // Le checkin est décalé par le transit de nuit d'arrivée
    const checkinDay = currentDay + nightTransitArrival;
    // Le checkout est checkin + nuits d'hôtel (le transit de nuit de départ est ajouté après)
    // IMPORTANT : le transit de nuit ne réduit PAS le nombre de nuits d'hôtel
    const checkoutDay = checkinDay + rawNights;
    
    mapping[zone.id] = { 
      checkinDay, 
      checkoutDay, 
      nights: rawNights, 
      rawNights,
      nightTransitArrival,
      nightTransitDeparture,
      // Compatibilité avec ui.js : nombre total de nuits transit pour cette zone
      nightTransitConsumed: nightTransitArrival + nightTransitDeparture
    };
    
    // Le currentDay avance de la durée du séjour hôtel + transit de nuit de départ
    currentDay = checkoutDay + nightTransitDeparture;
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

  const customTransitsList = Array.isArray(appState.customTransits) 
    ? appState.customTransits 
    : Object.values(appState.customTransits || {});

  const firstZone = appState.zones[0];
  const depTransitId = 'transit_dep_first';
  let depTransitObj = { id: depTransitId, name: `Transit Départ ➔ ${firstZone.name}`, day: 0, mode: 'Voiture', fromType: 'dep', toType: 'zone', toZone: firstZone, isNightTransit: false, nightCount: 1, desc: '', fromPoint: null, toPoint: null };
  const customDep = customTransitsList.find(ct => ct.id === depTransitId);
  if (customDep) { depTransitObj = { ...depTransitObj, ...customDep }; }
  transits.push(depTransitObj);

  for (let i = 0; i < appState.zones.length - 1; i++) {
    const from = appState.zones[i];
    const to = appState.zones[i+1];
    const compFrom = computed[from.id];
    const transitId = `transit_${from.id}_${to.id}`;
    // Le transit part le jour même du checkout de la zone (après toutes les nuits d'hôtel)
    const transitDay = compFrom ? compFrom.checkoutDay : 0;
    let transitObj = { id: transitId, name: `Transit : ${from.name} ➔ ${to.name}`, day: transitDay, mode: 'Voiture', from, to, isNightTransit: false, nightCount: 1, desc: '', fromPoint: null, toPoint: null };
    const customT = customTransitsList.find(ct => ct.id === transitId);
    if (customT) { transitObj = { ...transitObj, ...customT }; }
    transits.push(transitObj);
  }

  customTransitsList.forEach(ct => {
    if (!transits.some(t => t.id === ct.id)) {
      transits.push(ct);
    }
  });

  const lastZone = appState.zones[appState.zones.length - 1];
  const compLast = computed[lastZone.id];
  const arrTransitId = 'transit_last_arr';
  // Le transit retour part le jour même du checkout de la dernière zone
  const arrTransitDay = compLast ? compLast.checkoutDay : 0;
  let arrTransitObj = { id: arrTransitId, name: `Transit ${lastZone.name} ➔ Arrivée (Retour)`, day: arrTransitDay, mode: 'Voiture', fromType: 'zone', fromZone: lastZone, toType: 'arr', isNightTransit: false, nightCount: 1, desc: '', fromPoint: null, toPoint: null };
  const customArr = customTransitsList.find(ct => ct.id === arrTransitId);
  if (customArr) { arrTransitObj = { ...arrTransitObj, ...customArr }; }
  transits.push(arrTransitObj);

  return transits;
}

function getDayContextDescription(curDay) {
  const computed = getZoneComputedDates();
  
  const transits = getTransits().filter(t => t.day === curDay);
  const activeTransit = transits.length > 0 ? transits[0] : null;
  
  if (activeTransit && activeTransit.isNightTransit) {
    return `🛌 Transport de nuit (${activeTransit.name}) - Pas d'hôtel requis`;
  }

  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });
  if (!currentZone) return "Hors secteur (Départ / Arrivée)";
  
  const compZone = computed[currentZone.id];
  const activeHotel = (compZone && compZone.nights > 0) ? appState.hotels.find(h => {
    return h.zoneId === currentZone.id && curDay >= compZone.checkinDay && curDay < (compZone.checkinDay + compZone.nights);
  }) : null;
  
  const hotelStr = activeHotel ? ` / Hôtel : ${activeHotel.name}` : ' / 🛌 Nuit en transit ou sans hôtel';
  return `Secteur : ${currentZone.name}${hotelStr}`;
}

function calculateTransitDistances(transit) {
  let originPoint = null;
  let destPoint = null;

  if (transit.id === 'transit_dep_first') {
<<<<<<< HEAD
    // Transit départ global → première zone
    originPoint = transit.fromPoint || appState.departurePoint;
    destPoint = transit.toPoint || (transit.toZone ? getZoneAnchorPoint(transit.toZone.id) : null);
    // Si la première zone n'a pas d'anchor et pas de toPoint, on ne fallback PAS sur arrivalPoint
    // qui est le point final du voyage (sémantiquement incorrect)
  } else if (transit.id === 'transit_last_arr') {
    // Transit dernière zone → arrivée globale
    originPoint = transit.fromPoint || (transit.fromZone ? getZoneAnchorPoint(transit.fromZone.id) : null);
    destPoint = transit.toPoint || appState.arrivalPoint;
    // Idem : on ne fallback PAS sur departurePoint
  } else {
    // Transit inter-zone : origin = zone de départ, dest = zone d'arrivée
    originPoint = transit.fromPoint || (transit.from ? getZoneAnchorPoint(transit.from.id) : null);
    destPoint = transit.toPoint || (transit.to ? getZoneAnchorPoint(transit.to.id) : null);
    // PLUS DE FALLBACK vers departurePoint/arrivalPoint : c'est un bug de contexte
    // Si les zones n'ont pas d'anchor, le transit ne pourra pas être calculé (c'est voulu)
=======
    originPoint = transit.fromPoint || appState.departurePoint;
    destPoint = transit.toPoint || (transit.toZone ? (getZoneAnchorPoint(transit.toZone.id) || appState.arrivalPoint) : appState.arrivalPoint);
  } else if (transit.id === 'transit_last_arr') {
    originPoint = transit.fromPoint || (transit.fromZone ? (getZoneAnchorPoint(transit.fromZone.id) || appState.departurePoint) : appState.departurePoint);
    destPoint = transit.toPoint || appState.arrivalPoint;
  } else {
    originPoint = transit.fromPoint || (transit.from ? (getZoneAnchorPoint(transit.from.id) || appState.departurePoint) : appState.departurePoint);
    destPoint = transit.toPoint || (transit.to ? (getZoneAnchorPoint(transit.to.id) || appState.arrivalPoint) : appState.arrivalPoint);
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
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
  
  const transits = getTransits().filter(t => t.day === curDay);
  const isTransit = transits.length > 0;
  const isNightTransitDay = transits.some(t => t.isNightTransit);

  // Pas d'hôtel actif si la nuit est passée en transport de nuit ou si les nuits effectives de la zone sont épuisées
  const activeHotel = isNightTransitDay ? null : appState.hotels.find(h => {
    const comp = computed[h.zoneId];
    return comp && comp.nights > 0 && curDay >= comp.checkinDay && curDay < (comp.checkinDay + comp.nights);
  });

  const currentZone = appState.zones.find(z => {
    const comp = computed[z.id];
    return comp && curDay >= comp.checkinDay && curDay <= comp.checkoutDay;
  });

  let originPoint = null;
  let destPoint = null;
  let transitSpots = [];

  if (isTransit) {
    const t = transits[0];
    const tCalc = calculateTransitDistances(t);
    originPoint = tCalc.originPoint;
    destPoint = tCalc.destPoint;
    transitSpots = tCalc.transitSpots;
  } else if (activeHotel) {
    originPoint = activeHotel;
    destPoint = activeHotel;
  } else if (currentZone) {
    const anchor = getZoneAnchorPoint(currentZone.id);
    if (anchor) {
      originPoint = anchor;
      destPoint = anchor;
    } else if (curDay === 0) {
      originPoint = appState.departurePoint;
<<<<<<< HEAD
      destPoint = appState.zones.length > 0 ? getZoneAnchorPoint(appState.zones[0].id) : null;
    } else {
      // Zone sans anchor : fallback prudent vers arrivalPoint (point final du voyage)
      // Ce fallback est le moindre mal — le résultat sera imprécis mais pas erroné
      // (contrairement à departurePoint qui renvoie au début du voyage)
=======
      destPoint = appState.arrivalPoint;
    } else {
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
      originPoint = appState.arrivalPoint;
      destPoint = appState.arrivalPoint;
    }
  } else if (curDay === 0) {
    originPoint = appState.departurePoint;
    destPoint = appState.zones.length > 0 ? (getZoneAnchorPoint(appState.zones[0].id) || appState.arrivalPoint) : appState.arrivalPoint;
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

function getOsrmProfile(mode) {
  if (mode === 'Vélo') return 'bicycle';
  return 'car';
}

async function fetchOsrmRoute(points, mode = 'Voiture') {
  if (!points || points.length < 2) return null;
  
  if (mode === 'Avion' || mode === 'Bateau' || mode === 'À pied') {
    return null;
  }

  const profile = getOsrmProfile(mode);
  const coordsStr = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=false&alternatives=true&steps=false`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Erreur réseau OSRM');
    const data = await res.json();

    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
      const mainRoute = data.routes[0];
      return {
        distanceKm: mainRoute.distance / 1000,
        durationMin: mainRoute.duration / 60,
        legs: (mainRoute.legs || []).map(leg => ({
          distanceKm: leg.distance / 1000,
          durationMin: leg.duration / 60
        })),
        alternatives: data.routes.slice(1).map(r => ({
          distanceKm: r.distance / 1000,
          durationMin: r.duration / 60
        }))
      };
    }
  } catch (err) {
    console.log("OSRM non disponible (offline/timeout), repli sur Haversine.");
  }
  return null;
}

function initRouteCache() {
  if (!appState.routeCache) appState.routeCache = {};
}

function updateRecalculateButtonState() {
  const btn = document.getElementById('recalculateOsrmBtn');
  if (!btn) return;
  btn.disabled = false;
  btn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function invalidateRouteCache() {
  appState.routeCache = {};
  appState.isCacheStale = true;
  updateRecalculateButtonState();
  console.log("Cache OSRM global invalidé : tout sera recalculé proprement.");
}

function getEffectiveDistanceAndDuration(cacheKey, fallbackDistanceKm) {
  if (appState.routeCache && appState.routeCache[cacheKey]) {
    const route = appState.routeCache[cacheKey];
    if (route && route.distanceKm !== undefined) {
      return {
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
        legs: route.legs || [],
        isOsrm: true,
        alternatives: route.alternatives || []
      };
    }
  }
  return {
    distanceKm: fallbackDistanceKm,
    durationMin: null,
    legs: [],
    isOsrm: false,
    alternatives: []
  };
}

function getSegmentOsrmData(cacheKey, segmentIndex, fallbackDistKm, totalDayFallbackDist) {
  if (appState.routeCache && appState.routeCache[cacheKey]) {
    const routeObj = appState.routeCache[cacheKey];
    
    if (routeObj && routeObj.legs && routeObj.legs[segmentIndex]) {
      const leg = routeObj.legs[segmentIndex];
      return {
        distanceKm: leg.distanceKm,
        durationMin: leg.durationMin,
        isOsrm: true
      };
    }
    
    if (routeObj && routeObj.distanceKm && totalDayFallbackDist > 0) {
      const ratio = fallbackDistKm / totalDayFallbackDist;
      return {
        distanceKm: routeObj.distanceKm * ratio,
        durationMin: routeObj.durationMin ? routeObj.durationMin * ratio : null,
        isOsrm: true
      };
    }
  }

  return {
    distanceKm: fallbackDistKm,
    durationMin: null,
    isOsrm: false
  };
}
