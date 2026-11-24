/* ==========================================================================
   GeoVoyage - Carte Leaflet et géolocalisation (map.js)
   Version mise à jour avec invalidation automatique du cache OSRM (invalidateRouteCache)
   ========================================================================== */

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
    
    // ➔ Invalidation du cache OSRM (changement de coordonnées sur la carte)
    if (typeof invalidateRouteCache === 'function') invalidateRouteCache();
    
    renderApp();
    saveToLocalStorage();
  } else if (mapPickMode === 'endpoint_arrival') {
    appState.arrivalPoint.lat = parseFloat(lat.toFixed(6));
    appState.arrivalPoint.lng = parseFloat(lng.toFixed(6));
    cleanOrphanTransitsAndTargets();
    
    // ➔ Invalidation du cache OSRM
    if (typeof invalidateRouteCache === 'function') invalidateRouteCache();
    
    renderApp();
    saveToLocalStorage();
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
      const shortName = (item.display_name.split(',')[0] || '').replace(/'/g, "\'");
      const fullDesc = item.display_name.replace(/'/g, "\'");

      map.setView([lat, lon], 13);
      const popupContent = document.createElement("div");
      popupContent.className = "text-xs font-sans p-1.5 space-y-2";

      const titleEl = document.createElement("b");
      titleEl.textContent = item.display_name.split(",")[0];
      popupContent.appendChild(titleEl);

      const btnGroup = document.createElement("div");
      btnGroup.className = "flex gap-1.5";

      const spotBtn = document.createElement("button");
      spotBtn.className = "bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-xs";
      spotBtn.textContent = "+ Spot";
      spotBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("[quickAdd] SPOT clicked:", { lat, lon, name: item.display_name.split(",")[0], desc: item.display_name });
        quickAdd("spot", lat, lon, item.display_name.split(",")[0], item.display_name);
      });

      const hotelBtn = document.createElement("button");
      hotelBtn.className = "bg-blue-600 text-white px-2.5 py-1 rounded-lg text-xs";
      hotelBtn.textContent = "+ Hôtel";
      hotelBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("[quickAdd] HOTEL clicked:", { lat, lon, name: item.display_name.split(",")[0], desc: item.display_name });
        quickAdd("hotel", lat, lon, item.display_name.split(",")[0], item.display_name);
      });

      const bonplanBtn = document.createElement("button");
      bonplanBtn.className = "bg-amber-600 text-white px-2.5 py-1 rounded-lg text-xs";
      bonplanBtn.textContent = "+ Bon Plan";
      bonplanBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log("[quickAdd] BONPLAN clicked:", { lat, lon, name: item.display_name.split(",")[0], desc: item.display_name });
        quickAdd("bonplan", lat, lon, item.display_name.split(",")[0], item.display_name);
      });

      btnGroup.appendChild(spotBtn);
      btnGroup.appendChild(hotelBtn);
      btnGroup.appendChild(bonplanBtn);
      popupContent.appendChild(btnGroup);

      L.popup()
        .setLatLng([lat, lon])
        .setContent(popupContent)
        .openOn(map);
      container.classList.add('hidden');
    };
    container.appendChild(el);
  });
}

function quickAdd(type, lat, lng, name = '', desc = '') {
  console.log('[quickAdd] Function called:', { type, lat, lng, name: name?.substring(0, 50), desc: desc?.substring(0, 50) });
  map.closePopup();
  console.log('[quickAdd] Popup closed');
  if (type === 'spot') {
    console.log('[quickAdd] Opening spot modal...');
    openSpotModal();
    console.log('[quickAdd] Setting spot fields...');
    const spotLatEl = document.getElementById('spotLat');
    const spotLngEl = document.getElementById('spotLng');
    const spotNameEl = document.getElementById('spotName');
    const spotDescEl = document.getElementById('spotDesc');
    if (spotLatEl) spotLatEl.value = lat; else console.error('[quickAdd] spotLat element not found');
    if (spotLngEl) spotLngEl.value = lng; else console.error('[quickAdd] spotLng element not found');
    if (name && spotNameEl) spotNameEl.value = name; else console.warn('[quickAdd] name is empty or spotName element not found');
    if (desc && spotDescEl) spotDescEl.value = desc;
    console.log('[quickAdd] Spot modal opened, lat=' + lat + ', lng=' + lng + ', name=' + (name || '(empty)'));
  }
  else if (type === 'hotel') {
    console.log('[quickAdd] Opening hotel modal...');
    openHotelModal();
    console.log('[quickAdd] Setting hotel fields...');
    const hotelLatEl = document.getElementById('hotelLat');
    const hotelLngEl = document.getElementById('hotelLng');
    const hotelNameEl = document.getElementById('hotelName');
    const hotelDescEl = document.getElementById('hotelDesc');
    if (hotelLatEl) hotelLatEl.value = lat; else console.error('[quickAdd] hotelLat element not found');
    if (hotelLngEl) hotelLngEl.value = lng; else console.error('[quickAdd] hotelLng element not found');
    if (name && hotelNameEl) hotelNameEl.value = name; else console.warn('[quickAdd] name is empty or hotelName element not found');
    if (desc && hotelDescEl) hotelDescEl.value = desc;
    console.log('[quickAdd] Hotel modal opened, lat=' + lat + ', lng=' + lng + ', name=' + (name || '(empty)'));
  }
  else if (type === 'bonplan') {
    console.log('[quickAdd] Opening bonplan modal...');
    openBonPlanModal();
    console.log('[quickAdd] Setting bonplan fields...');
    const bpLatEl = document.getElementById('bonPlanLat');
    const bpLngEl = document.getElementById('bonPlanLng');
    const bpTitleEl = document.getElementById('bonPlanTitle');
    const bpDescEl = document.getElementById('bonPlanDesc');
    if (bpLatEl) bpLatEl.value = lat; else console.error('[quickAdd] bonPlanLat element not found');
    if (bpLngEl) bpLngEl.value = lng; else console.error('[quickAdd] bonPlanLng element not found');
    if (name && bpTitleEl) bpTitleEl.value = name; else console.warn('[quickAdd] name is empty or bonPlanTitle element not found');
    if (desc && bpDescEl) bpDescEl.value = desc;
    console.log('[quickAdd] BonPlan modal opened, lat=' + lat + ', lng=' + lng + ', name=' + (name || '(empty)'));
  }
  else {
    console.error('[quickAdd] Unknown type:', type);
  }
}
