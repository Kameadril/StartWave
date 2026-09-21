import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const sourceRoot = path.join(repositoryRoot, "GAMES", "bdo", "site");
const existingPublicOutput = path.join(repositoryRoot, "dist");
const outputRoot = path.join(repositoryRoot, "dist-bdo");
const temporaryRoot = path.join(repositoryRoot, "dist-bdo.tmp");
const previousRoot = path.join(repositoryRoot, "dist-bdo.previous");

const fileMappings = [
  {
    source: "GAMES/bdo/site/bdo.html",
    target: "index.html",
    transform: "html"
  },
  {
    source: "GAMES/bdo/site/pages/bdo-items.html",
    target: "items.html",
    transform: "html"
  },
  {
    source: "assets/css/style.css",
    target: "assets/css/style.css",
    transform: "css"
  },
  {
    source: "assets/js/script.js",
    target: "assets/js/script.js"
  },
  {
    source: "GAMES/bdo/site/assets/data/bdo-coupons.js",
    target: "assets/data/bdo-coupons.js"
  },
  {
    source: "GAMES/bdo/site/assets/js/bdo-live-data.js",
    target: "assets/js/bdo-live-data.js"
  },
  {
    source: "GAMES/bdo/site/assets/js/bdo-items.js",
    target: "assets/js/bdo-items.js"
  }
];

const directoryMappings = [
  {
    source: "GAMES/bdo/site/assets/images",
    target: "assets/images"
  }
];

const requiredOutputs = [
  "index.html",
  "items.html",
  "assets/css/style.css",
  "assets/js/script.js",
  "assets/js/bdo-live-data.js",
  "assets/js/bdo-items.js"
];

const forbiddenClientCredentialMarkers = [
  "service_role",
  "sb_secret_",
  "STARTWAVE_SUPABASE_WRITE_KEY"
];

const claimedTargets = new Map();

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes its root: ${relativePath}`);
  }

  return resolved;
}

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);

  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== "..")
  );
}

function assertOutputIsolation() {
  const protectedPaths = [
    path.join(repositoryRoot, ".git"),
    existingPublicOutput,
    sourceRoot,
    path.join(repositoryRoot, "assets"),
    path.join(repositoryRoot, "infra"),
    path.join(repositoryRoot, "package.json"),
    path.join(repositoryRoot, "wrangler.jsonc")
  ];

  for (const candidate of [outputRoot, temporaryRoot, previousRoot]) {
    if (candidate === repositoryRoot) {
      throw new Error("BDO output cannot be the repository root");
    }

    for (const protectedPath of protectedPaths) {
      if (
        pathsOverlap(candidate, protectedPath) ||
        pathsOverlap(protectedPath, candidate)
      ) {
        throw new Error(
          `BDO output overlaps protected repository data: ${path.relative(
            repositoryRoot,
            protectedPath
          ) || "."}`
        );
      }
    }
  }

  if (
    pathsOverlap(outputRoot, existingPublicOutput) ||
    pathsOverlap(existingPublicOutput, outputRoot)
  ) {
    throw new Error("dist-bdo must not overlap dist");
  }
}

function claimTarget(targetRelative, sourceRelative) {
  const normalized = targetRelative.replaceAll("\\", "/");
  const previousSource = claimedTargets.get(normalized);

  if (previousSource) {
    throw new Error(
      `Target collision: ${normalized} is owned by both ` +
        `${previousSource} and ${sourceRelative}`
    );
  }

  claimedTargets.set(normalized, sourceRelative);
}

function isExternalReference(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference);
}

function rewriteBdoReference(reference) {
  if (!reference || isExternalReference(reference)) {
    return reference;
  }

  if (reference.startsWith("../assets/")) {
    return rewriteBdoReference(reference.slice(3));
  }

  if (
    reference === "assets/images/bdo/bdo-hero-startwave.webp" ||
    reference === "assets/images/bdo/bdo-hero-startwave-768.webp"
  ) {
    return "assets/images/bdo/bdo-hero-startwave-mobile.webp";
  }

  if (reference === "assets/images/bdo/bdo-card-barter.webp") {
    return "assets/images/bdo/bdo-card-trading.webp";
  }

  if (reference === "assets/images/bdo/bdo-card-bosses.webp") {
    return "assets/images/bdo/bdo-card-pve.webp";
  }

  if (
    reference === "index.html" ||
    reference === "../index.html" ||
    reference === "bdo.html" ||
    reference === "../bdo.html"
  ) {
    return "/";
  }

  if (
    reference === "pages/bdo-items.html" ||
    reference === "bdo-items.html"
  ) {
    return "/items";
  }

  const homePageMatch = reference.match(
    /^(?:\.\.\/)?(entertainment|services|ai)\.html$/
  );

  if (homePageMatch) {
    return `https://startwave.space/${homePageMatch[1]}`;
  }

  const nestedLegacyPageMatch = reference.match(
    /^pages\/(bdo-[a-z0-9-]+)\.html([?#].*)?$/i
  );

  if (nestedLegacyPageMatch) {
    return (
      `https://startwave.space/pages/${nestedLegacyPageMatch[1]}` +
      (nestedLegacyPageMatch[2] || "")
    );
  }

  const siblingLegacyPageMatch = reference.match(
    /^(bdo-[a-z0-9-]+)\.html([?#].*)?$/i
  );

  if (siblingLegacyPageMatch) {
    if (siblingLegacyPageMatch[1].toLowerCase() === "bdo-items") {
      return `/items${siblingLegacyPageMatch[2] || ""}`;
    }

    return (
      `https://startwave.space/pages/${siblingLegacyPageMatch[1]}` +
      (siblingLegacyPageMatch[2] || "")
    );
  }

  return reference;
}

function transformHtml(contents) {
  const withoutLegacyRelations = contents.replace(
    /\s*<script\s+src=(["'])\.\.\/assets\/js\/bdo-world-relations\.js\1><\/script>/gi,
    ""
  );

  return withoutLegacyRelations.replace(
    /\b(href|src)=(["'])([^"']+)\2/gi,
    (match, attribute, quote, reference) =>
      `${attribute}=${quote}${rewriteBdoReference(reference)}${quote}`
  );
}

function transformCss(contents) {
  return contents.replaceAll(
    "../images/bdo/bdo-hero-startwave.webp",
    "../images/bdo/bdo-hero-startwave-mobile.webp"
  );
}

async function copyMappedFile(mapping) {
  const source = resolveInside(repositoryRoot, mapping.source);
  const target = resolveInside(temporaryRoot, mapping.target);
  const sourceInfo = await lstat(source);

  if (sourceInfo.isSymbolicLink()) {
    throw new Error(`Symbolic links are not publishable: ${mapping.source}`);
  }

  if (!sourceInfo.isFile()) {
    throw new Error(`Mapped source is not a regular file: ${mapping.source}`);
  }

  claimTarget(mapping.target, mapping.source);
  await mkdir(path.dirname(target), { recursive: true });

  if (mapping.transform === "html") {
    const contents = await readFile(source, "utf8");
    await writeFile(target, transformHtml(contents), "utf8");
    return;
  }

  if (mapping.transform === "css") {
    const contents = await readFile(source, "utf8");
    await writeFile(target, transformCss(contents), "utf8");
    return;
  }

  await copyFile(source, target);
}

async function copyMappedDirectory(sourceRelative, targetRelative) {
  const sourceDirectory = resolveInside(repositoryRoot, sourceRelative);
  const sourceInfo = await lstat(sourceDirectory);

  if (sourceInfo.isSymbolicLink()) {
    throw new Error(`Symbolic links are not publishable: ${sourceRelative}`);
  }

  if (!sourceInfo.isDirectory()) {
    throw new Error(`Mapped source is not a directory: ${sourceRelative}`);
  }

  const entries = await readdir(sourceDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));

  for (const entry of entries) {
    const sourceChild = path.posix.join(sourceRelative, entry.name);
    const targetChild = path.posix.join(targetRelative, entry.name);

    if (entry.isSymbolicLink()) {
      throw new Error(`Symbolic links are not publishable: ${sourceChild}`);
    }

    if (entry.isDirectory()) {
      await copyMappedDirectory(sourceChild, targetChild);
      continue;
    }

    if (entry.isFile()) {
      await copyMappedFile({
        source: sourceChild,
        target: targetChild
      });
      continue;
    }

    throw new Error(`Unsupported source entry: ${sourceChild}`);
  }
}

function referenceCandidates(targetRelative, reference) {
  const pathOnly = reference.split(/[?#]/, 1)[0];

  if (!pathOnly) {
    return [];
  }

  if (pathOnly === "/") {
    return ["index.html"];
  }

  const relativeTarget = pathOnly.startsWith("/")
    ? pathOnly.slice(1)
    : path.posix.normalize(
        path.posix.join(path.posix.dirname(targetRelative), pathOnly)
      );

  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith("../") ||
    path.posix.isAbsolute(relativeTarget)
  ) {
    throw new Error(
      `Local reference escapes dist-bdo: ${targetRelative} -> ${reference}`
    );
  }

  if (path.posix.extname(relativeTarget)) {
    return [relativeTarget];
  }

  return [
    relativeTarget,
    `${relativeTarget}.html`,
    path.posix.join(relativeTarget, "index.html")
  ];
}

async function targetExists(relativePath) {
  try {
    const info = await stat(resolveInside(temporaryRoot, relativePath));
    return info.isFile() || info.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function validateReference(targetRelative, reference) {
  if (!reference || isExternalReference(reference)) {
    return;
  }

  const candidates = referenceCandidates(targetRelative, reference);

  for (const candidate of candidates) {
    if (await targetExists(candidate)) {
      return;
    }
  }

  throw new Error(
    `Broken local reference: ${targetRelative} -> ${reference}`
  );
}

async function validateLocalReferences() {
  for (const targetRelative of claimedTargets.keys()) {
    if (!/\.(?:html|css)$/i.test(targetRelative)) {
      continue;
    }

    const targetFile = resolveInside(temporaryRoot, targetRelative);
    const contents = await readFile(targetFile, "utf8");
    const references = [];

    if (/\.html$/i.test(targetRelative)) {
      for (const match of contents.matchAll(
        /\b(?:href|src)=(["'])([^"']+)\1/gi
      )) {
        references.push(match[2].trim());
      }
    }

    if (/\.css$/i.test(targetRelative)) {
      for (const match of contents.matchAll(
        /\burl\(\s*(["']?)([^"')]+)\1\s*\)/gi
      )) {
        references.push(match[2].trim());
      }
    }

    for (const reference of references) {
      await validateReference(targetRelative, reference);
    }
  }
}

async function validateRequiredOutputs() {
  for (const requiredOutput of requiredOutputs) {
    const info = await stat(resolveInside(temporaryRoot, requiredOutput));

    if (!info.isFile()) {
      throw new Error(
        `Required output is not a regular file: ${requiredOutput}`
      );
    }
  }
}

async function validateLiveItemsContract() {
  const itemsHtml = await readFile(
    resolveInside(temporaryRoot, "items.html"),
    "utf8"
  );
  const liveData = await readFile(
    resolveInside(temporaryRoot, "assets/js/bdo-live-data.js"),
    "utf8"
  );
  const itemRenderer = await readFile(
    resolveInside(temporaryRoot, "assets/js/bdo-items.js"),
    "utf8"
  );

  const liveScriptIndex = itemsHtml.indexOf(
    'src="assets/js/bdo-live-data.js"'
  );
  const rendererScriptIndex = itemsHtml.indexOf(
    'src="assets/js/bdo-items.js"'
  );

  if (liveScriptIndex === -1 || rendererScriptIndex === -1) {
    throw new Error("items.html is missing the LIVE Items scripts");
  }

  if (liveScriptIndex >= rendererScriptIndex) {
    throw new Error(
      "bdo-live-data.js must load before bdo-items.js"
    );
  }

  if (!liveData.includes("/rest/v1/")) {
    throw new Error("LIVE Items adapter does not use the Supabase Data API");
  }

  if (!liveData.includes("loadItems")) {
    throw new Error("LIVE Items adapter does not expose loadItems");
  }

  if (!itemRenderer.includes("StartWaveBdoData.loadItems")) {
    throw new Error("Items renderer does not use the LIVE data adapter");
  }

  if (
    itemsHtml.includes("bdo-items.json") ||
    liveData.includes("bdo-items.json") ||
    itemRenderer.includes("bdo-items.json")
  ) {
    throw new Error(
      "Static bdo-items.json must not be used by the Items route"
    );
  }

  const publicClientContents = `${itemsHtml}\n${liveData}\n${itemRenderer}`;

  for (const marker of forbiddenClientCredentialMarkers) {
    if (publicClientContents.includes(marker)) {
      throw new Error(
        `Forbidden privileged credential marker in public client: ${marker}`
      );
    }
  }
}

async function installArtifact() {
  await rm(previousRoot, { recursive: true, force: true });

  let previousMoved = false;

  try {
    try {
      await rename(outputRoot, previousRoot);
      previousMoved = true;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }

    await rename(temporaryRoot, outputRoot);

    if (previousMoved) {
      await rm(previousRoot, { recursive: true, force: true });
    }
  } catch (error) {
    try {
      await rm(outputRoot, { recursive: true, force: true });

      if (previousMoved) {
        await rename(previousRoot, outputRoot);
      }
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        "BDO artifact installation and restoration both failed"
      );
    }

    throw error;
  }
}

async function build() {
  assertOutputIsolation();

  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });

  try {
    for (const mapping of fileMappings) {
      await copyMappedFile(mapping);
    }

    for (const mapping of directoryMappings) {
      await copyMappedDirectory(mapping.source, mapping.target);
    }

    await validateRequiredOutputs();
    await validateLocalReferences();
    await validateLiveItemsContract();
    await installArtifact();

    console.log(
      `Built ${claimedTargets.size} mapped BDO files in dist-bdo/`
    );
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

build().catch((error) => {
  console.error(`ERROR: ${error.message}`);
  process.exitCode = 1;
});
