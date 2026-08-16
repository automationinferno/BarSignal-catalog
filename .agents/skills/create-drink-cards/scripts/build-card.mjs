import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [id, inputPath, providedRepoRoot] = process.argv.slice(2);
if (!id || !inputPath) {
  throw new Error("Usage: node build-card.mjs <drink_id> <generated_photo_path> [repo_root]");
}

const repoRoot = path.resolve(providedRepoRoot ?? process.cwd());
const drinks = JSON.parse(fs.readFileSync(path.join(repoRoot, "drinks.json"), "utf8"));
const drink = drinks.find((entry) => entry.id === id);
if (!drink) throw new Error(`Unknown drink id: ${id}`);

const width = 1254;
const photoHeight = 980;
const footerHeight = width - photoHeight;
const name = drink.name.toUpperCase();
const fontSize = Math.min(92, Math.max(60, Math.floor(1110 / (name.length * 0.61))));
const baseline = Math.floor(footerHeight * 0.61);
const escapeXml = (value) => value.replace(/[&<>\"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '\"': "&quot;",
  "'": "&apos;",
}[character]));
const svg = Buffer.from(`<svg width="${width}" height="${footerHeight}" xmlns="http://www.w3.org/2000/svg"><style>.label{font-family:Impact,'Arial Narrow',sans-serif;font-size:${fontSize}px;font-weight:900;letter-spacing:1px}</style><text x="${width / 2}" y="${baseline}" text-anchor="middle" class="label" fill="#f7f7f7">${escapeXml(name)}</text></svg>`);

const photo = await sharp(inputPath)
  .resize(width, photoHeight, { fit: "fill" })
  .removeAlpha()
  .png()
  .toBuffer();

await sharp({
  create: {
    width,
    height: width,
    channels: 3,
    background: { r: 0, g: 0, b: 0 },
  },
})
  .composite([
    { input: photo, left: 0, top: 0 },
    { input: svg, left: 0, top: photoHeight },
  ])
  .png({ compressionLevel: 9 })
  .toFile(path.join(repoRoot, "drinks", `${id}.png`));

console.log(`Built drinks/${id}.png with footer size ${fontSize}px`);
