import * as fs from "fs";
import * as path from "path";
import { SpclngParser } from "./Coder/SpclngParser";

const defDir = path.join(__dirname, "../entities/definitions");
const entitiesDir = path.join(__dirname, "../entities");
const rootDir = path.join(__dirname, "..");

let spclngContent = "";

if (fs.existsSync(defDir)) {
    const defFiles = fs.readdirSync(defDir).filter(f => f.endsWith(".spclng"));
    for (const file of defFiles) {
        spclngContent += fs.readFileSync(path.join(defDir, file), "utf-8") + "\n";
    }
} else {
    // Fallback paths
    const filesToTry = ["tanks.spclng", "bosses.spclng", "shapes.spclng", "celestials.spclng"];
    for (const f of filesToTry) {
        const p1 = path.join(entitiesDir, f);
        const p2 = path.join(rootDir, f);
        if (fs.existsSync(p1)) spclngContent += fs.readFileSync(p1, "utf-8") + "\n";
        else if (fs.existsSync(p2)) spclngContent += fs.readFileSync(p2, "utf-8") + "\n";
    }
}

const jsonOutPath = path.join(__dirname, "./Const/TankDefinitions.json");
const rootJsonOutPath = path.join(__dirname, "../tanks.json");
const entitiesJsonOutPath = path.join(__dirname, "../entities/tanks.json");
const defJsonOutPath = path.join(__dirname, "../entities/definitions/tanks.json");

if (!spclngContent.trim()) {
    console.error(`Error: No spclng content found!`);
    process.exit(1);
}

try {
    const parsedDefinitions = SpclngParser.parse(spclngContent);

    const nonNullCount = parsedDefinitions.filter(Boolean).length;
    console.log(`Successfully parsed ${nonNullCount} entities from spclng:`);
    for (const tank of parsedDefinitions) {
        if (!tank) continue;
        console.log(`  - [ID ${tank.id}] ${tank.name} (${tank.barrels.length} barrels)`);
    }

    const formattedJson = JSON.stringify(parsedDefinitions, null, 4);

    fs.writeFileSync(jsonOutPath, formattedJson, "utf-8");
    fs.writeFileSync(rootJsonOutPath, formattedJson, "utf-8");
    if (fs.existsSync(path.dirname(defJsonOutPath))) {
        fs.writeFileSync(defJsonOutPath, formattedJson, "utf-8");
    }
    if (fs.existsSync(path.dirname(entitiesJsonOutPath))) {
        fs.writeFileSync(entitiesJsonOutPath, formattedJson, "utf-8");
    }
    console.log(`Updated ${jsonOutPath} and ${defJsonOutPath} successfully!`);
} catch (err: any) {
    console.error(`Failed to parse spclng:`, err);
    process.exit(1);
}
