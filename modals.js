
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function toggleNightTransitFields() {
  const isChecked = document.getElementById('transitIsNightTransit').checked;
  const container = document.getElementById('transitNightCountContainer');
  if (container) {
    if (isChecked) container.classList.remove('hidden');
    else container.classList.add('hidden');
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
  
  const isNight = !!t.isNightTransit;
  document.getElementById('transitIsNightTransit').checked = isNight;
  document.getElementById('transitNightCount').value = t.nightCount || 1;
  toggleNightTransitFields();

  openModal('transitModal');
}

function saveTransit(e) {
  e.preventDefault();
  const id = document.getElementById('transitId').value;
  const name = document.getElementById('transitName').value;
  const mode = document.getElementById('transitMode').value;
  const desc = document.getElementById('transitDesc').value;
  const isNightTransit = document.getElementById('transitIsNightTransit').checked;
  const nightCount = parseInt(document.getElementById('transitNightCount').value) || 1;

  if (!appState.customTransits) appState.customTransits = [];
  let custom = appState.customTransits.find(x => x.id === id);
  if (custom) {
    custom.name = name;
    custom.mode = mode;
    custom.desc = desc;
    custom.isNightTransit = isNightTransit;
    custom.nightCount = nightCount;
  } else {
    appState.customTransits.push({ id, name, mode, desc, isNightTransit, nightCount });
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

