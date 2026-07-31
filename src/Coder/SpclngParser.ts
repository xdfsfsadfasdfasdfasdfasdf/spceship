/*
    SPCLNG Parser & Transpiler for DiepCustom
    Parses .spclng tank definition files into TankDefinition TypeScript/JSON structures.
*/

import { TankDefinition, BarrelDefinition, BulletDefinition, addonId } from "../Const/TankDefinitions";

interface ParsedGun {
    type?: string;
    width?: number;
    length?: number;
    delay?: number;
    offset?: number;
    angle?: number;
    bullet?: number;
    recoil?: number;
    children?: number | "inf";
    range?: number;
    rmb?: boolean;
    altfire?: boolean;
    fires?: boolean;
    aspect?: number;
    correction?: number;
}

interface ParsedFlank {
    repeat: number;
    startangle: number;
    guns: ParsedGun[];
}

interface ParsedLayer {
    sides?: number;
    spin?: number;
    size?: number;
    color?: string;
    guns: (ParsedGun | ParsedFlank)[];
}

interface ParsedShell {
    sides: number;
    spin: number;
}

interface ParsedTank {
    name: string;
    id: number | "temp";
    tip: string;
    level: number;
    displayname: string;
    branchto: string[];
    hat?: string;
    inheritsFrom?: string;
    isOver?: boolean;
    isGuard?: boolean;
    properties: Record<string, number | boolean | "inf">;
    shells: ParsedShell[];
    layers: ParsedLayer[];
    stats: Record<string, number>;
}

export class SpclngParser {
    public static parse(content: string): TankDefinition[] {
        const rawTanks = this.parseRaw(content);
        return this.transpile(rawTanks);
    }

    private static parseRaw(content: string): ParsedTank[] {
        const lines = content.split(/\r?\n/);
        const tanks: ParsedTank[] = [];
        let currentTank: ParsedTank | null = null;
        let currentSection: string | null = null;
        let currentLayer: ParsedLayer | null = null;
        let currentGun: ParsedGun | null = null;
        let currentFlank: ParsedFlank | null = null;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            // Remove comments
            const commentIdx = line.indexOf("//");
            if (commentIdx !== -1) {
                line = line.slice(0, commentIdx);
            }
            const trimmed = line.trim();
            if (!trimmed) continue;

            const indent = line.search(/\S/);

            // Check for def tank: (e.g. def autoGunner: or def autoGunner: displayname: 'Auto Gunner', makeAuto Gunner)
            const defMatch = trimmed.match(/^def\s+([a-zA-Z0-9_$]+):/);
            if (defMatch) {
                currentTank = {
                    name: defMatch[1],
                    id: "temp",
                    tip: "",
                    level: 0,
                    displayname: defMatch[1],
                    branchto: [],
                    properties: {},
                    shells: [],
                    layers: [],
                    stats: {}
                };
                tanks.push(currentTank);
                currentSection = null;
                currentLayer = null;
                currentGun = null;
                currentFlank = null;

                // Check for inline directives on def line after colon
                const restOfLine = trimmed.slice(defMatch[0].length).trim();
                if (restOfLine) {
                    this.parseInlineDirectives(currentTank, restOfLine);
                }
                continue;
            }

            if (!currentTank) continue;

            // Check for macro directives (makeAuto, makeOver, makeGuard)
            const macroMatch = trimmed.match(/^(makeAuto|makeOver|makeGuard)[:\s]+['"]?([a-zA-Z0-9_\s]+)['"]?/i);
            if (macroMatch) {
                const macroType = macroMatch[1].toLowerCase();
                const baseName = macroMatch[2].trim().replace(/^['"]|['"]$/g, "");
                currentTank.inheritsFrom = baseName;
                if (macroType === "makeauto") currentTank.hat = "auto";
                else if (macroType === "makeover") currentTank.isOver = true;
                else if (macroType === "makeguard") currentTank.isGuard = true;
                continue;
            }

            // Header level sections inside tank
            if (indent === 1 || (indent === 0 && !defMatch) || (indent === 2 && trimmed.endsWith(":"))) {
                if (trimmed.startsWith("branchto:")) {
                    currentSection = "branchto";
                    continue;
                } else if (trimmed.startsWith("properties:")) {
                    currentSection = "properties";
                    continue;
                } else if (trimmed.startsWith("shell:")) {
                    currentSection = "shell";
                    continue;
                } else if (trimmed.match(/^layer\s+\d+:/i)) {
                    currentSection = "layer";
                    currentLayer = { guns: [] };
                    currentTank.layers.push(currentLayer);
                    currentGun = null;
                    currentFlank = null;
                    continue;
                    continue;
                } else if (trimmed.startsWith("stats:")) {
                    currentSection = "stats";
                    continue;
                }
            }

            // Key-value parsing based on section
            if (currentSection === "branchto") {
                const branchItems = trimmed.split(",")
                    .map(s => s.trim().replace(/^['"]|['"],?$/g, "").replace(/;$/, ""))
                    .filter(s => s.length > 0);
                currentTank.branchto.push(...branchItems);
                continue;
            }

            // Parse key-value pair
            const kvMatch = trimmed.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
            if (!kvMatch) continue;

            const key = kvMatch[1];
            let valStr = kvMatch[2].replace(/[,;]$/, "").trim();

            if (currentSection === "properties") {
                currentTank.properties[key] = this.parseValue(valStr);
            } else if (currentSection === "stats") {
                currentTank.stats[key] = Number(valStr) || 0;
            } else if (currentSection === "shell") {
                if (key === "sides") {
                    currentTank.shells.push({ sides: Number(valStr) || 4, spin: 0 });
                } else if (key === "spin") {
                    if (currentTank.shells.length > 0) {
                        currentTank.shells[currentTank.shells.length - 1].spin = Number(valStr) || 0;
                    }
                }
            } else if (currentSection === "layer" && currentLayer) {
                if (key === "sides") currentLayer.sides = Number(valStr) || 4;
                else if (key === "spin") currentLayer.spin = Number(valStr) || 0;
                else if (key === "size") currentLayer.size = Number(valStr) || 1;
                else if (key === "color") currentLayer.color = valStr;
                else if (key === "flank") {
                    currentFlank = { repeat: 1, startangle: 0, guns: [] };
                    currentLayer.guns.push(currentFlank);
                    currentGun = null;
                } else if (key === "repeat" && currentFlank) {
                    currentFlank.repeat = Number(valStr) || 1;
                } else if (key === "startangle") {
                    if (currentFlank) currentFlank.startangle = Number(valStr) || 0;
                } else if (key === "type") {
                    const gunObj: ParsedGun = { type: valStr };
                    if (currentFlank) {
                        currentFlank.guns.push(gunObj);
                    } else {
                        currentLayer.guns.push(gunObj);
                    }
                    currentGun = gunObj;
                } else if (currentGun) {
                    (currentGun as any)[key] = this.parseValue(valStr);
                }
            } else {
                // Top-level tank keys (e.g. id, tip, level, displayname, hat, makeAuto, makeOver, makeGuard)
                if (key === "id") currentTank.id = valStr === "temp" ? "temp" : Number(valStr);
                else if (key === "tip") currentTank.tip = valStr.replace(/^['"]|['"]$/g, "");
                else if (key === "level") currentTank.level = Number(valStr) || 0;
                else if (key === "displayname" || key === "displayName") currentTank.displayname = valStr.replace(/^['"]|['"]$/g, "");
                else if (key === "hat") currentTank.hat = valStr;
                else if (key === "makeAuto" || key === "makeOver" || key === "makeGuard") {
                    currentTank.inheritsFrom = valStr.replace(/^['"]|['"]$/g, "");
                    if (key === "makeAuto") currentTank.hat = "auto";
                    else if (key === "makeOver") currentTank.isOver = true;
                    else if (key === "makeGuard") currentTank.isGuard = true;
                }
            }
        }

        return tanks;
    }

    private static parseInlineDirectives(tank: ParsedTank, text: string) {
        const parts = text.split(",");
        for (let part of parts) {
            part = part.trim();
            if (!part) continue;
            const kv = part.match(/^([a-zA-Z0-9_]+)[:\s]+(.*)$/);
            if (kv) {
                const k = kv[1];
                const v = kv[2].replace(/^['"]|['"]$/g, "");
                if (k === "displayname" || k === "displayName") tank.displayname = v;
                else if (k === "level") tank.level = Number(v) || 0;
                else if (k === "id") tank.id = v === "temp" ? "temp" : Number(v) || "temp";
                else if (k === "makeAuto") { tank.inheritsFrom = v; tank.hat = "auto"; }
                else if (k === "makeOver") { tank.inheritsFrom = v; tank.isOver = true; }
                else if (k === "makeGuard") { tank.inheritsFrom = v; tank.isGuard = true; }
            } else {
                const m = part.match(/^(makeAuto|makeOver|makeGuard)\s+['"]?([a-zA-Z0-9_\s]+)['"]?/i);
                if (m) {
                    const macro = m[1].toLowerCase();
                    const base = m[2].trim().replace(/^['"]|['"]$/g, "");
                    tank.inheritsFrom = base;
                    if (macro === "makeauto") tank.hat = "auto";
                    else if (macro === "makeover") tank.isOver = true;
                    else if (macro === "makeguard") tank.isGuard = true;
                }
            }
        }
    }

    private static parseValue(val: string): any {
        val = val.replace(/^['"]|['"]$/g, "");
        if (val === "inf") return "inf";
        if (val === "true") return true;
        if (val === "false") return false;
        const num = Number(val);
        return isNaN(num) ? val : num;
    }

    private static transpile(parsedTanks: ParsedTank[]): TankDefinition[] {
        // Resolve inheritance (makeAuto, makeOver, makeGuard)
        for (const tank of parsedTanks) {
            if (tank.inheritsFrom) {
                if (tank.level === 0) tank.level = 45;
                const baseNameNorm = tank.inheritsFrom.toLowerCase();
                const baseTank = parsedTanks.find(t => t.name.toLowerCase() === baseNameNorm || t.displayname.toLowerCase() === baseNameNorm);
                if (baseTank) {
                    // Inherit shells if not defined
                    if (tank.shells.length === 0 && baseTank.shells.length > 0) {
                        tank.shells = JSON.parse(JSON.stringify(baseTank.shells));
                    }
                    // Inherit layers if not defined or merge
                    if (tank.layers.length === 0 && baseTank.layers.length > 0) {
                        tank.layers = JSON.parse(JSON.stringify(baseTank.layers));
                    }
                    // Inherit properties
                    tank.properties = { ...baseTank.properties, ...tank.properties };
                    // Inherit stats
                    tank.stats = { ...baseTank.stats, ...tank.stats };

                    // Add extra barrels for makeOver or makeGuard
                    if (tank.isOver && tank.layers.length > 0) {
                        tank.layers[0].guns.push(
                            { type: "drone", width: 50, length: 60, delay: 0, offset: 0, angle: 90, bullet: -6, aspect: 0.5, children: 2 },
                            { type: "drone", width: 50, length: 60, delay: 0, offset: 0, angle: 270, bullet: -6, aspect: 0.5, children: 2 }
                        );
                    }
                    if (tank.isGuard && tank.layers.length > 0) {
                        tank.layers[0].guns.push(
                            { type: "trap", width: 42, length: 75, delay: 0, offset: 0, angle: 180, bullet: -2, recoil: 1, children: "inf" }
                        );
                    }
                }
            }
        }

        // Name to ID mapping table
        const nameToIdMap: Record<string, number> = {
            "Tank": 0, "Basic": 0,
            "Twin": 1,
            "Triplet": 2, "Quadruplet": 2,
            "Triple Shot": 3, "TripleShot": 3, "Quad Shot": 3, "QuadShot": 3,
            "Quad Tank": 4, "QuadTank": 4,
            "Sniper": 6,
            "Machine Gun": 7, "MachineGun": 7,
            "Flank Guard": 8, "FlankGuard": 8,
            "Tri-Angle": 9, "TriAngle": 9, "Quad-Angle": 9, "QuadAngle": 9,
            "Destroyer": 10,
            "Overseer": 11,
            "Overlord": 12,
            "Twin Flank": 13, "Twin-Flank": 13, "TwinFlank": 13,
            "Penta Shot": 14, "PentaShot": 14, "Octo Shot": 14, "OctoShot": 14, "Pentalet": 14,
            "Assassin": 15,
            "Arena Closer": 16, "ArenaCloser": 16,
            "Necromancer": 17,
            "Triple Twin": 18, "TripleTwin": 18, "Quad Twin": 18, "QuadTwin": 18,
            "Hunter": 19,
            "Stalker": 21,
            "Ranger": 22,
            "Booster": 23,
            "Fighter": 24,
            "Hybrid": 25,
            "Manager": 26,
            "Mothership": 27,
            "Predator": 28,
            "Sprayer": 29,
            "Trapper": 30,
            "Gunner Trapper": 32, "GunnerTrapper": 32,
            "Overtrapper": 33,
            "Mega Trapper": 34, "MegaTrapper": 34,
            "Tri Trapper": 35, "Tri-Trapper": 35, "TriTrapper": 35, "Quad Trapper": 35, "Quad-Trapper": 35, "QuadTrapper": 35,
            "Smasher": 36,
            "Landmine": 37,
            "Auto Gunner": 39, "AutoGunner": 39,
            "Auto 3": 41, "Auto3": 41, "Auto 4": 41, "Auto4": 41,
            "Streamliner": 43,
            "Auto Trapper": 44, "AutoTrapper": 44,
            "Auto Triplet": 104, "AutoTriplet": 104,
            "Dominator": 45,
            "Battleship": 48,
            "Annihilator": 49,
            "Auto Smasher": 50, "AutoSmasher": 50,
            "Spike": 51,
            "Factory": 52,
            "Skimmer": 54,
            "Rocketeer": 55,
            "Binary": 56
        };

        const usedIds = new Set<number>();
        for (const val of Object.values(nameToIdMap)) {
            if (typeof val === "number") usedIds.add(val);
        }
        for (const tank of parsedTanks) {
            if (typeof tank.id === "number") {
                usedIds.add(tank.id);
                nameToIdMap[tank.displayname] = tank.id;
                nameToIdMap[tank.name] = tank.id;
            }
        }

        for (const tank of parsedTanks) {
            if (tank.id === "temp") {
                let candidate = 0;
                while (usedIds.has(candidate)) {
                    candidate++;
                }
                tank.id = candidate;
                usedIds.add(candidate);
                nameToIdMap[tank.displayname] = candidate;
                nameToIdMap[tank.name] = candidate;
            }
        }

        const definitions: TankDefinition[] = [];

        const definedIds = new Set(parsedTanks.map(t => t.id as number));

        for (const raw of parsedTanks) {
            const id = raw.id as number;
            const upgrades = raw.branchto
                .map(bName => nameToIdMap[bName])
                .filter((bId): bId is number => bId !== undefined && definedIds.has(bId));

            const barrels: BarrelDefinition[] = [];

            for (const layer of raw.layers) {
                for (const item of layer.guns) {
                    if ("repeat" in item) {
                        const flank = item as ParsedFlank;
                        const step = (Math.PI * 2) / flank.repeat;
                        const startRad = (flank.startangle * Math.PI) / 180;
                        for (let r = 0; r < flank.repeat; r++) {
                            const angleOffset = startRad + r * step;
                            for (const g of flank.guns) {
                                barrels.push(this.buildBarrel(g, angleOffset));
                            }
                        }
                    } else {
                        barrels.push(this.buildBarrel(item as ParsedGun, 0));
                    }
                }
            }

            let postAddon: addonId | null = null;
            let preAddon: addonId | null = null;

            if (raw.hat) {
                const h = raw.hat.toLowerCase();
                if (h === "auto" || h === "autoturret") postAddon = "autoturret";
                else if (h === "auto2" || h === "binary") postAddon = "auto2";
                else if (h === "auto3" || h === "auto4") postAddon = "auto4";
                else if (h === "auto7") postAddon = "auto7";
                else if (h === "autosmasher") postAddon = "autosmasher";
                else if (h === "smasher") postAddon = "smasher";
                else if (h === "spike") postAddon = "spike";
                else if (h === "landmine") postAddon = "landmine";
                else postAddon = raw.hat as addonId;
            }

            if (raw.shells.length > 0) {
                const s = raw.shells;
                if (s.length === 1 && s[0].sides === 6) {
                    if (postAddon === "autoturret" || raw.hat === "auto") {
                        postAddon = "autosmasher";
                    } else {
                        preAddon = "smasher";
                    }
                } else if (s.length >= 2 && s[0].sides === 12) {
                    preAddon = "spike";
                } else if (s.length >= 2 && s[0].sides === 6) {
                    preAddon = "landmine";
                }
            }

            const sides = raw.layers[0]?.sides ?? 4;

            const def: TankDefinition = {
                id,
                name: raw.displayname || raw.name,
                upgradeMessage: raw.tip || "",
                levelRequirement: raw.level,
                upgrades,
                flags: {
                    invisibility: raw.properties.invis !== "inf" && Boolean(raw.properties.invis),
                    zoomAbility: Boolean(raw.properties.zoom),
                    canClaimSquares: Boolean(raw.properties.infects),
                    devOnly: Boolean(raw.properties.devonly)
                },
                visibilityRateShooting: 0.23,
                visibilityRateMoving: 0.08,
                invisibilityRate: raw.properties.invis === "inf" ? 0.03 : (1 / (Number(raw.properties.invis) || 30)),
                fieldFactor: Number(raw.properties.fov) || 1,
                absorbtionFactor: Number(raw.properties.bodydmg) || 1,
                speed: Number(raw.properties.movespeed) || 1,
                maxHealth: (Number(raw.properties.maxhealth) || 1) * 50,
                preAddon,
                postAddon,
                sides,
                borderWidth: 15,
                barrels,
                stats: [
                    { name: "Movement Speed", max: raw.stats.movespeed ?? 7 },
                    { name: "Reload", max: raw.stats.reload ?? 7 },
                    { name: "Bullet Damage", max: raw.stats.damage ?? 7 },
                    { name: "Bullet Penetration", max: raw.stats.correction ?? 7 },
                    { name: "Bullet Speed", max: raw.stats.speed ?? 7 },
                    { name: "Body Damage", max: raw.stats.bodydmg ?? 7 },
                    { name: "Max Health", max: raw.stats.maxhealth ?? 7 },
                    { name: "Health Regen", max: raw.stats.healthregen ?? 7 }
                ]
            };

            definitions.push(def);
        }

        const maxId = Math.max(...definitions.map(d => d.id), 0);
        const indexedArray: (TankDefinition | null)[] = new Array(maxId + 1).fill(null);

        for (const def of definitions) {
            indexedArray[def.id] = def;
        }

        return indexedArray as any;
    }

    private static buildBarrel(g: ParsedGun, extraAngleRad: number): BarrelDefinition {
        const baseAngleDeg = g.angle ?? 0;
        const totalAngleRad = (baseAngleDeg * Math.PI) / 180 + extraAngleRad;

        const isTrapezoid = g.aspect !== undefined ? g.aspect !== 0 : false;
        const trapezoidDirection = g.aspect !== undefined && g.aspect < 0 ? Math.PI : 0;

        let projType: any = "bullet";
        if (g.type === "trap") projType = "trap";
        else if (g.type === "drone") projType = "drone";
        else if (g.type === "auto") projType = "bullet";

        const bulletDef: BulletDefinition = {
            type: projType,
            sizeRatio: 1,
            health: 1,
            damage: 1,
            speed: 1,
            scatterRate: g.correction !== undefined ? g.correction : 1,
            lifeLength: 1,
            absorbtionFactor: 1
        };

        return {
            angle: totalAngleRad,
            offset: g.offset ?? 0,
            size: g.length ?? 95,
            width: g.width ?? 42,
            delay: g.delay ?? 0,
            reload: 1,
            recoil: g.recoil ?? 1,
            isTrapezoid,
            trapezoidDirection,
            addon: null,
            droneCount: typeof g.children === "number" ? g.children : undefined,
            canControlDrones: g.type === "drone",
            forceFire: g.type === "auto" ? true : (g.fires === false ? false : undefined),
            bullet: bulletDef
        };
    }
}
