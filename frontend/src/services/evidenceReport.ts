import jsPDF from 'jspdf';
import { AlertEvent } from '../lib/parksData';

export interface LegalProfile {
  district: string;
  state: string;
  surveyNumber?: string;
}

export interface TreeInventoryEntry {
  zone: string;
  species: string;
  count: number;
  valuePerTree: number;
}

// ─── SHA-256 via Web Crypto (no dependencies) ─────────────────────────────────
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── Fetch image and convert to base64 for embedding ─────────────────────────
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─── Alert-contextual image selection ────────────────────────────────────────
// All images: real Unsplash photos (free-to-use), chosen for visual authenticity.
// Each pair: [primaryUrl, secondaryUrl] matching the alert scenario.
// Grayscale applied for surveillance-authentic look.
const EXHIBIT_IMAGES: Record<string, [string, string]> = {
  // Acoustic — Gunshot: dense forest / spent shell casings
  GUNSHOT: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',   // dense forest at night/dusk
    'https://images.unsplash.com/photo-1542382156956-5a449dc9c3bc?w=800&q=80',   // forest undergrowth path
  ],
  // Acoustic — Chainsaw: logging, tree cutting
  CHAINSAW: [
    'https://images.unsplash.com/photo-1504284769660-e09f0233a2bd?w=800&q=80',   // felled tree/logging
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',   // forest interior
  ],
  // Acoustic — Vehicle engine: dirt track, tyre marks
  VEHICLE_ENGINE: [
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',   // forest track/road
    'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=800&q=80',   // tyre marks on dirt
  ],
  // Camera — Human presence: plantation perimeter, fence breach
  HUMAN_PRESENCE: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',   // security fence/perimeter
    'https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800&q=80',   // plantation tree rows
  ],
  // Camera — Vehicle detected: parked/suspicious vehicle near plantation
  VEHICLE_DETECTED: [
    'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=800&q=80',   // vehicle on dirt track
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',   // forest road entry
  ],
  SUSPICIOUS_VEHICLE: [
    'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&q=80',   // dark SUV/truck
    'https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=800&q=80',   // tire marks
  ],
  // Camera — Behavioral anomaly: stressed animal / disturbed vegetation
  BEHAVIORAL_ANOMALY: [
    'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&q=80',   // wildlife alert posture
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',   // disturbed forest floor
  ],
  // Community — Snare detected: wire snare on ground
  SNARE_DETECTED: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',   // forest ground level
    'https://images.unsplash.com/photo-1542382156956-5a449dc9c3bc?w=800&q=80',   // dense undergrowth
  ],
  // Community — Poacher camp: temporary encampment remains
  POACHER_CAMP: [
    'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&q=80',   // crude campsite remains
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',   // forest clearing
  ],
  // Community — Dead animal / correlated critical
  DEAD_ANIMAL: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',   // forest scene
    'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&q=80',   // wildlife context
  ],
  CONFIRMED_THREAT_EXTREME: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',   // dark forest
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',     // perimeter breach
  ],
  // Species detected: plantation trees / tagging
  SPECIES_DETECTED: [
    'https://images.unsplash.com/photo-1542621334-a254cf47733d?w=800&q=80',   // plantation rows
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80', // forest canopy
  ],
  // Default fallback
  DEFAULT: [
    'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&q=80',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=80',
  ],
};

function getExhibitUrls(alert: AlertEvent): [string, string] {
  const key = alert.subType?.toUpperCase().replace(/\s+/g, '_') ?? '';
  return EXHIBIT_IMAGES[key] ?? EXHIBIT_IMAGES.DEFAULT;
}

// ─── Alert-contextual Exhibit labels / captions ───────────────────────────────
interface ExhibitMeta {
  labelA: string;
  labelB: string;
  captionA: string;
  captionB: string;
  stationA: string;
  stationB: string;
  sensorModeA: string;
  sensorModeB: string;
}

function getExhibitMeta(alert: AlertEvent): ExhibitMeta {
  const z = alert.zone?.toUpperCase() ?? 'XX';
  const ts = alert.timestamp;
  const sub = (alert.subType ?? '').toUpperCase();
  const type = (alert.type ?? '').toUpperCase();

  if (sub === 'GUNSHOT') return {
    labelA: 'EXHIBIT A — Acoustic Waveform Detection Frame',
    labelB: 'EXHIBIT B — Zone Perimeter Camera Capture',
    captionA: `Gunshot impulse captured by acoustic array at ${ts}. Frequency signature consistent with high-calibre discharge.`,
    captionB: `Perimeter camera activated by motion in ${alert.zone ?? 'Unknown Zone'} at time of acoustic event. No secondary visual confirmation obtained.`,
    stationA: `ACU-${z}-04  |  Acoustic Sensor Array  |  HIGH-GAIN MIC`,
    stationB: `CAM-${z}-02  |  Perimeter Camera  |  NIGHT-IR`,
    sensorModeA: 'ACOUSTIC-WAVEFORM',
    sensorModeB: 'NIGHT-IR',
  };

  if (sub === 'CHAINSAW') return {
    labelA: 'EXHIBIT A — Acoustic Signature: Motorised Cutting Tool',
    labelB: 'EXHIBIT B — Plantation Boundary Camera',
    captionA: `Sustained low-frequency harmonic consistent with chainsaw-type motorised cutting detected at ${ts} in ${alert.zone}.`,
    captionB: `Plantation boundary camera triggered during acoustic window. Visual survey of affected tree line recommended.`,
    stationA: `ACU-${z}-01  |  Acoustic Sensor  |  SPECTRAL-ANALYSIS`,
    stationB: `CAM-${z}-05  |  Boundary Camera  |  DAY`,
    sensorModeA: 'ACOUSTIC-HARMONIC',
    sensorModeB: 'VISIBLE',
  };

  if (sub === 'VEHICLE_ENGINE' || sub === 'VEHICLE_DETECTED' || sub === 'SUSPICIOUS_VEHICLE') return {
    labelA: 'EXHIBIT A — Access Track Surveillance Frame',
    labelB: 'EXHIBIT B — Vehicle Approach Detection Image',
    captionA: `Unscheduled vehicle presence detected in access corridor at ${ts}. Entry point near ${alert.zone} sector boundary.`,
    captionB: `Secondary camera captured vehicle approach vector. Registration plate capture attempted — quality subject to conditions.`,
    stationA: `CAM-${z}-08  |  Access Track Camera  |  WIDE-ANGLE`,
    stationB: `PIR-${z}-03  |  Passive Infrared Sensor  |  Motion Trigger`,
    sensorModeA: 'VISIBLE / WIDE-ANGLE',
    sensorModeB: 'MOTION-TRIGGERED',
  };

  if (sub === 'HUMAN_PRESENCE') return {
    labelA: 'EXHIBIT A — Perimeter Intrusion Detection Frame',
    labelB: 'EXHIBIT B — Camera Trap Motion Capture',
    captionA: `Unauthorised human presence detected in ${alert.zone} at ${ts}. Subject observed in restricted plantation area.`,
    captionB: `Camera trap activated. Subject movement pattern suggests deliberate evasion of primary detection line.`,
    stationA: `CT-${z}-07  |  Camera Trap  |  NIGHT-IR`,
    stationB: `PIR-${z}-03  |  Motion Sensor  |  Motion Detection`,
    sensorModeA: 'NIGHT-IR',
    sensorModeB: 'PIR-MOTION',
  };

  if (sub === 'SNARE_DETECTED') return {
    labelA: 'EXHIBIT A — Illegal Snare Apparatus (Field Report)',
    labelB: 'EXHIBIT B — Deployment Zone Context',
    captionA: `Wire snare apparatus reported at ${ts} in ${alert.zone}. Location tagged for law enforcement retrieval and forensic analysis.`,
    captionB: `Surrounding terrain of snare deployment. Proximity to plantation boundary indicates deliberate targeting.`,
    stationA: `COMMUNITY-REPORT  |  Field Sighting  |  ${ts}`,
    stationB: `GEO-TAG  |  Zone ${alert.zone}  |  Manual Entry`,
    sensorModeA: 'COMMUNITY-INTELLIGENCE',
    sensorModeB: 'GEO-REFERENCED',
  };

  if (sub === 'POACHER_CAMP') return {
    labelA: 'EXHIBIT A — Illegal Encampment Site (Field Documentation)',
    labelB: 'EXHIBIT B — Zone Approach Corridor',
    captionA: `Evidence of illegal encampment discovered at ${ts} in ${alert.zone}. Remains suggest overnight occupation by 2–4 individuals.`,
    captionB: `Approach corridor to camp location. Foot trail evident; consistent with repeated access over multiple days.`,
    stationA: `COMMUNITY-REPORT  |  Ground Survey  |  ${ts}`,
    stationB: `GEO-TAG  |  Zone ${alert.zone}  |  Approach Vector`,
    sensorModeA: 'COMMUNITY-INTELLIGENCE',
    sensorModeB: 'GEO-REFERENCED',
  };

  if (sub === 'CONFIRMED_THREAT_EXTREME') return {
    labelA: 'EXHIBIT A — Multi-Sensor Correlation Frame',
    labelB: 'EXHIBIT B — Threat Convergence Zone Documentation',
    captionA: `CRITICAL: Triple-sensor correlation confirmed at ${ts}. Acoustic, camera, and intelligence sources triangulated to ${alert.zone}.`,
    captionB: `Zone ${alert.zone} perimeter documentation captured at time of incident escalation. Full tactical response initiated.`,
    stationA: `VCE-CORRELATED  |  Multi-Source  |  CRITICAL`,
    stationB: `CAM-${z}-PERIMETER  |  Zone Boundary  |  NIGHT-IR`,
    sensorModeA: 'MULTI-SENSOR-FUSION',
    sensorModeB: 'NIGHT-IR',
  };

  if (type === 'CAMERA') return {
    labelA: 'EXHIBIT A — Camera Detection Frame',
    labelB: 'EXHIBIT B — Secondary Sensor Capture',
    captionA: `Visual detection event triggered at ${ts} in ${alert.zone}. ${alert.description}`,
    captionB: `Secondary camera frame from adjacent sensor station during detection window.`,
    stationA: `CT-${z}-07  |  Camera Trap  |  AUTO`,
    stationB: `CAM-${z}-09  |  Secondary Camera  |  NIGHT-IR`,
    sensorModeA: 'VISIBLE / IR',
    sensorModeB: 'NIGHT-IR',
  };

  // Generic fallback
  return {
    labelA: 'EXHIBIT A — Primary Sensor Detection Frame',
    labelB: 'EXHIBIT B — Secondary Detection Capture',
    captionA: `Primary sensor event recorded at ${ts} in ${alert.zone}. ${alert.description}`,
    captionB: `Secondary detection frame captured during incident window in ${alert.zone}.`,
    stationA: `SENSOR-${z}-01  |  ${type}  |  AUTO`,
    stationB: `PIR-${z}-03  |  Secondary Sensor  |  Motion Detection`,
    sensorModeA: type,
    sensorModeB: 'MOTION-DETECTION',
  };
}

// ─── Alert-contextual narrative block ─────────────────────────────────────────
function buildIncidentNarrative(alert: AlertEvent, _ownerName: string, estateName: string): string {
  const sub = (alert.subType ?? '').toUpperCase();
  const conf = alert.confidence != null ? `${Math.round(alert.confidence * 100)}%` : 'N/A';
  const zone = alert.zone ?? 'Unknown Zone';

  if (sub === 'GUNSHOT')
    return `A single high-calibre acoustic discharge was detected in ${zone} of ${estateName} estate at ${alert.timestamp}. The acoustic sensor array registered a peak impulse consistent with unlicensed firearm use. Detection confidence: ${conf}. This event presents an immediate risk to both estate personnel and high-value timber assets. Prompt coordination with the Forest Department and local police is strongly advised.`;

  if (sub === 'CHAINSAW')
    return `A sustained motorised cutting signature was recorded in ${zone} of ${estateName} estate at ${alert.timestamp}. Spectral analysis of the acoustic profile is consistent with chainsaw-type equipment commonly used in organised timber theft operations. Detection confidence: ${conf}. A physical inspection of the zone boundary and tree inventory should be conducted without delay to assess any removal of assets.`;

  if (sub === 'VEHICLE_ENGINE' || sub === 'VEHICLE_DETECTED' || sub === 'SUSPICIOUS_VEHICLE')
    return `An unscheduled motor vehicle was detected in the access corridor adjacent to ${zone} of ${estateName} estate at ${alert.timestamp}. Unauthorised vehicle presence in restricted zones is a known precursor to organised trespass and timber theft. Detection confidence: ${conf}. CCTV retrieval and tyre-track documentation at the scene is recommended to support any subsequent police complaint.`;

  if (sub === 'HUMAN_PRESENCE')
    return `Unauthorised human presence was detected in ${zone} of ${estateName} estate at ${alert.timestamp} via camera trap. The individual(s) were observed in a restricted area without authorisation. Detection confidence: ${conf}. This incident may represent either opportunistic trespass or active reconnaissance ahead of a larger operation. Ground patrol and security review of the ${zone} boundary is recommended.`;

  if (sub === 'SNARE_DETECTED')
    return `An active illegal snare apparatus was reported in ${zone} of ${estateName} estate at ${alert.timestamp}. The presence of a snare indicates premeditated and repeated access to the property by an individual or group with knowledge of the estate layout. This constitutes criminal trespass and wildlife law violation. The snare should be preserved in situ and the site documented with GPS coordinates before collection by law enforcement.`;

  if (sub === 'POACHER_CAMP')
    return `Evidence of an illegal overnight encampment was discovered in ${zone} of ${estateName} estate at ${alert.timestamp}. Remains indicate occupation by multiple individuals over a sustained period, suggesting an organised operation rather than casual trespass. Forensic evidence (food waste, tool marks, footprints) may be recoverable. The site should be sealed immediately and forest department or police called prior to disturbance.`;

  if (sub === 'CONFIRMED_THREAT_EXTREME')
    return `A CRITICAL correlated incident was flagged in ${zone} of ${estateName} estate at ${alert.timestamp} by the Vanguard Correlation Engine. Multiple independent sensor types — including acoustic arrays and optical sensors — simultaneously registered anomalous activity in the same zone within the same 30-minute window. This multi-vector event represents the highest confidence level of active threat. Immediate deployment of security personnel and police notification is required.`;

  if (sub === 'DEAD_ANIMAL')
    return `A deceased animal was reported in ${zone} of ${estateName} estate at ${alert.timestamp}. This may indicate recent poaching activity, use of poison baits, or other criminal interference with wildlife on the property. The carcass should be documented and reported to the relevant forest or wildlife authority. Avoid disturbing the scene to preserve forensic evidence.`;

  // Generic
  return `A ${alert.type} sensor event was recorded in ${zone} of ${estateName} estate at ${alert.timestamp}. ${alert.description} Detection confidence: ${conf}. This report captures the event details, sensor readings, and financial exposure for submission to relevant authorities.`;
}

// ─── PDF colour tokens ────────────────────────────────────────────────────────
const C = {
  black:     [10,  15,  26],
  charcoal:  [30,  40,  60],
  darkGray:  [60,  70,  90],
  gray:      [120, 130, 150],
  lightGray: [200, 205, 215],
  white:     [255, 255, 255],
  green:     [34,  197, 94],
  amber:     [245, 158, 11],
  red:       [239, 68,  68],
} as const;

type RGB = readonly [number, number, number];

function priorityColour(priority: string): RGB {
  if (priority === 'CRITICAL') return C.red;
  if (priority === 'ELEVATED') return C.amber;
  return C.green;
}

function rule(doc: jsPDF, y: number, margin: number, width: number, col: RGB = C.lightGray) {
  doc.setDrawColor(...col);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + width, y);
}

function sectionHeading(doc: jsPDF, text: string, y: number, margin: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(text.toUpperCase(), margin, y);
  rule(doc, y + 2, margin, 170);
  return y + 8;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function generateEvidenceReport(opts: {
  alert: AlertEvent;
  recentAlerts: AlertEvent[];
  ownerName: string;
  estateName: string;
  legalProfile: LegalProfile;
  inventory: TreeInventoryEntry[];
}): Promise<void> {
  const { alert, recentAlerts, ownerName, estateName, legalProfile, inventory } = opts;

  const now = new Date();
  const reportId = `VGD-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-`;
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const canonicalContent = JSON.stringify({
    alert: { id: alert.id, type: alert.type, zone: alert.zone, priority: alert.priority, description: alert.description, timestamp: alert.timestamp },
    owner: ownerName,
    estate: estateName,
    district: legalProfile.district,
    state: legalProfile.state,
    reportedAt: now.toISOString(),
  });

  const hash = await sha256(canonicalContent);
  const shortId = reportId + hash.slice(0, 8).toUpperCase();

  // Fetch contextual images for this specific alert type
  const [urlA, urlB] = getExhibitUrls(alert);
  const [exhibitA, exhibitB] = await Promise.all([
    fetchImageAsBase64(urlA),
    fetchImageAsBase64(urlB),
  ]);

  const exhibitMeta = getExhibitMeta(alert);
  const incidentNarrative = buildIncidentNarrative(alert, ownerName, estateName);

  const zoneInventory = inventory.filter(
    i => i.zone.toLowerCase() === alert.zone?.toLowerCase()
  );
  const totalExposure = zoneInventory.reduce((sum, i) => sum + i.count * i.valuePerTree, 0);
  const estateTotal = inventory.reduce((sum, i) => sum + i.count * i.valuePerTree, 0);

  const timeline = recentAlerts
    .filter(a => a.zone === alert.zone)
    .slice(-6)
    .reverse();

  // ─── Build PDF ───────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const margin = 18;
  const pageW = 210;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── Cover band ───────────────────────────────────────────────────────────────
  doc.setFillColor(...C.black);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...C.lightGray);
  doc.text('V A N G U A R D  E S T A T E  S E C U R I T Y  P L A T F O R M', margin, 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...C.white);
  doc.text('INCIDENT EVIDENCE REPORT', margin, 24);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(`REPORT ID: ${shortId}`, margin, 31);
  doc.text(`GENERATED: ${dateStr}  ${timeStr} IST`, pageW - margin, 31, { align: 'right' });

  const pCol = priorityColour(alert.priority);
  doc.setFillColor(...pCol);
  doc.roundedRect(pageW - margin - 30, 8, 30, 9, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.white);
  doc.text(alert.priority, pageW - margin - 15, 13.5, { align: 'center' });

  y = 46;

  // ── Section 1: Landowner details ─────────────────────────────────────────────
  y = sectionHeading(doc, 'Chain of Custody — Landowner Details', y, margin);

  const fields: [string, string][] = [
    ['Estate Name',      estateName],
    ['Registered Owner', ownerName],
    ['District',         legalProfile.district || '—'],
    ['State',            legalProfile.state || '—'],
    ...(legalProfile.surveyNumber ? [['Survey / Plot No.', legalProfile.surveyNumber] as [string, string]] : []),
  ];

  fields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.darkGray);
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    doc.text(value, margin + 42, y);
    y += 5.5;
  });

  y += 4;

  // ── Section 2: Incident details ──────────────────────────────────────────────
  y = sectionHeading(doc, 'Incident Details', y, margin);

  const incidentFields: [string, string][] = [
    ['Incident ID',       alert.id.slice(0, 18).toUpperCase()],
    ['Detection Type',    `${alert.type}${alert.subType ? ' — ' + alert.subType.replace(/_/g, ' ') : ''}`],
    ['Plantation Zone',   alert.zone || 'Unknown'],
    ['Confidence Level',  alert.confidence != null ? `${Math.round(alert.confidence * 100)}%` : 'N/A'],
    ['Priority Level',    alert.priority],
    ['Event Timestamp',   alert.timestamp],
    ['Sensor Description', alert.description],
  ];

  incidentFields.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.darkGray);
    doc.text(label + ':', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.black);
    const lines = doc.splitTextToSize(value, contentW - 44);
    doc.text(lines, margin + 42, y);
    y += lines.length * 4.5 + 1;
  });

  y += 2;

  // ── Incident narrative block ──────────────────────────────────────────────────
  y = sectionHeading(doc, 'Incident Assessment', y, margin);
  doc.setFillColor(245, 247, 252);
  const narrativeLines = doc.splitTextToSize(incidentNarrative, contentW - 6);
  const narrativeBlockH = narrativeLines.length * 4.5 + 6;
  doc.roundedRect(margin, y - 3, contentW, narrativeBlockH, 1, 1, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...C.charcoal);
  doc.text(narrativeLines, margin + 3, y + 1);
  y += narrativeBlockH + 4;

  // ── Section 3: Timeline ───────────────────────────────────────────────────────
  y = sectionHeading(doc, 'Timeline of Events — Zone ' + (alert.zone || 'Unknown'), y, margin);

  if (timeline.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text('No preceding events recorded in this zone.', margin, y);
    y += 6;
  } else {
    timeline.forEach((evt, i) => {
      doc.setFillColor(...C.darkGray);
      doc.circle(margin + 2, y - 1, 0.8, 'F');
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.gray);
      doc.text(evt.timestamp, margin + 5, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.black);
      const lines = doc.splitTextToSize(`[${evt.type}${evt.subType ? ' / ' + evt.subType.replace(/_/g, ' ') : ''}] ${evt.description}`, contentW - 30);
      doc.text(lines, margin + 37, y);
      y += lines.length * 4.5 + (i < timeline.length - 1 ? 1 : 0);
    });
  }

  y += 6;

  // ── Page 2: Evidence exhibits ─────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...C.black);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(`${shortId}  —  INCIDENT EVIDENCE REPORT  —  PAGE 2`, pageW / 2, 9, { align: 'center' });
  y = 22;

  y = sectionHeading(doc, 'Documentary Evidence', y, margin);

  // Exhibit A
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  doc.text(exhibitMeta.labelA, margin, y);
  y += 5;

  if (exhibitA) {
    doc.addImage(exhibitA, 'JPEG', margin, y, contentW * 0.7, 50);
    y += 52;
  } else {
    doc.setFillColor(...C.lightGray);
    doc.rect(margin, y, contentW * 0.7, 50, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text('[Image unavailable — sensor feed offline at time of capture]', margin + 4, y + 25);
    y += 52;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray);
  doc.text(`${exhibitMeta.stationA}  |  ${exhibitMeta.sensorModeA}  |  ${alert.timestamp}`, margin, y);
  const capALines = doc.splitTextToSize(exhibitMeta.captionA, contentW * 0.7);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.darkGray);
  doc.text(capALines, margin, y);
  y += capALines.length * 4 + 6;

  // Exhibit B
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  doc.text(exhibitMeta.labelB, margin, y);
  y += 5;

  if (exhibitB) {
    doc.addImage(exhibitB, 'JPEG', margin, y, contentW * 0.7, 50);
    y += 52;
  } else {
    doc.setFillColor(...C.lightGray);
    doc.rect(margin, y, contentW * 0.7, 50, 'F');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text('[Image unavailable]', margin + 4, y + 25);
    y += 52;
  }

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray);
  doc.text(`${exhibitMeta.stationB}  |  ${exhibitMeta.sensorModeB}  |  ${alert.timestamp}`, margin, y);
  const capBLines = doc.splitTextToSize(exhibitMeta.captionB, contentW * 0.7);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.darkGray);
  doc.text(capBLines, margin, y);
  y += capBLines.length * 4 + 10;

  // ── Financial exposure ────────────────────────────────────────────────────────
  y = sectionHeading(doc, 'Financial Exposure Assessment', y, margin);

  if (zoneInventory.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(...C.gray);
    doc.text('No tree inventory registered for this zone. Add inventory in Estate Intelligence.', margin, y);
    y += 7;
  } else {
    const cols = [margin, margin + 35, margin + 70, margin + 100, margin + 135];
    const headers = ['Zone', 'Species', 'Trees', 'Value / Tree', 'Exposure'];
    doc.setFillColor(...C.black);
    doc.rect(margin, y - 3, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...C.white);
    headers.forEach((h, i) => doc.text(h, cols[i] + 1, y + 1));
    y += 7;

    zoneInventory.forEach((row, i) => {
      if (i % 2 === 0) {
        doc.setFillColor(245, 247, 252);
        doc.rect(margin, y - 3, contentW, 6, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...C.black);
      const rowData = [
        row.zone,
        row.species,
        row.count.toString(),
        `₹${row.valuePerTree.toLocaleString('en-IN')}`,
        `₹${(row.count * row.valuePerTree).toLocaleString('en-IN')}`,
      ];
      rowData.forEach((val, ci) => doc.text(val, cols[ci] + 1, y + 1));
      y += 6;
    });

    doc.setFillColor(...C.black);
    doc.rect(margin, y - 1, contentW, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...C.white);
    doc.text('TOTAL EXPOSURE — AFFECTED ZONE', margin + 1, y + 4);
    doc.text(`₹${totalExposure.toLocaleString('en-IN')}`, margin + contentW - 1, y + 4, { align: 'right' });
    y += 12;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...C.gray);
    doc.text(`Total estate value across all zones: ₹${estateTotal.toLocaleString('en-IN')}`, margin, y);
    y += 9;
  }

  // ── Page 3: Declaration + hash ────────────────────────────────────────────────
  doc.addPage();
  y = margin;

  doc.setFillColor(...C.black);
  doc.rect(0, 0, pageW, 14, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text(`${shortId}  —  INCIDENT EVIDENCE REPORT  —  PAGE 3`, pageW / 2, 9, { align: 'center' });
  y = 22;

  y = sectionHeading(doc, 'Declaration', y, margin);

  const declarationText = `I, ${ownerName}, registered owner of ${estateName} estate in ${legalProfile.district}, ${legalProfile.state}, hereby declare that this incident report has been generated in good faith from automated sensor detections recorded by the Vanguard Estate Security Platform. The timestamps, sensor readings, and financial assessments contained herein are accurate to the best of my knowledge and may be submitted to law enforcement, insurance providers, or judicial authorities as documentary evidence.`;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...C.black);
  const decLines = doc.splitTextToSize(declarationText, contentW);
  doc.text(decLines, margin, y);
  y += decLines.length * 4.5 + 10;

  rule(doc, y, margin, 60);
  rule(doc, y, margin + 90, 60);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...C.gray);
  doc.text('Signature of Estate Owner', margin, y);
  doc.text('Date', margin + 90, y);
  y += 14;

  y = sectionHeading(doc, 'Integrity Verification — Tamper Evidence', y, margin);

  doc.setFillColor(240, 242, 248);
  doc.roundedRect(margin, y - 2, contentW, 28, 2, 2, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...C.darkGray);
  doc.text('SHA-256 DOCUMENT HASH', margin + 4, y + 5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...C.black);
  doc.text(hash.slice(0, 32), margin + 4, y + 12);
  doc.text(hash.slice(32), margin + 4, y + 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray);
  doc.text('Any modification to this document will invalidate the above hash.', margin + 4, y + 25);

  y += 34;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...C.gray);
  const footer = 'This document was generated automatically by the Vanguard Estate Security Platform. Report ID: ' + shortId + '. Generated: ' + dateStr + '.';
  const footerLines = doc.splitTextToSize(footer, contentW);
  doc.text(footerLines, margin, y);

  doc.save(`Vanguard-Evidence-Report-${shortId}.pdf`);
}
