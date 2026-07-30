import * as fs from "fs";
import * as path from "path";
import { SpclngParser } from "./Coder/SpclngParser";

const spclngPath = path.join(__dirname, "../tanks.spclng");
const jsonOutPath = path.join(__dirname, "./Const/TankDefinitions.json");
const rootJsonOutPath = path.join(__dirname, "../tanks.json");

if (!fs.existsSync(spclngPath)) {
    console.error(`Error: ${spclngPath} not found!`);
    process.exit(1);
}

try {
    const spclngContent = fs.readFileSync(spclngPath, "utf-8");
    const parsedDefinitions = SpclngParser.parse(spclngContent);

    const nonNullCount = parsedDefinitions.filter(Boolean).length;
    console.log(`Successfully parsed ${nonNullCount} tanks from tanks.spclng:`);
    for (const tank of parsedDefinitions) {
        if (!tank) continue;
        console.log(`  - [ID ${tank.id}] ${tank.name} (${tank.barrels.length} barrels)`);
    }

    const formattedJson = JSON.stringify(parsedDefinitions, null, 4);

    fs.writeFileSync(jsonOutPath, formattedJson, "utf-8");
    fs.writeFileSync(rootJsonOutPath, formattedJson, "utf-8");
    console.log(`Updated ${jsonOutPath} and ${rootJsonOutPath} successfully!`);
} catch (err: any) {
    console.error("Failed to parse tanks.spclng:", err);
    process.exit(1);
}
