#import <Foundation/Foundation.h>
#import <Security/Security.h>
#import <CommonCrypto/CommonDigest.h>
#include <sys/attr.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/acl.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>

static const size_t kFileLimit = 1024 * 1024;
static const size_t kTotalLimit = 4 * 1024 * 1024;
static const size_t kMetadataLimit = 256 * 1024;
static const size_t kChunk = 64 * 1024;
static NSString *const kFiles[] = {
  @"assets/js/bdo-live-data.js", @"assets/js/bdo-recipes.js", @"assets/js/bdo-items.js",
  @"assets/js/bdo-live-productions.js", @"assets/data/bdo-productions.json",
  @"assets/data/bdo-items.json", @"assets/data/bdo-recipes.json",
  @"production.html", @"recipes.html", @"items.html"
};
static const NSUInteger kFileCount = sizeof(kFiles) / sizeof(kFiles[0]);

static void Fail(NSString *message) {
  @throw [NSException exceptionWithName:@"BDOMaterializerBlocked" reason:message userInfo:nil];
}
static void Check(BOOL condition, NSString *message) { if (!condition) Fail(message); }
static void SysCheck(int value, NSString *label) {
  if (value < 0) Fail([NSString stringWithFormat:@"%@: %s", label, strerror(errno)]);
}
static void CloseChecked(int fd, NSString *label) {
  if (fd >= 0 && close(fd) != 0) Fail([NSString stringWithFormat:@"close %@: %s", label, strerror(errno)]);
}

static NSDictionary<NSString *, NSString *> *ParseArgs(int argc, const char **argv, NSString **operation) {
  Check(argc >= 2, @"missing operation");
  *operation = [NSString stringWithUTF8String:argv[1]];
  NSMutableDictionary *result = [NSMutableDictionary dictionary];
  for (int i = 2; i < argc; i += 2) {
    Check(i + 1 < argc, @"arguments must be --name value pairs");
    NSString *key = [NSString stringWithUTF8String:argv[i]];
    Check([key hasPrefix:@"--"] && key.length > 2, @"invalid argument name");
    key = [key substringFromIndex:2];
    Check(result[key] == nil, [NSString stringWithFormat:@"duplicate argument: --%@", key]);
    result[key] = [NSString stringWithUTF8String:argv[i + 1]];
  }
  return result;
}
static void RequireKeys(NSDictionary *args, NSSet *required) {
  Check([NSSet setWithArray:args.allKeys].count == args.count, @"duplicate arguments");
  Check([[NSSet setWithArray:args.allKeys] isEqualToSet:required], @"missing or unknown arguments");
}
static int ParseFd(NSString *value) {
  Check(value.length > 0, @"empty fd");
  NSCharacterSet *bad = [[NSCharacterSet decimalDigitCharacterSet] invertedSet];
  Check([value rangeOfCharacterFromSet:bad].location == NSNotFound, @"fd must be decimal");
  unsigned long long parsed = strtoull(value.UTF8String, NULL, 10);
  Check(parsed >= 3 && parsed <= INT_MAX, @"fd must be inherited and >= 3");
  return (int)parsed;
}
static void ValidateLeaf(NSString *leaf) {
  Check(leaf.length > 0 && ![leaf isEqual:@"."] && ![leaf isEqual:@".."], @"invalid leaf");
  Check([leaf rangeOfString:@"/"].location == NSNotFound, @"leaf must be one component");
  Check([leaf rangeOfCharacterFromSet:[NSCharacterSet controlCharacterSet]].location == NSNotFound, @"leaf contains control characters");
  Check([leaf lengthOfBytesUsingEncoding:NSUTF8StringEncoding] <= NAME_MAX, @"leaf exceeds NAME_MAX");
}
static void ValidateIdentity(NSString *value, NSString *label) {
  Check([value hasPrefix:@"/"], [NSString stringWithFormat:@"%@ must be absolute identity metadata", label]);
  Check([value rangeOfCharacterFromSet:[NSCharacterSet controlCharacterSet]].location == NSNotFound, @"identity contains control characters");
}
static void ValidateNoExtendedAclFd(int fd, NSString *label) {
  errno = 0;
  acl_t acl = acl_get_fd_np(fd, ACL_TYPE_EXTENDED);
  if (acl == NULL) {
    Check(errno == ENOENT, [label stringByAppendingString:@" ACL policy could not be verified"]);
    return;
  }
  errno = 0;
  acl_entry_t entry = NULL;
  int result = acl_get_entry(acl, ACL_FIRST_ENTRY, &entry);
  int entryError = errno;
  int freeResult = acl_free(acl);
  Check(freeResult == 0, [label stringByAppendingString:@" ACL state could not be released"]);
  if (result == 0) Fail([label stringByAppendingString:@" must not carry an extended ACL"]);
  Check(result == -1, [label stringByAppendingString:@" ACL enumeration returned an unexpected result"]);
  Fail([NSString stringWithFormat:@"%@ ACL policy could not be verified: %s", label, strerror(entryError)]);
}
static void ValidateDirFd(int fd, BOOL requireReadOnly, NSString *label) {
  struct stat st; SysCheck(fstat(fd, &st), [label stringByAppendingString:@" fstat"]);
  Check(S_ISDIR(st.st_mode), [label stringByAppendingString:@" must be a directory"]);
  int flags = fcntl(fd, F_GETFL); SysCheck(flags, [label stringByAppendingString:@" fcntl"]);
  if (requireReadOnly) Check((flags & O_ACCMODE) == O_RDONLY, [label stringByAppendingString:@" must be O_RDONLY"]);
  Check(st.st_uid == geteuid(), [label stringByAppendingString:@" must be owned by effective owner"]);
  Check((st.st_mode & (S_IWGRP | S_IWOTH)) == 0, [label stringByAppendingString:@" must not be group/world writable"]);
  ValidateNoExtendedAclFd(fd, label);
}
static void ValidateOnlyFds(NSSet<NSNumber *> *expected) {
  int limit = getdtablesize();
  for (int fd = 3; fd < limit; fd++) {
    errno = 0; int flags = fcntl(fd, F_GETFD);
    if (flags >= 0) Check([expected containsObject:@(fd)], @"unexpected inherited descriptor");
    else Check(errno == EBADF, @"descriptor inventory failed");
  }
}
static NSString *Hex(NSData *data) {
  const uint8_t *p = data.bytes; NSMutableString *s = [NSMutableString stringWithCapacity:data.length * 2];
  for (NSUInteger i = 0; i < data.length; i++) [s appendFormat:@"%02x", p[i]];
  return s;
}
static NSString *Hash(NSData *bytes) {
  uint8_t digest[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256(bytes.bytes, (CC_LONG)bytes.length, digest);
  return Hex([NSData dataWithBytes:digest length:sizeof(digest)]);
}
static BOOL SameStat(struct stat a, struct stat b) {
  return a.st_dev == b.st_dev && a.st_ino == b.st_ino && a.st_size == b.st_size &&
    a.st_mtimespec.tv_sec == b.st_mtimespec.tv_sec && a.st_mtimespec.tv_nsec == b.st_mtimespec.tv_nsec &&
    a.st_ctimespec.tv_sec == b.st_ctimespec.tv_sec && a.st_ctimespec.tv_nsec == b.st_ctimespec.tv_nsec;
}
static NSData *ReadBoundedFd(int fd, size_t limit, NSString *label) {
  struct stat before, after; SysCheck(fstat(fd, &before), [label stringByAppendingString:@" fstat"]);
  Check(S_ISREG(before.st_mode), [label stringByAppendingString:@" must be regular"]);
  Check(before.st_size >= 0 && (uint64_t)before.st_size <= limit, [label stringByAppendingString:@" exceeds byte limit"]);
  NSMutableData *data = [NSMutableData dataWithLength:(NSUInteger)before.st_size];
  size_t offset = 0;
  while (offset < data.length) {
    size_t want = MIN(kChunk, data.length - offset);
    ssize_t got = pread(fd, (uint8_t *)data.mutableBytes + offset, want, (off_t)offset);
    if (got < 0) Fail([NSString stringWithFormat:@"read %@: %s", label, strerror(errno)]);
    Check(got > 0, [label stringByAppendingString:@" shrank while reading"]); offset += (size_t)got;
  }
  uint8_t extra; ssize_t overflow = pread(fd, &extra, 1, (off_t)offset);
  if (overflow < 0) Fail([NSString stringWithFormat:@"read EOF %@: %s", label, strerror(errno)]);
  Check(overflow == 0, [label stringByAppendingString:@" grew while reading"]);
  SysCheck(fstat(fd, &after), [label stringByAppendingString:@" final fstat"]);
  Check(SameStat(before, after), [label stringByAppendingString:@" changed while reading"]);
  return data;
}
static int OpenDirComponent(int parent, NSString *component, NSString *label) {
  int fd = openat(parent, component.fileSystemRepresentation, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  SysCheck(fd, label); ValidateNoExtendedAclFd(fd, label); return fd;
}
static int OpenRelativeFile(int root, NSString *relative, NSString *label) {
  NSArray *parts = [relative componentsSeparatedByString:@"/"]; int current = dup(root); SysCheck(current, @"dup root");
  for (NSUInteger i = 0; i + 1 < parts.count; i++) {
    int next = OpenDirComponent(current, parts[i], label); CloseChecked(current, @"source directory"); current = next;
  }
  int fd = openat(current, [parts.lastObject fileSystemRepresentation], O_RDONLY | O_NOFOLLOW | O_CLOEXEC);
  int saved = errno; CloseChecked(current, @"source parent"); errno = saved; SysCheck(fd, label); return fd;
}
static void CompleteWrite(int fd, NSData *bytes, NSString *label) {
  size_t offset = 0;
  while (offset < bytes.length) {
    ssize_t wrote = write(fd, (const uint8_t *)bytes.bytes + offset, MIN(kChunk, bytes.length - offset));
    if (wrote < 0) Fail([NSString stringWithFormat:@"write %@: %s", label, strerror(errno)]);
    Check(wrote > 0, [label stringByAppendingString:@" short write"]); offset += (size_t)wrote;
  }
}
static int EnsureDir(int parent, NSString *name) {
  if (mkdirat(parent, name.fileSystemRepresentation, 0700) != 0 && errno != EEXIST)
    Fail([NSString stringWithFormat:@"mkdir %@: %s", name, strerror(errno)]);
  return OpenDirComponent(parent, name, [@"open directory " stringByAppendingString:name]);
}
static int DestinationParent(int stage, NSString *relative) {
  NSArray *parts = [relative componentsSeparatedByString:@"/"]; int current = dup(stage); SysCheck(current, @"dup stage");
  for (NSUInteger i = 0; i + 1 < parts.count; i++) { int next = EnsureDir(current, parts[i]); CloseChecked(current, @"destination dir"); current = next; }
  return current;
}
static NSString *Nonce(void) {
  uint8_t bytes[16]; Check(SecRandomCopyBytes(kSecRandomDefault, sizeof(bytes), bytes) == errSecSuccess, @"system RNG failed");
  return [@".bdo-materializer-" stringByAppendingString:Hex([NSData dataWithBytes:bytes length:sizeof(bytes)])];
}
static NSData *CanonicalJSON(id object) {
  NSError *error = nil; NSData *data = [NSJSONSerialization dataWithJSONObject:object options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys error:&error];
  Check(data != nil, [NSString stringWithFormat:@"JSON serialization: %@", error]);
  NSMutableData *line = [data mutableCopy]; uint8_t nl = '\n'; [line appendBytes:&nl length:1];
  Check(line.length <= kMetadataLimit, @"metadata exceeds 256 KiB"); return line;
}
static void ValidateProductions(NSData *bytes) {
  NSError *error = nil; id json = [NSJSONSerialization JSONObjectWithData:bytes options:0 error:&error];
  Check([json isKindOfClass:NSDictionary.class], @"productions JSON must be an object");
  id records = json[@"productions"]; Check([records isKindOfClass:NSArray.class] && [records count] == 13, @"productions must contain exactly 13 records");
}
static void WriteNewFile(int parent, NSString *leaf, NSData *bytes, mode_t finalMode) {
  int fd = openat(parent, leaf.fileSystemRepresentation, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC, 0600);
  SysCheck(fd, [@"create " stringByAppendingString:leaf]); CompleteWrite(fd, bytes, leaf); SysCheck(fsync(fd), [@"fsync " stringByAppendingString:leaf]);
  SysCheck(fchmod(fd, finalMode), [@"chmod " stringByAppendingString:leaf]); CloseChecked(fd, leaf);
  int checkFd = openat(parent, leaf.fileSystemRepresentation, O_RDONLY | O_NOFOLLOW | O_CLOEXEC); SysCheck(checkFd, @"reopen written file");
  ValidateNoExtendedAclFd(checkFd, @"written file");
  NSData *again = ReadBoundedFd(checkFd, MAX(kFileLimit, kMetadataLimit), @"written file"); CloseChecked(checkFd, @"written file");
  Check([again isEqualToData:bytes], @"reopened bytes mismatch");
}
static void ChmodTreeReadOnly(int stage) {
  const char *dirs[] = {"assets/js", "assets/data", "assets"};
  for (size_t i = 0; i < 3; i++) {
    NSString *path = [NSString stringWithUTF8String:dirs[i]]; NSArray *parts = [path componentsSeparatedByString:@"/"];
    int current = dup(stage); SysCheck(current, @"dup chmod root");
    for (NSString *part in parts) { int next = OpenDirComponent(current, part, @"open chmod dir"); CloseChecked(current, @"chmod parent"); current = next; }
    SysCheck(fchmod(current, 0555), @"chmod destination directory"); SysCheck(fsync(current), @"fsync destination directory"); CloseChecked(current, @"destination directory");
  }
  SysCheck(fchmod(stage, 0555), @"chmod stage"); SysCheck(fsync(stage), @"fsync stage");
}
static void CleanupStage(int parent, NSString *stageName) {
  int stage = openat(parent, stageName.fileSystemRepresentation, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (stage < 0) return;
  fchmod(stage, 0700);
  int assets = openat(stage, "assets", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  int js = assets >= 0 ? openat(assets, "js", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC) : -1;
  int data = assets >= 0 ? openat(assets, "data", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC) : -1;
  if (assets >= 0) fchmod(assets, 0700); if (js >= 0) fchmod(js, 0700); if (data >= 0) fchmod(data, 0700);
  for (NSUInteger i = 0; i < kFileCount; i++) {
    NSString *path = kFiles[i]; int p = [path hasPrefix:@"assets/js/"] ? js : ([path hasPrefix:@"assets/data/"] ? data : stage);
    if (p >= 0) unlinkat(p, path.lastPathComponent.fileSystemRepresentation, 0);
  }
  unlinkat(stage, "manifest.json", 0);
  if (js >= 0) close(js); if (data >= 0) close(data);
  if (assets >= 0) { unlinkat(assets, "js", AT_REMOVEDIR); unlinkat(assets, "data", AT_REMOVEDIR); close(assets); }
  unlinkat(stage, "assets", AT_REMOVEDIR); close(stage); unlinkat(parent, stageName.fileSystemRepresentation, AT_REMOVEDIR);
}
static NSDictionary *VerifyPublication(int parent, NSString *leaf, NSString *expected, NSData **manifestOut) {
  int publication = OpenDirComponent(parent, leaf, @"open publication");
  ValidateDirFd(publication, YES, @"publication");
  struct stat pst; SysCheck(fstat(publication, &pst), @"publication fstat");
  Check((pst.st_mode & 0222) == 0, @"publication must be read-only");
  int mf = openat(publication, "manifest.json", O_RDONLY | O_NOFOLLOW | O_CLOEXEC); SysCheck(mf, @"open manifest");
  ValidateNoExtendedAclFd(mf, @"manifest");
  NSData *manifest = ReadBoundedFd(mf, kMetadataLimit, @"manifest"); CloseChecked(mf, @"manifest");
  Check([Hash(manifest) isEqual:expected], @"independent expected manifest digest mismatch");
  NSError *error = nil; id json = [NSJSONSerialization JSONObjectWithData:manifest options:0 error:&error];
  Check([json isKindOfClass:NSDictionary.class] && [json[@"algorithm"] isEqual:@"sha256"] && [json[@"files"] isKindOfClass:NSDictionary.class], @"invalid manifest schema");
  NSDictionary *listed = json[@"files"]; Check(listed.count == kFileCount, @"manifest must list exact 10 files");
  NSMutableDictionary *hashes = [NSMutableDictionary dictionary]; size_t total = 0; NSData *productionBytes = nil;
  for (NSUInteger i = 0; i < kFileCount; i++) {
    NSString *path = kFiles[i]; Check([listed[path] isKindOfClass:NSString.class], @"missing required manifest file");
    int fd = OpenRelativeFile(publication, path, @"open publication file"); ValidateNoExtendedAclFd(fd, path); NSData *bytes = ReadBoundedFd(fd, kFileLimit, path); CloseChecked(fd, path);
    total += bytes.length; Check(total <= kTotalLimit, @"publication exceeds 4 MiB total"); NSString *digest = Hash(bytes);
    Check([listed[path] isEqual:digest], [@"manifest hash mismatch: " stringByAppendingString:path]); hashes[path] = digest;
    if ([path isEqual:@"assets/data/bdo-productions.json"]) productionBytes = bytes;
  }
  Check([[NSSet setWithArray:listed.allKeys] isEqualToSet:[NSSet setWithArray:[NSArray arrayWithObjects:kFiles count:kFileCount]]], @"manifest contains unexpected files");
  ValidateProductions(productionBytes); CloseChecked(publication, @"publication"); if (manifestOut) *manifestOut = manifest;
  return hashes;
}
static void Materialize(NSDictionary *args) {
  RequireKeys(args, [NSSet setWithArray:@[@"source-fd", @"publication-parent-fd", @"publication-leaf"]]);
  int source = ParseFd(args[@"source-fd"]), parent = ParseFd(args[@"publication-parent-fd"]); NSString *leaf = args[@"publication-leaf"]; ValidateLeaf(leaf);
  Check(source != parent, @"source and publication parent descriptors must differ"); ValidateOnlyFds([NSSet setWithArray:@[@(source), @(parent)]]);
  ValidateDirFd(source, YES, @"source fd"); ValidateDirFd(parent, YES, @"publication parent fd");
  struct stat exists; Check(fstatat(parent, leaf.fileSystemRepresentation, &exists, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT, @"publication target already exists");
  NSString *stageName = nil; int stage = -1;
  for (int attempt = 0; attempt < 16 && stage < 0; attempt++) { stageName = Nonce(); if (mkdirat(parent, stageName.fileSystemRepresentation, 0700) == 0) stage = OpenDirComponent(parent, stageName, @"open stage"); else Check(errno == EEXIST, @"cannot create staging directory"); }
  Check(stage >= 0, @"staging collision limit exceeded");
  NSMutableDictionary *hashes = [NSMutableDictionary dictionary]; NSMutableDictionary *sizes = [NSMutableDictionary dictionary]; size_t total = 0; BOOL committed = NO;
  @try {
    for (NSUInteger i = 0; i < kFileCount; i++) {
      NSString *path = kFiles[i]; int inFd = OpenRelativeFile(source, path, @"open source file"); NSData *bytes = ReadBoundedFd(inFd, kFileLimit, path); CloseChecked(inFd, path);
      total += bytes.length; Check(total <= kTotalLimit, @"source exceeds 4 MiB total"); if ([path isEqual:@"assets/data/bdo-productions.json"]) ValidateProductions(bytes);
      int destParent = DestinationParent(stage, path); WriteNewFile(destParent, path.lastPathComponent, bytes, 0444); CloseChecked(destParent, @"destination parent"); hashes[path] = Hash(bytes); sizes[path] = @(bytes.length);
    }
    NSData *manifest = CanonicalJSON(@{@"algorithm": @"sha256", @"files": hashes}); WriteNewFile(stage, @"manifest.json", manifest, 0444);
    ChmodTreeReadOnly(stage); CloseChecked(stage, @"stage"); stage = -1;
    Check(renameatx_np(parent, stageName.fileSystemRepresentation, parent, leaf.fileSystemRepresentation, RENAME_EXCL) == 0, @"exclusive publication commit failed"); committed = YES; SysCheck(fsync(parent), @"fsync publication parent");
    NSDictionary *receipt = @{@"schemaVersion": @1, @"publicationLeaf": leaf, @"manifestSha256": Hash(manifest), @"files": hashes, @"sizes": sizes, @"publicationCount": @13, @"totalBytes": @(total)};
    NSData *output = CanonicalJSON(receipt); fwrite(output.bytes, 1, output.length, stdout);
  } @finally { if (stage >= 0) close(stage); if (!committed) CleanupStage(parent, stageName); }
}
static void Seal(NSDictionary *args) {
  RequireKeys(args, [NSSet setWithArray:@[@"publication-parent-fd", @"publication-leaf", @"anchor-parent-fd", @"anchor-leaf", @"expected-manifest-sha256", @"identity-publication-root", @"identity-manifest-path"]]);
  int pubParent = ParseFd(args[@"publication-parent-fd"]), anchorParent = ParseFd(args[@"anchor-parent-fd"]); NSString *pubLeaf = args[@"publication-leaf"], *anchorLeaf = args[@"anchor-leaf"], *expected = args[@"expected-manifest-sha256"];
  Check(pubParent != anchorParent, @"publication and anchor parent descriptors must differ"); ValidateOnlyFds([NSSet setWithArray:@[@(pubParent), @(anchorParent)]]);
  ValidateLeaf(pubLeaf); ValidateLeaf(anchorLeaf); ValidateIdentity(args[@"identity-publication-root"], @"publication identity"); ValidateIdentity(args[@"identity-manifest-path"], @"manifest identity");
  Check(expected.length == 64 && [expected rangeOfCharacterFromSet:[[NSCharacterSet characterSetWithCharactersInString:@"0123456789abcdef"] invertedSet]].location == NSNotFound, @"expected digest must be lowercase SHA-256");
  ValidateDirFd(pubParent, YES, @"publication parent fd"); ValidateDirFd(anchorParent, YES, @"anchor parent fd");
  struct stat ast; Check(fstatat(anchorParent, anchorLeaf.fileSystemRepresentation, &ast, AT_SYMLINK_NOFOLLOW) != 0 && errno == ENOENT, @"anchor target already exists");
  NSData *manifest = nil; NSDictionary *hashes = VerifyPublication(pubParent, pubLeaf, expected, &manifest);
  NSDictionary *anchor = @{@"schemaVersion": @1, @"publicationRoot": args[@"identity-publication-root"], @"manifestPath": args[@"identity-manifest-path"], @"manifestSha256": expected, @"files": hashes}; NSData *bytes = CanonicalJSON(anchor);
  NSString *temp = Nonce(); WriteNewFile(anchorParent, temp, bytes, 0444);
  if (renameatx_np(anchorParent, temp.fileSystemRepresentation, anchorParent, anchorLeaf.fileSystemRepresentation, RENAME_EXCL) != 0) { int saved = errno; unlinkat(anchorParent, temp.fileSystemRepresentation, 0); errno = saved; Fail(@"exclusive anchor commit failed"); }
  SysCheck(fsync(anchorParent), @"fsync anchor parent");
  NSData *receipt = CanonicalJSON(@{@"schemaVersion": @1, @"anchorLeaf": anchorLeaf, @"manifestSha256": expected, @"anchorSha256": Hash(bytes), @"publicationCount": @13}); fwrite(receipt.bytes, 1, receipt.length, stdout);
}
int main(int argc, const char **argv) {
  @autoreleasepool {
    @try {
#ifndef __APPLE__
      Fail(@"unsupported platform: macOS is required");
#endif
      NSString *operation = nil; NSDictionary *args = ParseArgs(argc, argv, &operation);
      if ([operation isEqual:@"materialize"]) Materialize(args);
      else if ([operation isEqual:@"seal-anchor"]) Seal(args);
      else Fail(@"unknown operation");
    } @catch (NSException *exception) {
      fprintf(stderr, "BLOCKED: %s\n", exception.reason.UTF8String); return 1;
    }
  }
  return 0;
}
