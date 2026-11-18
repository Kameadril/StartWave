import { parseArgs, preparePublication } from './bdo-publication-workflow-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const result = await preparePublication({ sourceRoot: args.source, outputRoot: args.output });
console.log(JSON.stringify({ ...result, trust: 'UNTRUSTED_CANDIDATE_REQUIRES_INDEPENDENT_ANCHOR' }, null, 2));
