<<<<<<< HEAD
﻿// ==========================================
=======
// ==========================================
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
// ui.planning.js — Fonctions pour le Planning par Jour
// ==========================================

function renderPlanningByDay() {
  var container = document.getElementById('planningByDayContainer');
  if (!container) return;
  var totalDays = getTotalDays();
  var html = '';
  for (var d = 0; d < totalDays; d++) {
    var zone = getZoneForDay(d);
    var hotel = getHotelForDay(d);
    var dayRoute = calculateDayRoute(d);
    var dateStr = deltaToDateStr(d);
    var shortDate = deltaToShortDateStr(d);
    var transitsForDay = getTransits().filter(function(t) { return t.day === d; });
    var daySpots = getDaySpots(d);
    var dayBps = getDayBonsPlans(d);
    
    html += '<div class="planning-day-card rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-4" id="planning-day-' + d + '">';
    
    // HEADER
    html += '<div class="bg-gradient-to-r from-slate-100 to-white dark:from-slate-900 dark:to-slate-950 p-3.5 border-b border-slate-200 dark:border-slate-800">';
    html += '<div class="flex flex-wrap items-center justify-between gap-2">';
    html += '<div class="flex items-center space-x-2">';
    html += '<button onclick="jumpToDay(' + d + ')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition">J+' + d + '</button>';
    html += '<div>';
    html += '<span class="text-sm font-semibold text-slate-900 dark:text-white">' + dateStr + '</span>';
    html += '<span class="text-xs text-slate-500 dark:text-slate-400 ml-1">(' + shortDate + ')</span>';
    html += '</div></div>';
    html += '<div class="flex items-center space-x-2">';
    html += '<span class="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">' + dayRoute.totalDist.toFixed(1) + ' km</span>';
    if (zone) {
      html += '<span class="px-2.5 py-1 rounded text-xs font-bold text-white" style="background:' + zone.color + '" onclick="jumpToDay(' + d + ');switchLeftTab(\'structure\');">' + zone.name + '</span>';
    } else {
      html += '<span class="text-xs bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded">Hors zone</span>';
    }
    html += '</div></div>';
    if (hotel) {
      html += '<div class="mt-2 text-xs text-blue-700 dark:text-blue-300 flex items-center">';
      html += '<i class="fa-solid fa-hotel mr-1.5"></i>';
      html += '<strong>' + hotel.name + '</strong>';
      if (hotel.desc) html += ' <span class="text-slate-500 dark:text-slate-400 ml-1">' + hotel.desc + '</span>';
      html += '</div>';
    }

    // TRANSITS
    if (transitsForDay.length > 0) {
      for (var ti = 0; ti < transitsForDay.length; ti++) {
        html += _renderTransitCard(transitsForDay[ti], d);
      }
    }

    // SPOTS
    if (daySpots.length > 0) {
      html += '<div class="px-3 pb-3">';
      html += '<span class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Spots programmés (' + daySpots.length + ')</span>';
      html += '<div class="space-y-1.5 mt-2">';
      for (var si = 0; si < daySpots.length; si++) {
        var spot = daySpots[si];
        var parentSpot = spot.parentId ? appState.spots.find(function(p) { return p.id === spot.parentId; }) : null;
        var segDist = dayRoute.segmentsDistances[si] !== undefined ? dayRoute.segmentsDistances[si] : 0;
        html += '<div class="flex items-center justify-between text-xs py-1.5 px-2.5 bg-white dark:bg-slate-900/80 rounded-lg border border-slate-200 dark:border-slate-800/60">';
        html += '<div class="flex items-center space-x-2 truncate">';
        html += '<span class="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 cursor-pointer" onclick="centerMapOnCoords(' + spot.lat + ',' + spot.lng + ')" title="Centrer">' + (si + 1) + '</span>';
        html += '<span class="text-slate-900 dark:text-slate-200 font-medium cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 truncate" onclick="centerMapOnCoords(' + spot.lat + ',' + spot.lng + ')">' + spot.name + '</span>';
        if (parentSpot) html += '<span class="text-[10px] text-indigo-600 dark:text-indigo-400">↳ ' + parentSpot.name + '</span>';
        html += '</div>';
        html += '<div class="flex items-center space-x-1.5 shrink-0 ml-2">';
        html += '<span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">' + segDist.toFixed(1) + ' km</span>';
        html += '<button onclick="centerMapOnCoords(' + spot.lat + ',' + spot.lng + ')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>';
        html += '<a href="' + getGoogleMapsUrl(spot.lat, spot.lng) + '" target="_blank" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-emerald-600 dark:text-emerald-400 rounded transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>';
        html += '<button onclick="editSpot(\'' + spot.id + '\')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600 dark:text-indigo-400 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>';
        html += '<button onclick="detachSpotFromDay(' + d + ',\'' + spot.id + '\')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-400 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>';
        html += '</div></div>';
      }
      html += '</div></div>';
    }

    // BONS PLANS
    if (dayBps.length > 0) {
      html += '<div class="px-3 pb-3">';
      html += '<span class="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Bons plans (' + dayBps.length + ')</span>';
      html += '<div class="space-y-1.5 mt-2">';
      for (var bpi = 0; bpi < dayBps.length; bpi++) {
        var bp = dayBps[bpi];
        html += '<div class="flex items-center justify-between text-xs py-1.5 px-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800/40">';
        html += '<div class="flex items-center space-x-2 truncate">';
        html += '<i class="fa-solid fa-lightbulb text-amber-500 dark:text-amber-400"></i>';
        html += '<span class="text-amber-900 dark:text-amber-200 font-medium cursor-pointer hover:underline" onclick="centerMapOnCoords(' + bp.lat + ',' + bp.lng + ')">' + bp.title;
        html += ' <span class="text-[10px] text-amber-600 dark:text-amber-400">(' + bp.category + ')</span>';
        html += '</span></div>';
        html += '<div class="flex items-center space-x-1.5 shrink-0">';
        html += '<button onclick="centerMapOnCoords(' + bp.lat + ',' + bp.lng + ')" class="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>';
        html += '<a href="' + getGoogleMapsUrl(bp.lat, bp.lng) + '" target="_blank" class="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 rounded transition" title="Maps"><i class="fa-solid fa-map-location-dot"></i></a>';
        html += '<button onclick="editBonPlan(\'' + bp.id + '\')" class="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-indigo-600 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>';
        html += '<button onclick="detachBonPlanFromDay(' + d + ',\'' + bp.id + '\')" class="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-red-500 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>';
        html += '</div></div>';
      }
      html += '</div></div>';
    }

    // JOUR VIDE
    if (transitsForDay.length === 0 && daySpots.length === 0 && dayBps.length === 0 && !hotel) {
      html += '<div class="px-3 py-4 text-center"><p class="text-xs text-slate-400 dark:text-slate-600 italic">Aucun programme pour ce jour</p></div>';
    }
    html += '</div>';
  }
  container.innerHTML = html;
}

<<<<<<< HEAD
=======
    html += '</div>';

>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
// ==========================================
// Helper: Render un transit card
// ==========================================

function _renderTransitCard(t, day) {
  var tCalc = calculateTransitDistances(t);
  var isRoad = isRoadTransitMode(t.mode, t.isNightTransit);
  var routeInfo = isRoad ? getEffectiveDistanceAndDuration(t.id, tCalc.totalDist) : { isOsrm: false, distanceKm: tCalc.totalDist, durationMin: null };
  var modeIcon = getTransitModeIcon(t.mode);
  var durStr = routeInfo.durationMin ? ' (~' + formatDuration(routeInfo.durationMin) + ')' : '';
  
  var isNight = t.isNightTransit;
  var colorClass = isNight ? 'purple' : 'amber';
  var bgClass = isNight ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40';
  var textColor = isNight ? 'text-purple-800 dark:text-purple-300' : 'text-amber-800 dark:text-amber-300';
  var lightBg = isNight ? 'border-purple-200 dark:border-purple-800/30' : 'border-amber-200 dark:border-amber-800/30';
  var titleText = isNight ? 'TRANSIT DE NUIT' : 'TRANSIT';
  var iconHtml = isNight ? '<i class="fa-solid fa-moon text-purple-600 dark:text-purple-400"></i>' : '<span class="text-lg">' + modeIcon + '</span>';
  var titleColor = isNight ? 'text-purple-900 dark:text-purple-200' : 'text-amber-900 dark:text-amber-200';
  
  var html = '<div class="m-3 ' + bgClass + ' rounded-xl p-3 border-l-4 border-l-' + colorClass + '-500">';
  html += '<div class="flex items-center justify-between mb-2">';
  html += '<div class="flex items-center space-x-2">' + iconHtml + '<strong class="text-sm ' + titleColor + '">' + titleText + '</strong></div>';
  html += '<span class="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">' + routeInfo.distanceKm.toFixed(1) + ' km' + durStr + '</span>';
  html += '</div>';
  html += '<div class="text-xs ' + textColor + ' space-y-1">';
  html += '<div><strong>' + t.name + '</strong> — Mode : <em>' + (t.mode || 'Voiture') + '</em></div>';
  
  if (isNight) {
    var depDate = deltaToDateStr(day);
    var arrDate = deltaToDateStr(day + 1);
    html += '<div class="flex items-center space-x-2 mt-2">';
    html += '<span class="text-emerald-700 dark:text-emerald-400 font-semibold cursor-pointer hover:underline" onclick="jumpToDay(' + day + ')"><i class="fa-solid fa-circle-dot text-[8px] mr-1"></i>' + depDate + ' (J+' + day + ')</span>';
    html += '<i class="fa-solid fa-arrow-right text-' + colorClass + '-400"></i>';
    html += '<span class="text-amber-700 dark:text-amber-400 font-semibold cursor-pointer hover:underline" onclick="jumpToDay(' + (day + 1) + ')"><i class="fa-solid fa-flag-checkered text-[8px] mr-1"></i>' + arrDate + ' (J+' + (day + 1) + ')</span>';
    html += '</div>';
  } else {
    if (tCalc.originPoint) {
      html += '<div><i class="fa-solid fa-circle-dot text-[8px] mr-1"></i>De : <span class="cursor-pointer hover:underline" onclick="centerMapOnCoords(' + tCalc.originPoint.lat + ',' + tCalc.originPoint.lng + ')">' + tCalc.originPoint.name + '</span></div>';
    }
    if (tCalc.destPoint) {
      html += '<div><i class="fa-solid fa-flag-checkered text-[8px] mr-1"></i>À : <span class="cursor-pointer hover:underline" onclick="centerMapOnCoords(' + tCalc.destPoint.lat + ',' + tCalc.destPoint.lng + ')">' + tCalc.destPoint.name + '</span></div>';
    }
  }
  if (t.desc) {
    html += '<div class="mt-1.5 text-slate-600 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 p-2 rounded-lg whitespace-pre-line font-mono">' + t.desc + '</div>';
  }
  html += '</div>';
  
  if (tCalc.transitSpots.length > 0) {
    html += '<div class="mt-2 pt-2 border-t border-' + colorClass + '-200 dark:border-' + colorClass + '-800/40">';
    html += '<span class="text-[10px] font-semibold text-' + colorClass + '-600 dark:text-' + colorClass + '-400 uppercase tracking-wider">Spots associés :</span>';
    html += '<div class="space-y-1 mt-1.5">';
    for (var tsi = 0; tsi < tCalc.transitSpots.length; tsi++) {
      var ts = tCalc.transitSpots[tsi];
      html += '<div class="flex items-center justify-between text-xs py-1 px-2 bg-white/60 dark:bg-slate-900/60 rounded ' + lightBg + '">';
      var spotColor = isNight ? 'text-purple-600 dark:text-purple-300' : 'text-amber-600 dark:text-amber-300';
      var iconColor = isNight ? 'text-purple-500' : 'text-amber-500';
      html += '<span class="' + spotColor + ' font-medium cursor-pointer hover:underline" onclick="centerMapOnCoords(' + ts.lat + ',' + ts.lng + ')">';
      html += '<i class="fa-solid fa-train ' + iconColor + ' mr-1.5 text-[10px]"></i>' + ts.name;
      html += '</span>';
      html += '<div class="flex items-center space-x-1 shrink-0">';
      html += '<button onclick="centerMapOnCoords(' + ts.lat + ',' + ts.lng + ')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 rounded transition" title="Centrer"><i class="fa-solid fa-crosshairs"></i></button>';
      html += '<button onclick="editSpot(\'' + ts.id + '\')" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-500 rounded transition" title="Éditer"><i class="fa-solid fa-pen-to-square"></i></button>';
      html += '<button onclick="unassignSpot(\'' + ts.id + '\')" class="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 rounded transition" title="Détacher"><i class="fa-solid fa-link-slash"></i></button>';
      html += '</div></div>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}


// ==========================================
// Fonctions utilitaires pour détacher des éléments d'un jour
// ==========================================

function detachSpotFromDay(day, spotId) {
  if (!confirm('Détacher ce spot de ce jour ?')) return;
  const ids = appState.dailyItineraries[day] || [];
  appState.dailyItineraries[day] = ids.filter(id => id !== spotId);
  renderAll();
  renderPlanningByDay();
}

function detachBonPlanFromDay(day, bpId) {
  if (!confirm('Détacher ce bon plan de ce jour ?')) return;
  const ids = appState.dailyBonsPlans[day] || [];
<<<<<<< HEAD
  appState.dailyBonsPlans[day] = ids.filter(id => id !== bpId);
  renderAll();
  renderPlanningByDay();
}
=======

// ==========================================
// SPOTS CONTROLS — Tri et Filtre
// ==========================================
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd

function updateSpotsReferenceSelects() {
  const refSelect = document.getElementById('spotsReferencePoint');
  const filterSelect = document.getElementById('spotsFilterZone');
  if (!refSelect || !filterSelect) return;

  const currentRef = refSelect.value;
  const currentFilter = filterSelect.value;

  // Refill reference points (hotels + zones anchors)
  let refOptions = '<option value="">-- Point de référence --</option>';
  appState.hotels.forEach(h => {
    refOptions += '<option value="hotel:' + h.id + '">' + h.name + ' (Hôtel)</option>';
  });
  appState.zones.forEach(z => {
    refOptions += '<option value="zone:' + z.id + '">' + z.name + ' (Zone)</option>';
  });
  refSelect.innerHTML = refOptions;
  refSelect.value = currentRef;

  // Refill zone filter
  let filterOptions = '<option value="">🔍 Toutes les zones</option>';
  appState.zones.forEach(z => {
    filterOptions += '<option value="' + z.id + '">' + z.name + '</option>';
  });
  filterSelect.innerHTML = filterOptions;
  filterSelect.value = currentFilter;
}

// Get reference point coordinates
function getReferencePoint() {
  const refSelect = document.getElementById('spotsReferencePoint');
  if (!refSelect || !refSelect.value) return null;
  const val = refSelect.value;
  if (val.startsWith('hotel:')) {
    const hotelId = val.substring(6);
    const hotel = appState.hotels.find(h => h.id === hotelId);
    return hotel ? { lat: hotel.lat, lng: hotel.lng, type: 'hotel' } : null;
  } else if (val.startsWith('zone:')) {
    const zoneId = val.substring(5);
    const anchor = getZoneAnchorPoint(zoneId);
    return anchor ? { lat: anchor.lat, lng: anchor.lng, type: 'zone' } : null;
  }
  return null;
}

// Apply sort/filter to spots before rendering
function getFilteredSortedSpots() {
  let spots = [...appState.spots];
  
  // 1. Filter by zone
  const filterZone = document.getElementById('spotsFilterZone')?.value;
  if (filterZone) {
    spots = spots.filter(s => isSpotInZone(s.id, filterZone));
  }
  
  // 2. Filter by search
  const searchInput = document.getElementById('spotsSearchInput');
  if (searchInput && searchInput.value.trim()) {
    const search = searchInput.value.toLowerCase().trim();
    spots = spots.filter(s => s.name.toLowerCase().includes(search) || (s.desc && s.desc.toLowerCase().includes(search)));
  }
  
  // 3. Sort
  const sortMode = document.getElementById('spotsSortMode')?.value || 'alpha';
  if (sortMode === 'alpha') {
    spots.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  } else if (sortMode === 'distance_hotel' || sortMode === 'distance_zone') {
    const ref = getReferencePoint();
    if (ref) {
      spots.sort((a, b) => {
        const distA = haversineDistanceKm(ref.lat, ref.lng, a.lat, a.lng);
        const distB = haversineDistanceKm(ref.lat, ref.lng, b.lat, b.lng);
        return distA - distB;
      });
    } else {
      spots.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    }
  }
  
  return spots;
}
<<<<<<< HEAD
// ==========================================
// 5 FONCTIONS MANQUANTES NÉCESSAIRES
// ==========================================

/**
 * Trouve la zone associée à un jour donné
 */
function getZoneForDay(d) {
  const computed = getZoneComputedDates();
  for (const zoneId in computed) {
    const comp = computed[zoneId];
    if (d >= comp.checkinDay && d < comp.checkoutDay) {
      return appState.zones.find(z => z.id === zoneId) || null;
    }
  }
  return null;
}

/**
 * Trouve l'hôtel assigné à un jour donné
 */
function getHotelForDay(d) {
  const zone = getZoneForDay(d);
  if (!zone) return null;
  return appState.hotels.find(h => h.zoneId === zone.id) || null;
}

/**
 * Récupère les spots programmés pour un jour donné
 */
function getDaySpots(d) {
  return (appState.dailyItineraries[d] || []).map(id => {
    return appState.spots.find(s => s.id === id) || null;
  }).filter(Boolean);
}

/**
 * Récupère les bons plans programmés pour un jour donné
 */
function getDayBonsPlans(d) {
  return (appState.dailyBonsPlans[d] || []).map(id => {
    return appState.bonsPlans.find(bp => bp.id === id) || null;
  }).filter(Boolean);
}

/**
 * Vérifie si un spot est dans une zone donnée.
 * Un spot est "dans" une zone si :
 * 1. Il a une zoneId directe
 * 2. Il est programmé un jour qui appartient à cette zone
 * 3. Il a comme target un transit qui dessert cette zone
 */
function isSpotInZone(spotId, zoneId) {
  const spot = appState.spots.find(s => s.id === spotId);
  if (!spot) return false;

  // 1. Vérifier zoneId directe sur le spot
  if (spot.zoneId && spot.zoneId === zoneId) return true;

  // 2. Vérifier si le spot est programmé un jour qui appartient à cette zone
  const computed = getZoneComputedDates();
  for (const day in appState.dailyItineraries) {
    const dayNum = parseInt(day);
    if (appState.dailyItineraries[day] && appState.dailyItineraries[day].includes(spotId)) {
      for (const zId in computed) {
        const comp = computed[zId];
        if (dayNum >= comp.checkinDay && dayNum < comp.checkoutDay && zId === zoneId) {
          return true;
        }
      }
    }
  }

  // 3. Vérifier si le spot a comme target un transit qui dessert cette zone
  if (spot.target) {
    const transits = getTransits();
    const t = transits.find(t => t.id === spot.target);
    if (t) {
      if (t.from && t.from.id === zoneId) return true;
      if (t.to && t.to.id === zoneId) return true;
      if (t.fromType === 'zone' && t.fromZone && t.fromZone.id === zoneId) return true;
      if (t.toType === 'zone' && t.toZone && t.toZone.id === zoneId) return true;
    }
  }

  return false;
}
=======

  appState.dailyBonsPlans[day] = ids.filter(id => id !== bpId);
  renderAll();
  renderPlanningByDay();
}
>>>>>>> 4ed0cf4643d95e0d6d2846460e7e9c332f6f2dfd
