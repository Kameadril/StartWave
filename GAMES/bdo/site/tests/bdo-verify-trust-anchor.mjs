import { parseArgs, parseInheritedFd, verifyTrustAnchor } from './bdo-publication-workflow-lib.mjs';

const args = parseArgs(process.argv.slice(2));
const result = await verifyTrustAnchor({ publicationRoot: args.publication, manifestPath: args.manifest, anchorFd: parseInheritedFd(args['anchor-fd']) });
console.log(JSON.stringify({ ...result, trust: 'MANIFEST_MATCHES_RECORDED_ANCHOR' }, null, 2));
