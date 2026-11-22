import { parseArgs, recordTrustAnchor } from './bdo-publication-workflow-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const result = await recordTrustAnchor({ publicationRoot: args.publication, manifestPath: args.manifest, expectedSha256: args['expected-sha256'], outputPath: args.output });
console.log(JSON.stringify({ ...result, trust: 'RECORDED_FROM_INDEPENDENT_EXPECTED_DIGEST' }, null, 2));
