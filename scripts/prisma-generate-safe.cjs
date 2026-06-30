const { existsSync, rmSync, readFileSync } = require("node:fs");
const { isAbsolute, join, resolve } = require("node:path");
const { spawnSync } = require("node:child_process");

const args = process.argv.slice(2);

function readArg(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const schemaPath = readArg("--schema", "prisma/schema.prisma");
const databaseUrl = readArg("--database-url", "postgresql://inventory:inventory@127.0.0.1:5560/inventory");
const repoRoot = resolve(__dirname, "..");
const schemaFullPath = isAbsolute(schemaPath) ? schemaPath : join(repoRoot, schemaPath);
const clientDirectory = join(repoRoot, "node_modules", ".prisma", "client");

if (process.env.PRISMA_GENERATE_NO_ENGINE) {
  throw new Error("Generation Prisma refusee : PRISMA_GENERATE_NO_ENGINE est defini.");
}

if (process.env.PRISMA_CLIENT_ENGINE_TYPE === "client") {
  throw new Error("Generation Prisma refusee : PRISMA_CLIENT_ENGINE_TYPE=client est incompatible avec PostgreSQL local.");
}

if (!existsSync(schemaFullPath)) {
  throw new Error(`Schema Prisma introuvable : ${schemaFullPath}`);
}

if (existsSync(clientDirectory)) {
  try {
    rmSync(clientDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : "UNKNOWN";
    console.warn(`Suppression du client Prisma existant impossible (${code}); regeneration tentee quand meme.`);
  }
}

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["prisma", "generate", "--schema", schemaFullPath], {
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl
  },
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.error) {
  console.error(`Impossible de lancer ${command} : ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const generatedIndex = join(clientDirectory, "index.js");
if (!existsSync(generatedIndex)) {
  throw new Error(`Client Prisma genere introuvable : ${generatedIndex}`);
}

const generatedContent = readFileSync(generatedIndex, "utf8");
if (!/"copyEngine":\s*true/.test(generatedContent)) {
  throw new Error("Generation Prisma invalide : le client genere n embarque pas l engine local.");
}

console.log("Prisma Client regenere avec engine local valide.");
