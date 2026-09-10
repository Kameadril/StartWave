import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const defaultOutputRoot = path.join(repositoryRoot, "dist");
const outputArgumentIndex = process.argv.indexOf("--output");
const outputRelative = outputArgumentIndex === -1 ? "dist" : process.argv[outputArgumentIndex + 1];

if (!outputRelative || path.isAbsolute(outputRelative)) {
  throw new Error("--output must name a directory inside the repository");
}

const fileMappings = [
  ["apps/web/index.html", "index.html"],
  ["apps/web/profile.html", "profile.html"],
  ["apps/web/entertainment.html", "entertainment.html"],
  ["GAMES/site/games.html", "games.html"],
  ["GAMES/bdo/site/bdo.html", "bdo.html"],
  ["ai.html", "ai.html"],
  ["services.html", "services.html"]
];

const directoryMappings = [
  ["assets", "assets"],
  ["GAMES/bdo/site/pages", "pages"],
  ["GAMES/bdo/site/assets", "assets"]
];

const outputRoot = resolveInside(repositoryRoot, outputRelative);
const temporaryRoot = resolveInside(repositoryRoot, `${outputRelative}.tmp`);
const protectedPaths = [
  path.join(repositoryRoot, ".git"),
  defaultOutputRoot,
  ...fileMappings.map(([source]) => resolveInside(repositoryRoot, source)),
  ...directoryMappings.map(([source]) => resolveInside(repositoryRoot, source))
];

if (outputRoot === repositoryRoot) {
  throw new Error("--output overlaps protected repository data: .");
}

function pathsOverlap(left, right) {
  const relative = path.relative(left, right);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

for (const protectedPath of protectedPaths) {
  if (pathsOverlap(outputRoot, protectedPath) || pathsOverlap(protectedPath, outputRoot)) {
    throw new Error(
      `--output overlaps protected repository data: ${path.relative(repositoryRoot, protectedPath) || "."}`
    );
  }
}

const checkOutputOnly = process.argv.includes("--check-output");

const requiredOutputs = [
  "index.html",
  "profile.html",
  "entertainment.html",
  "games.html",
  "bdo.html",
  "ai.html",
  "services.html",
  "assets/css/style.css",
  "assets/js/script.js",
  "pages/bdo-nodes.html"
];

const claimedTargets = new Map();

function isExternalReference(reference) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference);
}

function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Path escapes its root: ${relativePath}`);
  }
  return resolved;
}

async function copyMappedFile(sourceRelative, targetRelative) {
  const source = resolveInside(repositoryRoot, sourceRelative);
  const target = resolveInside(temporaryRoot, targetRelative);
  const sourceInfo = await stat(source);

  if (!sourceInfo.isFile()) {
    throw new Error(`Mapped source is not a regular file: ${sourceRelative}`);
  }

  const previousSource = claimedTargets.get(targetRelative);
  if (previousSource) {
    throw new Error(
      `Target collision: ${targetRelative} is owned by both ${previousSource} and ${sourceRelative}`
    );
  }

  claimedTargets.set(targetRelative, sourceRelative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function copyMappedDirectory(sourceRelative, targetRelative) {
  const sourceDirectory = resolveInside(repositoryRoot, sourceRelative);
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
    } else if (entry.isFile()) {
      await copyMappedFile(sourceChild, targetChild);
    } else {
      throw new Error(`Unsupported source entry: ${sourceChild}`);
    }
  }
}

async function copyExistingOutput(sourceDirectory, targetDirectory) {
  let entries;
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
  for (const entry of entries) {
    const source = path.join(sourceDirectory, entry.name);
    const target = path.join(targetDirectory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symbol links are not preservable: ${source}`);
    if (entry.isDirectory()) {
      await mkdir(target, { recursive: true });
      await copyExistingOutput(source, target);
    } else if (entry.isFile()) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(source, target);
    } else {
      throw new Error(`Unsupported existing dist entry: ${source}`);
    }
  }
}

async function validateLocalReferences() {
  const referencePatterns = [
    /\b(?:href|src)=["']([^"']+)["']/gi,
    /\burl\(\s*["']?([^"')]+)["']?\s*\)/gi
  ];

  for (const targetRelative of claimedTargets.keys()) {
    if (!/\.(?:html|css)$/i.test(targetRelative)) continue;

    const targetFile = resolveInside(temporaryRoot, targetRelative);
    const contents = await readFile(targetFile, "utf8");

    for (const pattern of referencePatterns) {
      for (const match of contents.matchAll(pattern)) {
        const rawReference = match[1].trim();
        if (!rawReference || isExternalReference(rawReference)) continue;

        const reference = rawReference.split(/[?#]/, 1)[0];
        if (!reference) continue;

        const decodedReference = decodeURIComponent(reference);
        const resolvedReference = decodedReference.startsWith("/")
          ? decodedReference.slice(1)
          : path.posix.normalize(path.posix.join(path.posix.dirname(targetRelative), decodedReference));

        if (resolvedReference.startsWith("../")) {
          throw new Error(`Local reference escapes dist/: ${targetRelative} -> ${rawReference}`);
        }

        try {
          const info = await stat(resolveInside(temporaryRoot, resolvedReference));
          if (!info.isFile() && !info.isDirectory()) throw new Error("unsupported target");
        } catch {
          try {
            await stat(resolveInside(defaultOutputRoot, resolvedReference));
            throw new Error(`Broken local reference: ${targetRelative} -> ${rawReference}`);
          } catch (baselineError) {
            if (baselineError.message?.startsWith("Broken local reference:")) throw baselineError;
            console.warn(
              `WARNING: preserving pre-existing unresolved reference: ${targetRelative} -> ${rawReference}`
            );
          }
        }
      }
    }
  }
}

async function build() {
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(temporaryRoot, { recursive: true });

  try {
    // Preserve classified and still-unclassified publication-only files. In
    // particular, published BDO data is deliberately not regenerated from
    // canonical Atlas data by this builder.
    await copyExistingOutput(defaultOutputRoot, temporaryRoot);
    for (const [source, target] of fileMappings) {
      await copyMappedFile(source, target);
    }
    for (const [source, target] of directoryMappings) {
      await copyMappedDirectory(source, target);
    }
    for (const requiredOutput of requiredOutputs) {
      const info = await stat(resolveInside(temporaryRoot, requiredOutput));
      if (!info.isFile()) {
        throw new Error(`Required output is not a regular file: ${requiredOutput}`);
      }
    }
    await validateLocalReferences();

    await rm(outputRoot, { recursive: true, force: true });
    await rename(temporaryRoot, outputRoot);
    console.log(`Built ${claimedTargets.size} mapped public files in ${outputRelative}/`);
  } catch (error) {
    await rm(temporaryRoot, { recursive: true, force: true });
    throw error;
  }
}

if (checkOutputOnly) {
  console.log(`Safe publication output: ${outputRelative}/`);
} else {
  build().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}
