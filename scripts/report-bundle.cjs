const { gzipSync } = require('node:zlib');
const { readFile, readdir, writeFile } = require('node:fs/promises');
const { relative, resolve, sep } = require('node:path');

const root = resolve(__dirname, '..');
const output = resolve(root, '.local/e2e');
const webRoot = resolve(output, 'web');
const statsPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(output, 'webpack-stats.json');

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = resolve(directory, entry.name);
        return entry.isDirectory() ? filesUnder(path) : path;
      }),
    )
  ).flat();
}

async function measuredAsset(name) {
  const content = await readFile(resolve(webRoot, name));
  return { name, bytes: content.length, gzipBytes: gzipSync(content).length };
}

function moduleList(modules) {
  return modules.flatMap((module) => [module, ...moduleList(module.modules || [])]);
}

function packageLockKey(condition) {
  if (!condition) return null;
  const normalized = condition.replaceAll('\\', '/');
  const marker = '/node_modules/';
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = normalized.slice(index + marker.length).split('/');
  const packageName = tail[0].startsWith('@') ? tail.slice(0, 2).join('/') : tail[0];
  const packageDirectory = normalized.slice(0, index + marker.length) + packageName;
  const key = relative(root, packageDirectory.split('/').join(sep)).replaceAll('\\', '/');
  return { key, packageName };
}

async function main() {
  const [stats, lock, webPackage, sourceFiles] = await Promise.all([
    readFile(statsPath, 'utf8').then(JSON.parse),
    readFile(resolve(root, 'package-lock.json'), 'utf8').then(JSON.parse),
    readFile(resolve(root, 'apps/web/package.json'), 'utf8').then(JSON.parse),
    filesUnder(resolve(root, 'apps/web/src')),
  ]);
  if (stats.errorsCount || stats.warningsCount) {
    throw new Error(
      `Webpack reported ${stats.errorsCount} errors and ${stats.warningsCount} warnings`,
    );
  }

  const entryNames = stats.entrypoints.main.assets
    .map((asset) => asset.name)
    .filter((name) => name.endsWith('.js'));
  const entryAssets = await Promise.all(entryNames.map(measuredAsset));
  const lazyNames = [
    ...new Set(
      stats.chunks
        .filter((chunk) => !chunk.initial)
        .flatMap((chunk) => chunk.files)
        .filter((name) => name.endsWith('.js')),
    ),
  ];
  const lazyAssets = await Promise.all(
    lazyNames.map(async (name) => {
      const chunks = stats.chunks.filter((chunk) => chunk.files.includes(name));
      return {
        ...(await measuredAsset(name)),
        importers: [
          ...new Set(
            chunks
              .flatMap((chunk) => chunk.origins || [])
              .map((origin) => origin.request)
              .filter(Boolean),
          ),
        ].sort(),
      };
    }),
  );
  lazyAssets.sort((left, right) => right.bytes - left.bytes);

  const source = (
    await Promise.all(
      sourceFiles
        .filter((path) => /\.(?:css|ts|tsx)$/.test(path))
        .map((path) => readFile(path, 'utf8')),
    )
  ).join('\n');
  const directDependencies = Object.keys(webPackage.dependencies);
  const unusedDirectDependencies = directDependencies.filter(
    (name) => !source.includes(`'${name}`) && !source.includes(`"${name}`),
  );

  const bundledVersions = new Map();
  for (const module of moduleList(stats.modules || [])) {
    const resolved = packageLockKey(module.nameForCondition || module.identifier);
    if (!resolved) continue;
    const version = lock.packages[resolved.key]?.version;
    if (!version) continue;
    const versions = bundledVersions.get(resolved.packageName) || new Set();
    versions.add(version);
    bundledVersions.set(resolved.packageName, versions);
  }
  const bundledDuplicateVersions = [...bundledVersions]
    .filter(([, versions]) => versions.size > 1)
    .map(([name, versions]) => ({ name, versions: [...versions].sort() }))
    .sort((left, right) => left.name.localeCompare(right.name));

  const entryBytes = entryAssets.reduce((sum, asset) => sum + asset.bytes, 0);
  const entryGzipBytes = entryAssets.reduce((sum, asset) => sum + asset.gzipBytes, 0);
  const report = {
    webpackBuildMs: stats.time,
    initialJavaScript: {
      assets: entryAssets,
      bytes: entryBytes,
      gzipBytes: entryGzipBytes,
      budgetBytes: 425 * 1024,
      withinBudget: entryBytes <= 425 * 1024,
    },
    lazyJavaScript: {
      assetCount: lazyAssets.length,
      largestAssetBytes: lazyAssets[0]?.bytes || 0,
      assets: lazyAssets,
    },
    dependencies: {
      directRuntimeCount: directDependencies.length,
      unusedDirectDependencies,
      bundledDuplicateVersions,
      chartLibrary: directDependencies.some((name) => /chart|d3|recharts|visx/i.test(name))
        ? 'present'
        : 'none',
    },
  };
  if (!report.initialJavaScript.withinBudget) throw new Error('Initial JavaScript exceeds budget');
  if (unusedDirectDependencies.length) {
    throw new Error(`Unused direct web dependencies: ${unusedDirectDependencies.join(', ')}`);
  }
  await writeFile(resolve(output, 'bundle-report.json'), JSON.stringify(report, null, 2));
  process.stdout.write(
    JSON.stringify({
      initialBytes: entryBytes,
      initialGzipBytes: entryGzipBytes,
      lazyAssets: lazyAssets.length,
      largestLazyBytes: lazyAssets[0]?.bytes || 0,
      unusedDirectDependencies,
      bundledDuplicateVersions,
    }) + '\n',
  );
}

main().catch((error) => {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
});
