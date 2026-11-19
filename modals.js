/* ==========================================================================
   GeoVoyage - Modals, Forms & Import/Export (modals.js)
   Version mise à jour avec prise en charge des transits de nuit (isNightTransit & fromPoint/toPoint)
   ========================================================================== */

// ==========================================
// 1. GESTION DES MODALES (OUVERTURE / FERMETURE)
// ==========================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('hidden');
  }
}

// ==========================================
// 2. GESTION ET ÉDITION DES SPOTS
// ==========================================

function openSpotModal(spotId = null) {
  console.log('[openSpotModal] Called with spotId:', spotId);
  const form = document.getElementById('spotForm');
  if (form) form.reset();

  const preview = document.getElementById('spotPhotoPreview');
  if (preview) preview.classList.add('hidden');

  console.log('[openSpotModal] DOM elements ready:', {
    spotForm: !!document.getElementById('spotForm'),
    spotName: !!document.getElementById('spotName'),
    spotLat: !!document.getElementById('spotLat'),
    spotLng: !!document.getElementById('spotLng'),
    spotDesc: !!document.getElementById('spotDesc')
  });

  document.getElementById('spotParentId').value = '';
  document.getElementById('spotParentSearch').value = '';
  document.getElementById('spotTargetType').value = '';
  document.getElementById('spotTargetValue').value = '';
  document.getElementById('spotTargetSearch').value = '';

  if (spotId) {
    const spot = appState.spots.find(s => s.id === spotId);
    if (spot) {
      document.getElementById('spotModalTitle').innerText = 'Éditer le Spot';
      document.getElementById('spotId').value = spot.id;
      document.getElementById('spotName').value = spot.name;
      document.getElementById('spotLat').value = spot.lat;
      document.getElementById('spotLng').value = spot.lng;
      document.getElementById('spotDesc').value = spot.desc || '';
      document.getElementById('spotUrl').value = spot.url || '';

      if (spot.parentId) {
        document.getElementById('spotParentId').value = spot.parentId;
        const parent = appState.spots.find(p => p.id === spot.parentId);
        if (parent) document.getElementById('spotParentSearch').value = parent.name;
      }

      if (spot.target) {
        document.getElementById('spotTargetType').value = 'transit';
        document.getElementById('spotTargetValue').value = spot.target;
        const tObj = getTransits().find(t => t.id === spot.target);
        if (tObj) document.getElementById('spotTargetSearch').value = `Transit: ${tObj.name}`;
      } else {
        let assignedDay = null;
        Object.keys(appState.dailyItineraries).forEach(d => {
          if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(spot.id)) {
            assignedDay = d;
          }
        });
        if (assignedDay !== null) {
          document.getElementById('spotTargetType').value = 'day';
          document.getElementById('spotTargetValue').value = assignedDay;
          document.getElementById('spotTargetSearch').value = `Jour J+${assignedDay} (${deltaToDateStr(assignedDay)})`;
        }
      }

      if (spot.imageBase64) {
        const imgThumb = document.getElementById('spotImgThumb');
        if (imgThumb) imgThumb.src = spot.imageBase64;
        if (preview) preview.classList.remove('hidden');
      }
    }
  } else {
    document.getElementById('spotModalTitle').innerText = 'Ajouter un Spot';
    document.getElementById('spotId').value = '';
  }

  openModal('spotModal');
}

function editSpot(spotId) {
  openSpotModal(spotId);
}

function createSubSpot(parentId) {
  openSpotModal();
  const parent = appState.spots.find(p => p.id === parentId);
  if (parent) {
    document.getElementById('spotParentId').value = parent.id;
    document.getElementById('spotParentSearch').value = parent.name;
  }
}

function saveSpot(event) {
  event.preventDefault();
  const id = document.getElementById('spotId').value;
  const name = document.getElementById('spotName').value.trim();
  const lat = parseFloat(document.getElementById('spotLat').value);
  const lng = parseFloat(document.getElementById('spotLng').value);
  const desc = document.getElementById('spotDesc').value.trim();
  const url = document.getElementById('spotUrl').value.trim();
  const parentId = document.getElementById('spotParentId').value || null;
  const targetType = document.getElementById('spotTargetType').value;
  const targetVal = document.getElementById('spotTargetValue').value;

  const preview = document.getElementById('spotPhotoPreview');
  const imgThumb = document.getElementById('spotImgThumb');
  let imageBase64 = null;
  if (preview && !preview.classList.contains('hidden') && imgThumb) {
    imageBase64 = imgThumb.src;
  }

  let spotObj;
  if (id) {
    spotObj = appState.spots.find(s => s.id === id);
    if (spotObj) {
      spotObj.name = name;
      spotObj.lat = lat;
      spotObj.lng = lng;
      spotObj.desc = desc;
      spotObj.url = url;
      spotObj.parentId = parentId;
      spotObj.imageBase64 = imageBase64;
    }
  } else {
    spotObj = {
      id: 'spot_' + Date.now(),
      name,
      lat,
      lng,
      desc,
      url,
      parentId,
      imageBase64
    };
    appState.spots.push(spotObj);
  }

  spotObj.target = null;
  Object.keys(appState.dailyItineraries).forEach(d => {
    if (appState.dailyItineraries[d]) {
      appState.dailyItineraries[d] = appState.dailyItineraries[d].filter(sId => sId !== spotObj.id);
    }
  });

  if (targetType === 'transit') {
    spotObj.target = targetVal;
  } else if (targetType === 'day') {
    const dayNum = parseInt(targetVal);
    if (!appState.dailyItineraries[dayNum]) appState.dailyItineraries[dayNum] = [];
    if (!appState.dailyItineraries[dayNum].includes(spotObj.id)) {
      appState.dailyItineraries[dayNum].push(spotObj.id);
    }
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  closeModal('spotModal');
  renderApp();
  saveToLocalStorage();
}

function deleteSpot(spotId) {
  if (confirm('Voulez-vous vraiment supprimer ce spot ?')) {
    appState.spots = appState.spots.filter(s => s.id !== spotId);

    appState.spots.forEach(s => {
      if (s.parentId === spotId) s.parentId = null;
    });

    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d]) {
        appState.dailyItineraries[d] = appState.dailyItineraries[d].filter(id => id !== spotId);
      }
    });

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

function universalAssignSpot(spotId, targetValue) {
  const spot = appState.spots.find(s => s.id === spotId);
  if (!spot) return;

  spot.target = null;
  Object.keys(appState.dailyItineraries).forEach(d => {
    if (appState.dailyItineraries[d]) {
      appState.dailyItineraries[d] = appState.dailyItineraries[d].filter(id => id !== spotId);
    }
  });

  if (targetValue.startsWith('transit:')) {
    spot.target = targetValue.replace('transit:', '');
  } else if (targetValue.startsWith('day:')) {
    const day = parseInt(targetValue.replace('day:', ''));
    if (!appState.dailyItineraries[day]) appState.dailyItineraries[day] = [];
    if (!appState.dailyItineraries[day].includes(spotId)) {
      appState.dailyItineraries[day].push(spotId);
    }
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  renderApp();
  saveToLocalStorage();
}

function unassignSpot(spotId) {
  const spot = appState.spots.find(s => s.id === spotId);
  if (spot) {
    spot.target = null;
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d]) {
        appState.dailyItineraries[d] = appState.dailyItineraries[d].filter(id => id !== spotId);
      }
    });

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

function removeSpotImage() {
  const preview = document.getElementById('spotPhotoPreview');
  const imgThumb = document.getElementById('spotImgThumb');
  if (imgThumb) imgThumb.src = '';
  if (preview) preview.classList.add('hidden');
}

// ==========================================
// 3. GESTION ET ÉDITION DES HÔTELS / ZONES
// ==========================================

function openHotelModal(hotelId = null) {
  const form = document.getElementById('hotelForm');
  if (form) form.reset();

  const zoneSelect = document.getElementById('hotelZoneSelect');
  if (zoneSelect) {
    zoneSelect.innerHTML = '<option value="" disabled selected>-- Choisir une zone obligatoirement --</option>';
    appState.zones.forEach(z => {
      zoneSelect.innerHTML += `<option value="${z.id}">${z.name}</option>`;
    });
  }

  if (hotelId) {
    const hotel = appState.hotels.find(h => h.id === hotelId);
    if (hotel) {
      document.getElementById('hotelModalTitle').innerText = 'Éditer l\'Hébergement';
      document.getElementById('hotelId').value = hotel.id;
      document.getElementById('hotelName').value = hotel.name;
      document.getElementById('hotelLat').value = hotel.lat;
      document.getElementById('hotelLng').value = hotel.lng;
      document.getElementById('hotelNights').value = hotel.nights || 1;
      document.getElementById('hotelZoneSelect').value = hotel.zoneId || '';
      document.getElementById('hotelDesc').value = hotel.desc || '';
      document.getElementById('hotelUrl').value = hotel.url || '';
      document.getElementById('hotelRadiusKm').value = hotel.radiusKm || 50;
    }
  } else {
    document.getElementById('hotelModalTitle').innerText = 'Ajouter un Hébergement';
    document.getElementById('hotelId').value = '';
    if (appState.zones.length > 0 && zoneSelect) {
      zoneSelect.value = appState.zones[0].id;
    }
  }

  openModal('hotelModal');
}

function editHotel(hotelId) {
  openHotelModal(hotelId);
}

function saveHotel(event) {
  event.preventDefault();
  const id = document.getElementById('hotelId').value;
  const name = document.getElementById('hotelName').value.trim();
  const lat = parseFloat(document.getElementById('hotelLat').value);
  const lng = parseFloat(document.getElementById('hotelLng').value);
  const nights = parseInt(document.getElementById('hotelNights').value) || 1;
  const zoneId = document.getElementById('hotelZoneSelect').value;
  const desc = document.getElementById('hotelDesc').value.trim();
  const url = document.getElementById('hotelUrl').value.trim();
  const radiusKm = parseFloat(document.getElementById('hotelRadiusKm').value) || 50;

  if (!zoneId) {
    alert('Veuillez sélectionner une zone pour cet hébergement.');
    return;
  }

  if (id) {
    const hotel = appState.hotels.find(h => h.id === id);
    if (hotel) {
      hotel.name = name;
      hotel.lat = lat;
      hotel.lng = lng;
      hotel.nights = nights;
      hotel.zoneId = zoneId;
      hotel.desc = desc;
      hotel.url = url;
      hotel.radiusKm = radiusKm;
    }
  } else {
    const newHotel = {
      id: 'hotel_' + Date.now(),
      name,
      lat,
      lng,
      nights,
      zoneId,
      desc,
      url,
      radiusKm
    };
    appState.hotels.push(newHotel);
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  closeModal('hotelModal');
  renderApp();
  saveToLocalStorage();
}

function deleteHotel(hotelId) {
  if (confirm('Voulez-vous vraiment supprimer cet hébergement ?')) {
    appState.hotels = appState.hotels.filter(h => h.id !== hotelId);

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

function adjustHotelNights(delta) {
  const input = document.getElementById('hotelNights');
  if (input) {
    let val = parseInt(input.value) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
  }
}

function openZoneModal(zoneId = null) {
  const form = document.getElementById('zoneForm');
  if (form) form.reset();

  if (zoneId) {
    const zone = appState.zones.find(z => z.id === zoneId);
    if (zone) {
      document.getElementById('zoneModalTitle').innerText = 'Éditer la Zone';
      document.getElementById('zoneId').value = zone.id;
      document.getElementById('zoneName').value = zone.name;
      document.getElementById('zoneDesc').value = zone.desc || '';
      document.getElementById('zoneColor').value = zone.color || '#6366f1';
    }
  } else {
    document.getElementById('zoneModalTitle').innerText = 'Ajouter une Zone';
    document.getElementById('zoneId').value = '';
    document.getElementById('zoneColor').value = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  }

  openModal('zoneModal');
}

function editZone(zoneId) {
  openZoneModal(zoneId);
}

function saveZone(event) {
  event.preventDefault();
  const id = document.getElementById('zoneId').value;
  const name = document.getElementById('zoneName').value.trim();
  const desc = document.getElementById('zoneDesc').value.trim();
  const color = document.getElementById('zoneColor').value;

  if (id) {
    const zone = appState.zones.find(z => z.id === id);
    if (zone) {
      zone.name = name;
      zone.desc = desc;
      zone.color = color;
    }
  } else {
    const newZone = {
      id: 'zone_' + Date.now(),
      name,
      desc,
      color
    };
    appState.zones.push(newZone);
  }

  // Before recalculating transits, save previous transit_last_arr zone target
  const prevLastTransit = getTransits().find(t => t.id === 'transit_last_arr');
  const prevLastZoneId = prevLastTransit ? (prevLastTransit.fromZone?.id || prevLastTransit.toZone?.id) : null;

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  cleanOrphanTransitsAndTargets();

  // If transit_last_arr now points to a different zone, clear targets of spots/bons plans that pointed to it
  const newLastTransit = getTransits().find(t => t.id === 'transit_last_arr');
  const newLastZoneId = newLastTransit ? (newLastTransit.fromZone?.id || newLastTransit.toZone?.id) : null;
  if (prevLastZoneId !== newLastZoneId) {
    appState.spots.forEach(s => { if (s.target === 'transit_last_arr') s.target = ''; });
    appState.bonsPlans.forEach(bp => { if (bp.target === 'transit_last_arr') bp.target = ''; });
  }

  closeModal('zoneModal');
  renderApp();
  saveToLocalStorage();
}

function deleteZone(zoneId) {
  if (confirm('Voulez-vous supprimer cette zone ainsi que ses hébergements rattachés ?')) {
    appState.zones = appState.zones.filter(z => z.id !== zoneId);
    appState.hotels = appState.hotels.filter(h => h.zoneId !== zoneId);
    cleanOrphanTransitsAndTargets();

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

// ==========================================
// 4. GESTION ET ÉDITION DES BONS PLANS
// ==========================================

function openBonPlanModal(bpId = null) {
  const form = document.getElementById('bonPlanForm');
  if (form) form.reset();

  document.getElementById('bpTargetType').value = '';
  document.getElementById('bpTargetValue').value = '';
  document.getElementById('bpTargetSearch').value = '';

  if (bpId) {
    const bp = appState.bonsPlans.find(b => b.id === bpId);
    if (bp) {
      document.getElementById('bonPlanModalTitle').innerText = 'Éditer le Bon Plan';
      document.getElementById('bonPlanId').value = bp.id;
      document.getElementById('bonPlanTitle').value = bp.title;
      document.getElementById('bonPlanLat').value = bp.lat;
      document.getElementById('bonPlanLng').value = bp.lng;
      document.getElementById('bonPlanCategory').value = bp.category || 'Conseil pratique';
      document.getElementById('bonPlanDesc').value = bp.desc || '';
      document.getElementById('bonPlanUrl').value = bp.url || '';

      if (bp.target) {
        document.getElementById('bpTargetType').value = 'transit';
        document.getElementById('bpTargetValue').value = bp.target;
        const tObj = getTransits().find(t => t.id === bp.target);
        if (tObj) document.getElementById('bpTargetSearch').value = `Transit: ${tObj.name}`;
      } else {
        let assignedDay = null;
        Object.keys(appState.dailyBonsPlans).forEach(d => {
          if (appState.dailyBonsPlans[d] && appState.dailyBonsPlans[d].includes(bp.id)) {
            assignedDay = d;
          }
        });
        if (assignedDay !== null) {
          document.getElementById('bpTargetType').value = 'day';
          document.getElementById('bpTargetValue').value = assignedDay;
          document.getElementById('bpTargetSearch').value = `Jour J+${assignedDay} (${deltaToDateStr(assignedDay)})`;
        }
      }
    }
  } else {
    document.getElementById('bonPlanModalTitle').innerText = 'Ajouter un Bon Plan';
    document.getElementById('bonPlanId').value = '';
  }

  openModal('bonPlanModal');
}

function editBonPlan(bpId) {
  openBonPlanModal(bpId);
}

function saveBonPlan(event) {
  event.preventDefault();
  const id = document.getElementById('bonPlanId').value;
  const title = document.getElementById('bonPlanTitle').value.trim();
  const lat = parseFloat(document.getElementById('bonPlanLat').value);
  const lng = parseFloat(document.getElementById('bonPlanLng').value);
  const category = document.getElementById('bonPlanCategory').value;
  const desc = document.getElementById('bonPlanDesc').value.trim();
  const url = document.getElementById('bonPlanUrl').value.trim();
  const targetType = document.getElementById('bpTargetType').value;
  const targetVal = document.getElementById('bpTargetValue').value;

  let bpObj;
  if (id) {
    bpObj = appState.bonsPlans.find(b => b.id === id);
    if (bpObj) {
      bpObj.title = title;
      bpObj.lat = lat;
      bpObj.lng = lng;
      bpObj.category = category;
      bpObj.desc = desc;
      bpObj.url = url;
    }
  } else {
    bpObj = {
      id: 'bp_' + Date.now(),
      title,
      lat,
      lng,
      category,
      desc,
      url
    };
    appState.bonsPlans.push(bpObj);
  }

  bpObj.target = null;
  Object.keys(appState.dailyBonsPlans).forEach(d => {
    if (appState.dailyBonsPlans[d]) {
      appState.dailyBonsPlans[d] = appState.dailyBonsPlans[d].filter(bId => bId !== bpObj.id);
    }
  });

  if (targetType === 'transit') {
    bpObj.target = targetVal;
  } else if (targetType === 'day') {
    const dayNum = parseInt(targetVal);
    if (!appState.dailyBonsPlans[dayNum]) appState.dailyBonsPlans[dayNum] = [];
    if (!appState.dailyBonsPlans[dayNum].includes(bpObj.id)) {
      appState.dailyBonsPlans[dayNum].push(bpObj.id);
    }
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  closeModal('bonPlanModal');
  renderApp();
  saveToLocalStorage();
}

function deleteBonPlan(bpId) {
  if (confirm('Voulez-vous vraiment supprimer ce bon plan ?')) {
    appState.bonsPlans = appState.bonsPlans.filter(b => b.id !== bpId);
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d]) {
        appState.dailyBonsPlans[d] = appState.dailyBonsPlans[d].filter(id => id !== bpId);
      }
    });

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

function universalAssignBonPlan(bpId, targetValue) {
  const bp = appState.bonsPlans.find(b => b.id === bpId);
  if (!bp) return;

  bp.target = null;
  Object.keys(appState.dailyBonsPlans).forEach(d => {
    if (appState.dailyBonsPlans[d]) {
      appState.dailyBonsPlans[d] = appState.dailyBonsPlans[d].filter(id => id !== bpId);
    }
  });

  if (targetValue.startsWith('transit:')) {
    bp.target = targetValue.replace('transit:', '');
  } else if (targetValue.startsWith('day:')) {
    const day = parseInt(targetValue.replace('day:', ''));
    if (!appState.dailyBonsPlans[day]) appState.dailyBonsPlans[day] = [];
    if (!appState.dailyBonsPlans[day].includes(bpId)) {
      appState.dailyBonsPlans[day].push(bpId);
    }
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  renderApp();
  saveToLocalStorage();
}

function unassignBonPlan(bpId) {
  const bp = appState.bonsPlans.find(b => b.id === bpId);
  if (bp) {
    bp.target = null;
    Object.keys(appState.dailyBonsPlans).forEach(d => {
      if (appState.dailyBonsPlans[d]) {
        appState.dailyBonsPlans[d] = appState.dailyBonsPlans[d].filter(id => id !== bpId);
      }
    });

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    renderApp();
    saveToLocalStorage();
  }
}

// ==========================================
// 5. GESTION ET ÉDITION DES TRANSITS & ENDPOINTS
// ==========================================

function openEndpointModal(type) {
  document.getElementById('endpointType').value = type;
  const point = type === 'departure' ? appState.departurePoint : appState.arrivalPoint;

  document.getElementById('endpointModalTitle').innerText = type === 'departure' ? 'Éditer le Point de Départ' : 'Éditer le Point d\'Arrivée';
  document.getElementById('endpointName').value = point.name || '';
  document.getElementById('endpointLat').value = point.lat;
  document.getElementById('endpointLng').value = point.lng;
  document.getElementById('endpointSearchQuery').value = '';
  document.getElementById('endpointSearchResults').classList.add('hidden');

  openModal('endpointModal');
}

function saveEndpoint(event) {
  event.preventDefault();
  const type = document.getElementById('endpointType').value;
  const name = document.getElementById('endpointName').value.trim();
  const lat = parseFloat(document.getElementById('endpointLat').value);
  const lng = parseFloat(document.getElementById('endpointLng').value);

  if (type === 'departure') {
    appState.departurePoint = { name, lat, lng };
  } else {
    appState.arrivalPoint = { name, lat, lng };
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  closeModal('endpointModal');
  renderApp();
  saveToLocalStorage();
}

function editTransitModal(transitId) {
  const transits = getTransits();
  const t = transits.find(x => x.id === transitId);
  if (!t) return;

  document.getElementById('transitId').value = t.id;
  document.getElementById('transitName').value = t.name;
  document.getElementById('transitMode').value = t.mode || 'Voiture';
  document.getElementById('transitDesc').value = t.desc || '';

  const isNightBox = document.getElementById('transitIsNightTransit');
  if (isNightBox) {
    isNightBox.checked = !!t.isNightTransit;
    toggleNightTransitFields();
  }

  const nightCountInput = document.getElementById('transitNightCount');
  if (nightCountInput) {
    nightCountInput.value = t.nightCount || 1;
  }

  // Remplissage des champs fromPoint et toPoint si présents dans la modale
  const fromNameInput = document.getElementById('transitFromName');
  const fromLatInput = document.getElementById('transitFromLat');
  const fromLngInput = document.getElementById('transitFromLng');
  if (fromNameInput) fromNameInput.value = (t.fromPoint && t.fromPoint.name) ? t.fromPoint.name : '';
  if (fromLatInput) fromLatInput.value = (t.fromPoint && t.fromPoint.lat !== undefined) ? t.fromPoint.lat : '';
  if (fromLngInput) fromLngInput.value = (t.fromPoint && t.fromPoint.lng !== undefined) ? t.fromPoint.lng : '';

  const toNameInput = document.getElementById('transitToName');
  const toLatInput = document.getElementById('transitToLat');
  const toLngInput = document.getElementById('transitToLng');
  if (toNameInput) toNameInput.value = (t.toPoint && t.toPoint.name) ? t.toPoint.name : '';
  if (toLatInput) toLatInput.value = (t.toPoint && t.toPoint.lat !== undefined) ? t.toPoint.lat : '';
  if (toLngInput) toLngInput.value = (t.toPoint && t.toPoint.lng !== undefined) ? t.toPoint.lng : '';

  openModal('transitModal');
}

function toggleNightTransitFields() {
  const isNightBox = document.getElementById('transitIsNightTransit');
  const container = document.getElementById('transitNightCountContainer');
  if (isNightBox && container) {
    if (isNightBox.checked) {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
    }
  }
}

function saveTransit(event) {
  event.preventDefault();
  const id = document.getElementById('transitId').value;
  const name = document.getElementById('transitName').value.trim();
  const mode = document.getElementById('transitMode').value;
  const desc = document.getElementById('transitDesc').value.trim();
  const isNightTransit = document.getElementById('transitIsNightTransit').checked;
  const nightCount = parseInt(document.getElementById('transitNightCount').value) || 1;

  const fromName = document.getElementById('transitFromName')?.value.trim() || '';
  const fromLat = parseFloat(document.getElementById('transitFromLat')?.value);
  const fromLng = parseFloat(document.getElementById('transitFromLng')?.value);

  const toName = document.getElementById('transitToName')?.value.trim() || '';
  const toLat = parseFloat(document.getElementById('transitToLat')?.value);
  const toLng = parseFloat(document.getElementById('transitToLng')?.value);

  let fromPoint = null;
  if (fromName || !isNaN(fromLat) || !isNaN(fromLng)) {
    fromPoint = { name: fromName, lat: isNaN(fromLat) ? 0 : fromLat, lng: isNaN(fromLng) ? 0 : fromLng };
  }

  let toPoint = null;
  if (toName || !isNaN(toLat) || !isNaN(toLng)) {
    toPoint = { name: toName, lat: isNaN(toLat) ? 0 : toLat, lng: isNaN(toLng) ? 0 : toLng };
  }

  if (!Array.isArray(appState.customTransits)) {
    appState.customTransits = Object.values(appState.customTransits || {});
  }

  let existingIndex = appState.customTransits.findIndex(ct => ct.id === id);
  const transitData = { id, name, mode, desc, isNightTransit, nightCount, fromPoint, toPoint };

  if (existingIndex >= 0) {
    appState.customTransits[existingIndex] = { ...appState.customTransits[existingIndex], ...transitData };
  } else {
    appState.customTransits.push(transitData);
  }

  if (typeof invalidateRouteCache === 'function') {
    invalidateRouteCache();
  }

  saveToLocalStorage();
  closeModal('transitModal');
  renderApp();
}

// ==========================================
// 6. GESTION DU CLUSTERING & AIDE
// ==========================================

function openClusteringModal() {
  openModal('clusteringModal');
}

function runClusteringAlgorithm() {
  const radiusKm = parseFloat(document.getElementById('clusterRadiusInput').value) || 25;
  const minSpots = parseInt(document.getElementById('clusterMinSpotsInput').value) || 2;

  const unassignedSpots = appState.spots.filter(s => {
    let assigned = false;
    Object.keys(appState.dailyItineraries).forEach(d => {
      if (appState.dailyItineraries[d] && appState.dailyItineraries[d].includes(s.id)) assigned = true;
    });
    return !s.target && !assigned;
  });

  if (unassignedSpots.length === 0) {
    alert('Tous les spots sont déjà rattachés à un transit ou à une journée.');
    closeModal('clusteringModal');
    return;
  }

  const clusters = [];
  const visited = new Set();

  unassignedSpots.forEach(spot => {
    if (visited.has(spot.id)) return;
    const cluster = [spot];
    visited.add(spot.id);

    unassignedSpots.forEach(other => {
      if (spot.id === other.id || visited.has(other.id)) return;
      const dist = haversineDistanceKm(spot.lat, spot.lng, other.lat, other.lng);
      if (dist <= radiusKm) {
        cluster.push(other);
        visited.add(other.id);
      }
    });

    if (cluster.length >= minSpots) {
      clusters.push(cluster);
    }
  });

  if (clusters.length === 0) {
    alert(`Aucun cluster de spots à proximité (${radiusKm} km) trouvé.`);
  } else {
    clusters.forEach((cluster, idx) => {
      const color = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
      const newZone = {
        id: 'zone_cluster_' + Date.now() + '_' + idx,
        name: `Cluster ${idx + 1} (${cluster.length} spots)`,
        desc: `Zone générée automatiquement par le clustering (${radiusKm} km)`,
        color
      };
      appState.zones.push(newZone);

      let sumLat = 0, sumLng = 0;
      cluster.forEach(s => { sumLat += s.lat; sumLng += s.lng; });
      const avgLat = sumLat / cluster.length;
      const avgLng = sumLng / cluster.length;

      appState.hotels.push({
        id: 'hotel_cluster_' + Date.now() + '_' + idx,
        name: `Hôtel suggéré Cluster ${idx + 1}`,
        lat: avgLat,
        lng: avgLng,
        nights: 1,
        zoneId: newZone.id,
        desc: 'Point central généré pour le cluster',
        radiusKm
      });
    });

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    alert(`${clusters.length} zone(s) et hébergement(s) créés avec succès !`);
  }

  closeModal('clusteringModal');
  renderApp();
  saveToLocalStorage();
}

async function openHelpModal() {
  openModal('helpModal');
  const container = document.getElementById('helpModalContent');
  if (!container) return;

  container.innerHTML = '<div class="p-8 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Chargement du guide...</div>';

  try {
    const res = await fetch('help.html');
    if (res.ok) {
      const mdText = await res.text();
      container.innerHTML = `<div class="p-6 text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-4 font-sans">${formatMarkdownToHtml(mdText)}</div>`;
    } else {
      container.innerHTML = '<div class="p-6 text-center text-red-500">Impossible de charger le fichier help.html</div>';
    }
  } catch (err) {
    container.innerHTML = '<div class="p-6 text-center text-red-500">Erreur lors de la lecture du guide utilisateur.</div>';
  }
}

function formatMarkdownToHtml(md) {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 dark:text-white mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-6 mb-3 border-b border-slate-200 dark:border-slate-800 pb-1">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-xl font-extrabold text-slate-900 dark:text-white mt-4 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '<br><br>');
}

// ==========================================
// 7. AUTO-COMPLÉTION & RECHERCHE NOMINATIM
// ==========================================

function filterSpotParentOptions() {
  const query = document.getElementById('spotParentSearch').value.toLowerCase();
  const dropdown = document.getElementById('spotParentDropdown');
  const currentSpotId = document.getElementById('spotId').value;
  const currentLat = parseFloat(document.getElementById('spotLat').value) || appState.departurePoint.lat;
  const currentLng = parseFloat(document.getElementById('spotLng').value) || appState.departurePoint.lng;

  let candidates = appState.spots.filter(s => s.id !== currentSpotId && !s.parentId);
  candidates.sort((a, b) => {
    const dA = haversineDistanceKm(currentLat, currentLng, a.lat, a.lng);
    const dB = haversineDistanceKm(currentLat, currentLng, b.lat, b.lng);
    return dA - dB;
  });

  if (query) {
    candidates = candidates.filter(s => s.name.toLowerCase().includes(query));
  }

  dropdown.innerHTML = '';
  if (candidates.length === 0) {
    dropdown.innerHTML = '<div class="p-2 text-slate-500 italic">Aucun spot parent disponible</div>';
  } else {
    dropdown.innerHTML += `<div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer font-medium text-slate-500" onclick="selectSpotParent('', 'Aucun (Macro-spot)')">Aucun (Macro-spot)</div>`;
    candidates.forEach(s => {
      const dist = haversineDistanceKm(currentLat, currentLng, s.lat, s.lng);
      dropdown.innerHTML += `
        <div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center" onclick="selectSpotParent('${s.id}', '${s.name.replace(/'/g, "\'")}')">
          <span class="font-semibold text-slate-800 dark:text-slate-200">${s.name}</span>
          <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">${dist.toFixed(1)} km</span>
        </div>
      `;
    });
  }
  dropdown.classList.remove('hidden');
}

function selectSpotParent(id, name) {
  document.getElementById('spotParentId').value = id;
  document.getElementById('spotParentSearch').value = id ? name : '';
  document.getElementById('spotParentDropdown').classList.add('hidden');
}

function filterSpotTargetOptions() {
  const query = document.getElementById('spotTargetSearch').value.toLowerCase();
  const dropdown = document.getElementById('spotTargetDropdown');
  const validTransits = getTransits();
  const totalDays = getTotalDays();
  const computed = getZoneComputedDates();

  let options = [];
  options.push({ type: '', val: '', label: 'Libre / Non rattaché', sub: '' });

  validTransits.forEach(t => {
    options.push({ type: 'transit', val: t.id, label: `Transit: ${t.name}`, sub: `Mode : ${t.mode || 'Voiture'}` });
  });

  for (let d = 0; d < totalDays; d++) {
    const dateStr = deltaToDateStr(d);
    const z = appState.zones.find(zone => {
      const comp = computed[zone.id];
      return comp && d >= comp.checkinDay && d <= comp.checkoutDay;
    });
    const subText = z ? `Secteur : ${z.name}` : 'Sans secteur';
    options.push({ type: 'day', val: d.toString(), label: `Jour J+${d} (${dateStr})`, sub: subText });
  }

  if (query) {
    options = options.filter(o => o.label.toLowerCase().includes(query) || o.sub.toLowerCase().includes(query));
  }

  dropdown.innerHTML = '';
  options.forEach(o => {
    dropdown.innerHTML += `
      <div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center" onclick="selectSpotTarget('${o.type}', '${o.val}', '${o.label.replace(/'/g, "\'")}')">
        <span class="font-semibold text-slate-800 dark:text-slate-200">${o.label}</span>
        <span class="text-[10px] text-slate-500">${o.sub}</span>
      </div>
    `;
  });
  dropdown.classList.remove('hidden');
}

function selectSpotTarget(type, val, label) {
  document.getElementById('spotTargetType').value = type;
  document.getElementById('spotTargetValue').value = val;
  document.getElementById('spotTargetSearch').value = val !== '' ? label : '';
  document.getElementById('spotTargetDropdown').classList.add('hidden');
}

function filterBpTargetOptions() {
  const query = document.getElementById('bpTargetSearch').value.toLowerCase();
  const dropdown = document.getElementById('bpTargetDropdown');
  const validTransits = getTransits();
  const totalDays = getTotalDays();
  const computed = getZoneComputedDates();

  let options = [];
  options.push({ type: '', val: '', label: 'Libre / Non rattaché', sub: '' });

  validTransits.forEach(t => {
    options.push({ type: 'transit', val: t.id, label: `Transit: ${t.name}`, sub: `Mode : ${t.mode || 'Voiture'}` });
  });

  for (let d = 0; d < totalDays; d++) {
    const dateStr = deltaToDateStr(d);
    const z = appState.zones.find(zone => {
      const comp = computed[zone.id];
      return comp && d >= comp.checkinDay && d <= comp.checkoutDay;
    });
    const subText = z ? `Secteur : ${z.name}` : 'Sans secteur';
    options.push({ type: 'day', val: d.toString(), label: `Jour J+${d} (${dateStr})`, sub: subText });
  }

  if (query) {
    options = options.filter(o => o.label.toLowerCase().includes(query) || o.sub.toLowerCase().includes(query));
  }

  dropdown.innerHTML = '';
  options.forEach(o => {
    dropdown.innerHTML += `
      <div class="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer flex justify-between items-center" onclick="selectBpTarget('${o.type}', '${o.val}', '${o.label.replace(/'/g, "\'")}')">
        <span class="font-semibold text-slate-800 dark:text-slate-200">${o.label}</span>
        <span class="text-[10px] text-slate-500">${o.sub}</span>
      </div>
    `;
  });
  dropdown.classList.remove('hidden');
}

function selectBpTarget(type, val, label) {
  document.getElementById('bpTargetType').value = type;
  document.getElementById('bpTargetValue').value = val;
  document.getElementById('bpTargetSearch').value = val !== '' ? label : '';
  document.getElementById('bpTargetDropdown').classList.add('hidden');
}

async function searchSpotAddress() {
  console.log('[searchSpotAddress] Called with query');
  const q = document.getElementById('spotSearchQuery').value.trim();
  const resContainer = document.getElementById('spotSearchResults');
  if (!q) {
    console.warn('[searchSpotAddress] Empty query');
    return;
  }

  resContainer.innerHTML = '<div class="p-2 text-slate-500">Recherche...</div>';
  resContainer.classList.remove('hidden');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log('[searchSpotAddress] Received', data.length, 'results');
    resContainer.innerHTML = '';

    if (data.length === 0) {
      resContainer.innerHTML = '<div class="p-2 text-slate-500">Aucun résultat</div>';
    } else {
      data.slice(0, 5).forEach(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const displayName = item.display_name;
        const shortName = displayName.split(',')[0];

        const resultDiv = document.createElement('div');
        resultDiv.className = 'p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 text-xs';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-bold block';
        nameSpan.textContent = shortName;
        resultDiv.appendChild(nameSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'text-[10px] text-slate-500 block truncate';
        descSpan.textContent = displayName;
        resultDiv.appendChild(descSpan);

        resultDiv.addEventListener('click', () => {
          console.log('[searchSpotAddress] Result clicked:', { lat, lon, name: shortName });
          applySpotAddress(shortName, displayName, lat, lon);
        });

        resContainer.appendChild(resultDiv);
      });
    }
  } catch (err) {
    console.error('[searchSpotAddress] Error:', err);
    resContainer.innerHTML = '<div class="p-2 text-red-500">Erreur réseau</div>';
  }
}

function applySpotAddress(name, desc, lat, lng) {
  console.log('[applySpotAddress] Called with:', { name, lat, lng });
  const spotNameEl = document.getElementById('spotName');
  const spotLatEl = document.getElementById('spotLat');
  const spotLngEl = document.getElementById('spotLng');
  const resContainer = document.getElementById('spotSearchResults');

  if (spotNameEl) spotNameEl.value = name;
  else console.error('[applySpotAddress] spotName element not found');
  if (spotLatEl) spotLatEl.value = lat;
  else console.error('[applySpotAddress] spotLat element not found');
  if (spotLngEl) spotLngEl.value = lng;
  else console.error('[applySpotAddress] spotLng element not found');

  if (resContainer) resContainer.classList.add('hidden');
  else console.warn('[applySpotAddress] spotSearchResults not found');

  console.log('[applySpotAddress] Fields updated successfully');
}
async function searchHotelAddress() {
  console.log('[searchHotelAddress] Called with query');
  const q = document.getElementById('hotelSearchQuery').value.trim();
  const resContainer = document.getElementById('hotelSearchResults');
  if (!q) {
    console.warn('[searchHotelAddress] Empty query');
    return;
  }

  resContainer.innerHTML = '<div class="p-2 text-slate-500">Recherche...</div>';
  resContainer.classList.remove('hidden');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log('[searchHotelAddress] Received', data.length, 'results');
    resContainer.innerHTML = '';

    if (data.length === 0) {
      resContainer.innerHTML = '<div class="p-2 text-slate-500">Aucun résultat</div>';
    } else {
      data.slice(0, 5).forEach(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const displayName = item.display_name;
        const shortName = displayName.split(',')[0];

        const resultDiv = document.createElement('div');
        resultDiv.className = 'p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 text-xs';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-bold block';
        nameSpan.textContent = shortName;
        resultDiv.appendChild(nameSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'text-[10px] text-slate-500 block truncate';
        descSpan.textContent = displayName;
        resultDiv.appendChild(descSpan);

        resultDiv.addEventListener('click', () => {
          console.log('[searchHotelAddress] Result clicked:', { lat, lon, name: shortName });
          applyHotelAddress(shortName, displayName, lat, lon);
        });

        resContainer.appendChild(resultDiv);
      });
    }
  } catch (err) {
    console.error('[searchHotelAddress] Error:', err);
    resContainer.innerHTML = '<div class="p-2 text-red-500">Erreur réseau</div>';
  }
}

function applyHotelAddress(name, desc, lat, lng) {
  console.log('[applyHotelAddress] Called with:', { name, lat, lng });
  const hotelNameEl = document.getElementById('hotelName');
  const hotelLatEl = document.getElementById('hotelLat');
  const hotelLngEl = document.getElementById('hotelLng');
  const resContainer = document.getElementById('hotelSearchResults');

  if (hotelNameEl) hotelNameEl.value = name;
  else console.error('[applyHotelAddress] hotelName element not found');
  if (hotelLatEl) hotelLatEl.value = lat;
  else console.error('[applyHotelAddress] hotelLat element not found');
  if (hotelLngEl) hotelLngEl.value = lng;
  else console.error('[applyHotelAddress] hotelLng element not found');

  if (resContainer) resContainer.classList.add('hidden');
  else console.warn('[applyHotelAddress] hotelSearchResults not found');

  console.log('[applyHotelAddress] Fields updated successfully');
}
async function searchBpAddress() {
  console.log('[searchBpAddress] Called with query');
  const q = document.getElementById('bpSearchQuery').value.trim();
  const resContainer = document.getElementById('bpSearchResults');
  if (!q) {
    console.warn('[searchBpAddress] Empty query');
    return;
  }

  resContainer.innerHTML = '<div class="p-2 text-slate-500">Recherche...</div>';
  resContainer.classList.remove('hidden');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log('[searchBpAddress] Received', data.length, 'results');
    resContainer.innerHTML = '';

    if (data.length === 0) {
      resContainer.innerHTML = '<div class="p-2 text-slate-500">Aucun résultat</div>';
    } else {
      data.slice(0, 5).forEach(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const displayName = item.display_name;
        const shortName = displayName.split(',')[0];

        const resultDiv = document.createElement('div');
        resultDiv.className = 'p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 text-xs';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-bold block';
        nameSpan.textContent = shortName;
        resultDiv.appendChild(nameSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'text-[10px] text-slate-500 block truncate';
        descSpan.textContent = displayName;
        resultDiv.appendChild(descSpan);

        resultDiv.addEventListener('click', () => {
          console.log('[searchBpAddress] Result clicked:', { lat, lon, name: shortName });
          applyBpAddress(shortName, displayName, lat, lon);
        });

        resContainer.appendChild(resultDiv);
      });
    }
  } catch (err) {
    console.error('[searchBpAddress] Error:', err);
    resContainer.innerHTML = '<div class="p-2 text-red-500">Erreur réseau</div>';
  }
}

function applyBpAddress(name, desc, lat, lng) {
  console.log('[applyBpAddress] Called with:', { name, lat, lng });
  const bpTitleEl = document.getElementById('bonPlanTitle');
  const bpLatEl = document.getElementById('bonPlanLat');
  const bpLngEl = document.getElementById('bonPlanLng');
  const resContainer = document.getElementById('bpSearchResults');

  if (bpTitleEl) bpTitleEl.value = name;
  else console.error('[applyBpAddress] bonPlanTitle element not found');
  if (bpLatEl) bpLatEl.value = lat;
  else console.error('[applyBpAddress] bonPlanLat element not found');
  if (bpLngEl) bpLngEl.value = lng;
  else console.error('[applyBpAddress] bonPlanLng element not found');

  if (resContainer) resContainer.classList.add('hidden');
  else console.warn('[applyBpAddress] bpSearchResults not found');

  console.log('[applyBpAddress] Fields updated successfully');
}
async function searchEndpointAddress() {
  console.log('[searchEndpointAddress] Called with query');
  const q = document.getElementById('endpointSearchQuery').value.trim();
  const resContainer = document.getElementById('endpointSearchResults');
  if (!q) {
    console.warn('[searchEndpointAddress] Empty query');
    return;
  }

  resContainer.innerHTML = '<div class="p-2 text-slate-500">Recherche...</div>';
  resContainer.classList.remove('hidden');

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
    const data = await res.json();
    console.log('[searchEndpointAddress] Received', data.length, 'results');
    resContainer.innerHTML = '';

    if (data.length === 0) {
      resContainer.innerHTML = '<div class="p-2 text-slate-500">Aucun résultat</div>';
    } else {
      data.slice(0, 5).forEach(item => {
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const displayName = item.display_name;
        const shortName = displayName.split(',')[0];

        const resultDiv = document.createElement('div');
        resultDiv.className = 'p-2 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 text-xs';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'font-bold block';
        nameSpan.textContent = shortName;
        resultDiv.appendChild(nameSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'text-[10px] text-slate-500 block truncate';
        descSpan.textContent = displayName;
        resultDiv.appendChild(descSpan);

        resultDiv.addEventListener('click', () => {
          console.log('[searchEndpointAddress] Result clicked:', { lat, lon, name: shortName });
          applyEndpointAddress(displayName, lat, lon);
        });

        resContainer.appendChild(resultDiv);
      });
    }
  } catch (err) {
    console.error('[searchEndpointAddress] Error:', err);
    resContainer.innerHTML = '<div class="p-2 text-red-500">Erreur réseau</div>';
  }
}

function applyEndpointAddress(name, lat, lng) {
  console.log('[applyEndpointAddress] Called with:', { name, lat, lng });
  const endpointNameEl = document.getElementById('endpointName');
  const endpointLatEl = document.getElementById('endpointLat');
  const endpointLngEl = document.getElementById('endpointLng');
  const resContainer = document.getElementById('endpointSearchResults');

  if (endpointNameEl) endpointNameEl.value = name;
  else console.error('[applyEndpointAddress] endpointName element not found');
  if (endpointLatEl) endpointLatEl.value = lat;
  else console.error('[applyEndpointAddress] endpointLat element not found');
  if (endpointLngEl) endpointLngEl.value = lng;
  else console.error('[applyEndpointAddress] endpointLng element not found');

  if (resContainer) resContainer.classList.add('hidden');
  else console.warn('[applyEndpointAddress] endpointSearchResults not found');

  console.log('[applyEndpointAddress] Fields updated successfully');
}

// ==========================================
// 8. IMPORT / EXPORT ZIP ET IMAGES EXIF
// ==========================================

function handlePhotoUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  EXIF.getData(file, function() {
    const lat = EXIF.getTag(this, 'GPSLatitude');
    const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
    const lng = EXIF.getTag(this, 'GPSLongitude');
    const lngRef = EXIF.getTag(this, 'GPSLongitudeRef');

    if (lat && lng && latRef && lngRef) {
      const decLat = convertDMSToDD(lat[0], lat[1], lat[2], latRef);
      const decLng = convertDMSToDD(lng[0], lng[1], lng[2], lngRef);
      if (type === 'spot') {
        document.getElementById('spotLat').value = decLat.toFixed(6);
        document.getElementById('spotLng').value = decLng.toFixed(6);
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
      const max_size = 800;

      if (width > height) {
        if (width > max_size) { height *= max_size / width; width = max_size; }
      } else {
        if (height > max_size) { width *= max_size / height; height = max_size; }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);

      if (type === 'spot') {
        const imgThumb = document.getElementById('spotImgThumb');
        const preview = document.getElementById('spotPhotoPreview');
        if (imgThumb) imgThumb.src = resizedBase64;
        if (preview) preview.classList.remove('hidden');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function convertDMSToDD(degrees, minutes, seconds, direction) {
  let dd = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    dd = dd * -1;
  }
  return dd;
}

async function exportZIP() {
  if (typeof JSZip === 'undefined') {
    alert('Bibliothèque JSZip non disponible.');
    return;
  }

  const zip = new JSZip();
  const exportData = JSON.parse(JSON.stringify(appState));
  
  exportData.pivotDate = appState.pivotDate;

  delete exportData.routeCache;

  const imagesFolder = zip.folder('images');
  let imgCount = 0;

  exportData.spots.forEach(s => {
    if (s.imageBase64) {
      const filename = `spot_${s.id}.jpg`;
      const base64Data = s.imageBase64.replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
      imagesFolder.file(filename, base64Data, { base64: true });
      s.imagePath = `images/${filename}`;
      delete s.imageBase64;
      imgCount++;
    }
  });

  zip.file('voyage.json', JSON.stringify(exportData, null, 2));

  try {
    const content = await zip.generateAsync({ type: 'blob' });
    const cleanName = (appState.name || 'Voyage').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${cleanName}.pvi`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error('Erreur lors de l\'exportation ZIP :', err);
    alert('Échec de la création du fichier .pvi');
  }
}

async function importZIP(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (typeof JSZip === 'undefined') {
    alert('Bibliothèque JSZip non disponible.');
    return;
  }

  try {
    const zip = await JSZip.loadAsync(file);
    const dataFile = zip.file('voyage.json');
    if (!dataFile) {
      alert('Fichier voyage.json introuvable dans le paquet.');
      return;
    }

    const jsonText = await dataFile.async('string');
    const importedState = JSON.parse(jsonText);

    for (const spot of importedState.spots) {
      if (spot.imagePath) {
        const imgFile = zip.file(spot.imagePath);
        if (imgFile) {
          const base64 = await imgFile.async('base64');
          spot.imageBase64 = `data:image/jpeg;base64,${base64}`;
        }
      }
    }

    appState.name = importedState.name || 'Mon Voyage';
    appState.pivotDate = importedState.pivotDate || new Date().toISOString().split('T')[0];
    const pivotInput = document.getElementById('pivotDateInput');
    if (pivotInput) {
      pivotInput.value = appState.pivotDate;
    }

    appState.zones = importedState.zones || [];
    appState.hotels = importedState.hotels || [];
    appState.spots = importedState.spots || [];
    appState.bonsPlans = importedState.bonsPlans || [];
    appState.dailyItineraries = importedState.dailyItineraries || {};
    appState.dailyBonsPlans = importedState.dailyBonsPlans || {};
    appState.departurePoint = importedState.departurePoint || { name: 'Départ Initial', lat: 48.8566, lng: 2.3522 };
    appState.arrivalPoint = importedState.arrivalPoint || { name: 'Arrivée Finale', lat: 48.8566, lng: 2.3522 };
    appState.customTransits = importedState.customTransits || [];
    appState.transitSpotOrder = importedState.transitSpotOrder || {};
    appState.routeCache = {};
    appState.isCacheStale = true;
    shouldFitBoundsOnce = true;

    if (typeof invalidateRouteCache === 'function') {
      invalidateRouteCache();
    }

    saveToLocalStorage();
    renderApp();
    alert('Importation du voyage terminée avec succès !');
  } catch (err) {
    console.error('Erreur lors de l\'importation ZIP :', err);
    alert('Échec de la lecture du fichier .pvi');
  }
}
