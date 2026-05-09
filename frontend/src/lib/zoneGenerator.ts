
export function getCentroid(polygon: [number, number][]): [number, number] {
    let latSum = 0;
    let lonSum = 0;
    for (const pt of polygon) {
        latSum += pt[0];
        lonSum += pt[1];
    }
    return [latSum / polygon.length, lonSum / polygon.length];
}

export function getRandomPointInZone(polygon: [number, number][]): [number, number] {
    const centroid = getCentroid(polygon);
    // Simple jitter around centroid to guarantee it's roughly inside convex shape
    const jLat = (Math.random() - 0.5) * 0.01;
    const jLon = (Math.random() - 0.5) * 0.01;
    return [centroid[0] + jLat, centroid[1] + jLon];
}

export function kmToCoord(centerLat: number, centerLon: number, dxKm: number, dyKm: number): [number, number] {
    const kmPerLat = 111.32;
    const kmPerLon = 111.32 * Math.cos((centerLat * Math.PI) / 180);
    return [centerLat + (dyKm / kmPerLat), centerLon + (dxKm / kmPerLon)];
}

export function buildZonesFromKm(centerLat: number, centerLon: number, zonesKm: Record<string, [number, number][]>): Record<string, [number, number][]> {
    const result: Record<string, [number, number][]> = {};
    for (const [zoneId, coords] of Object.entries(zonesKm)) {
        result[zoneId] = coords.map(pt => kmToCoord(centerLat, centerLon, pt[0], pt[1]));
    }
    return result;
}

// Accurately shaped zones based on the real-world maps
export const PARK_SHAPES = {
    // Maasai Mara (~1510 km2). Iconic shape bounded by Oloololo Escarpment (NW-SE diagonal)
    // and Tanzania border (SW-NE diagonal). Divided by Mara river.
    maasaimara: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-25, 15], [-15, 20], [-5, 0], [-20, -10]], // Mara Triangle (West of River)
        'Z2': [[-15, 20], [0, 25], [5, 10], [-5, 0]], // Musiara
        'Z3': [[0, 25], [20, 22], [15, 5], [5, 10]],
        'Z4': [[20, 22], [30, 15], [25, -5], [15, 5]],
        'Z5': [[15, 5], [25, -5], [20, -15], [5, -5]],
        'Z6': [[5, -5], [20, -15], [5, -20], [-5, -10]],
        'Z7': [[-5, -10], [5, -20], [-10, -25], [-20, -10]],
        'Z8': [[-5, 0], [5, 10], [15, 5], [5, -5], [-5, -10]], // Central Hub
    }),

    // Kruger (~19485 km2). Massive vertical strip. ~350km long, ~60km wide.
    kruger: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-25, 170], [30, 160], [25, 110], [-30, 120]], // Pafuri / Far North
        'Z2': [[-30, 120], [25, 110], [30, 60], [-20, 70]],   // Shingwedzi
        'Z3': [[-20, 70], [30, 60], [35, 10], [-25, 20]],     // Letaba
        'Z4': [[-25, 20], [35, 10], [30, -40], [-30, -30]],   // Satara / Central
        'Z5': [[-30, -30], [30, -40], [25, -90], [-25, -80]], // Skukuza North
        'Z6': [[-25, -80], [25, -90], [30, -140], [-30, -130]], // Lower Sabie
        'Z7': [[-30, -130], [30, -140], [25, -170], [-15, -160]], // Malelane / South
        'Z8': [[-30, -30], [-10, -30], [-5, -80], [-25, -80]], // Western boundary buffer
    }),

    // Kaziranga (~430 km2). Very thin horizontal strip following Brahmaputra. ~40km long, ~11km wide.
    kaziranga: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-20, 5], [-10, 6], [-10, -4], [-20, -5]], // Burapahar
        'Z2': [[-10, 6], [0, 5], [0, -5], [-10, -4]],     // Bagori West
        'Z3': [[0, 5], [10, 6], [10, -4], [0, -5]],       // Bagori East
        'Z4': [[10, 6], [20, 5], [20, -5], [10, -4]],     // Kohora West
        'Z5': [[20, 5], [25, 6], [25, -4], [20, -5]],     // Kohora East
        'Z6': [[25, 6], [30, 5], [30, -4], [25, -4]],     // Agoratoli
        'Z7': [[30, 5], [35, 3], [35, -2], [30, -4]],     // Eastern edge
        'Z8': [[-15, -4], [15, -4], [15, -6], [-15, -6]], // Southern Karbi Anglong border buffer
    }),

    // Sundarbans (~1330 km2 land/water matrix). Complex blocks cut by rivers. ~36x37km.
    sundarbans: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-15, 18], [0, 15], [-2, 5], [-18, 8]],   // Pirakhali 
        'Z2': [[0, 15], [15, 18], [12, -2], [-2, 5]],    // Panchmukhani
        'Z3': [[15, 18], [20, 10], [18, -10], [12, -2]], // Harinbhanga
        'Z4': [[-18, 8], [-2, 5], [-5, -8], [-20, -5]],  // Netidhopani
        'Z5': [[-2, 5], [12, -2], [8, -15], [-5, -8]],   // Chamta
        'Z6': [[12, -2], [18, -10], [15, -20], [8, -15]],// Chandkhali
        'Z7': [[-20, -5], [-5, -8], [-8, -25], [-22, -20]], // Matla
        'Z8': [[-5, -8], [15, -20], [10, -28], [-8, -25]], // Gona / Baghmara
    }),

    // Jim Corbett (~1318 km2). Mountainous, Ramganga river. ~44x30km.
    corbett: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-22, 10], [-10, 15], [-5, 5], [-20, 0]],   // Dhikala Core
        'Z2': [[-10, 15], [5, 12], [2, 2], [-5, 5]],       // Kalagarh
        'Z3': [[5, 12], [20, 15], [15, 0], [2, 2]],        // Bijrani
        'Z4': [[20, 15], [26, 8], [20, -5], [15, 0]],      // Jhirna
        'Z5': [[-20, 0], [-5, 5], [-8, -10], [-22, -5]],   // Sonanadi East
        'Z6': [[-5, 5], [2, 2], [0, -12], [-8, -10]],      // Dhela
        'Z7': [[2, 2], [15, 0], [12, -15], [0, -12]],      // Durga Devi
        'Z8': [[15, 0], [20, -5], [18, -15], [12, -15]],   // Buffer Zone
    }),

    // Nagarhole (~643 km2). ~25x25km squarish blob with Kabini reservoir to South.
    nagarhole: (lat: number, lon: number) => buildZonesFromKm(lat, lon, {
        'Z1': [[-12, 12], [0, 15], [-2, 2], [-10, 0]],  // North West
        'Z2': [[0, 15], [12, 12], [10, 0], [-2, 2]],    // North East
        'Z3': [[-10, 0], [-2, 2], [-5, -8], [-12, -10]], // Central West
        'Z4': [[-2, 2], [10, 0], [8, -10], [-5, -8]],    // Central East
        'Z5': [[-12, -10], [-5, -8], [-8, -15], [-15, -14]], // South West (Kabini)
        'Z6': [[-5, -8], [8, -10], [5, -15], [-8, -15]],   // South East
        'Z7': [[-15, -14], [-8, -15], [-10, -20], [-15, -18]], // River Boundary
        'Z8': [[-8, -15], [5, -15], [2, -20], [-10, -20]], // Deep South
    })
};
