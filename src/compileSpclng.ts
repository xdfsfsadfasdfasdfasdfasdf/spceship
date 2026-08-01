import * as fs from "fs";
import * as path from "path";
import { SpclngParser } from "./Coder/SpclngParser";

const entitiesSpclngPath = path.join(__dirname, "../entities/tanks.spclng");
const rootSpclngPath = path.join(__dirname, "../tanks.spclng");
const bossesSpclngPath = path.join(__dirname, "../entities/bosses.spclng");
const shapesSpclngPath = path.join(__dirname, "../entities/shapes.spclng");

let spclngContent = "";
if (fs.existsSync(entitiesSpclngPath)) {
    spclngContent += fs.readFileSync(entitiesSpclngPath, "utf-8") + "\n";
} else if (fs.existsSync(rootSpclngPath)) {
    spclngContent += fs.readFileSync(rootSpclngPath, "utf-8") + "\n";
}

if (fs.existsSync(bossesSpclngPath)) {
    spclngContent += fs.readFileSync(bossesSpclngPath, "utf-8") + "\n";
}

if (fs.existsSync(shapesSpclngPath)) {
    spclngContent += fs.readFileSync(shapesSpclngPath, "utf-8") + "\n";
}

const jsonOutPath = path.join(__dirname, "./Const/TankDefinitions.json");
const rootJsonOutPath = path.join(__dirname, "../tanks.json");
const entitiesJsonOutPath = path.join(__dirname, "../entities/tanks.json");

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
    if (fs.existsSync(path.dirname(entitiesJsonOutPath))) {
        fs.writeFileSync(entitiesJsonOutPath, formattedJson, "utf-8");
    }
    console.log(`Updated ${jsonOutPath} and ${rootJsonOutPath} successfully!`);
} catch (err: any) {
    console.error(`Failed to parse spclng:`, err);
    process.exit(1);
}
