const fs = require('node:fs');
const path = require('node:path');

const PATCH_ID = 'modelcommons-android-fd-v2';
const NATIVE_HANDSHAKE_VERSION = 1;

function replaceOnce(root, relative, before, after) {
  const file = path.join(root, relative);
  const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  if (source.includes(after)) return false;
  const first = source.indexOf(before);
  if (first < 0 || source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Cannot apply ${PATCH_ID}: unexpected llama.rn source at ${relative}.`);
  }
  fs.writeFileSync(file, source.slice(0, first) + after + source.slice(first + before.length), 'utf8');
  return true;
}

function applyLlamaRnAndroidFdPatch(dependencyRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dependencyRoot, 'package.json'), 'utf8'));
  if (manifest.version !== '0.12.9') {
    throw new Error(`${PATCH_ID} supports only the reviewed llama.rn 0.12.9 source.`);
  }
  let changed = false;
  changed = replaceOnce(dependencyRoot, 'src/types.ts',
`export type NativeContextParams = {
  model: string
`,
`export type NativeContextParams = {
  model: string
  /** ModelCommons Android source patch: one-shot read-only descriptor handoff. */
  model_fd?: number
  model_fd_device?: string
  model_fd_inode?: string
  model_fd_size?: string
`) || changed;
  changed = replaceOnce(dependencyRoot, 'src/index.ts',
`export async function initLlama(
`,
`/** Build-time capability checked before ModelCommons releases a descriptor to JSI. */
export const ModelCommonsDescriptorSupport = {
  version: 2,
  ownership: 'runtime-validates-and-duplicates-descriptor',
} as const

export async function initLlama(
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.h',
`#include <fstream>
`,
`#include <fstream>
#include <memory>
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.h',
`struct common_params_model {
    std::string path        = ""; // model local path
`,
`struct common_params_model {
    std::string path        = ""; // model local path
    // A synchronous JSI duplicate protects the background init task from stale
    // descriptor-number reuse. Copies of common_params share this owner.
    int                  fd       = -1;
    std::shared_ptr<int> fd_owner = nullptr;
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/jsi/JSIParams.cpp',
`#include <stdexcept>
`,
`#include <stdexcept>

#if defined(__ANDROID__)
#include <climits>
#include <cstdint>
#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif
`) || changed;
  // INT_MAX is also referenced by the shared parser when compiling iOS.
  changed = replaceOnce(dependencyRoot, 'cpp/jsi/JSIParams.cpp',
`#include <stdexcept>
`,
`#include <climits>
#include <stdexcept>
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/jsi/JSIParams.cpp',
`        // Model path
        cparams.model.path = getPropertyAsString(runtime, params, "model");
        cparams.vocab_only = getPropertyAsBool(runtime, params, "vocab_only", false);
`,
`        // Model path or ModelCommons Android read-only descriptor.
        cparams.model.path = getPropertyAsString(runtime, params, "model");
        int borrowed_model_fd = -1;
        if (params.hasProperty(runtime, "model_fd")) {
            const auto descriptor_value = params.getProperty(runtime, "model_fd");
            if (!descriptor_value.isNumber()) {
                throw std::invalid_argument("model_fd must be an integer descriptor");
            }
            const double descriptor_number = descriptor_value.getNumber();
            if (!std::isfinite(descriptor_number) || descriptor_number < 0
                    || descriptor_number > INT_MAX || std::floor(descriptor_number) != descriptor_number) {
                throw std::invalid_argument("model_fd must be a non-negative integer descriptor");
            }
            borrowed_model_fd = static_cast<int>(descriptor_number);
        }
        if (borrowed_model_fd >= 0 && cparams.model.path != "modelcommons-native-descriptor") {
            throw std::invalid_argument("model_fd requires the ModelCommons descriptor sentinel");
        }
        if (borrowed_model_fd >= 0) {
#if defined(__ANDROID__)
            const std::string expected_device = getPropertyAsString(runtime, params, "model_fd_device");
            const std::string expected_inode = getPropertyAsString(runtime, params, "model_fd_inode");
            const std::string expected_size = getPropertyAsString(runtime, params, "model_fd_size");
            const auto canonical_decimal = [](const std::string & value) {
                if (value.empty() || value.size() > 20 || (value.size() > 1 && value.front() == '0')) return false;
                for (const char digit : value) if (digit < '0' || digit > '9') return false;
                return true;
            };
            if (!canonical_decimal(expected_device) || !canonical_decimal(expected_inode)
                    || !canonical_decimal(expected_size) || expected_size == "0") {
                throw std::invalid_argument("model_fd requires canonical native file identity");
            }

            // Duplicate before returning from the JSI host call. The numeric handoff
            // cannot then become stale while common initialization runs in its worker.
            const int owned_model_fd = fcntl(borrowed_model_fd, F_DUPFD_CLOEXEC, 0);
            if (owned_model_fd < 0) {
                throw std::runtime_error("ModelCommons descriptor duplication failed");
            }
            const int flags = fcntl(owned_model_fd, F_GETFL);
            struct stat descriptor_stat {};
            const bool valid = flags >= 0 && (flags & O_ACCMODE) == O_RDONLY
                    && fstat(owned_model_fd, &descriptor_stat) == 0
                    && S_ISREG(descriptor_stat.st_mode)
                    && descriptor_stat.st_size > 0
                    && lseek(owned_model_fd, 0, SEEK_SET) == 0
                    && std::to_string(static_cast<uint64_t>(descriptor_stat.st_dev)) == expected_device
                    && std::to_string(static_cast<uint64_t>(descriptor_stat.st_ino)) == expected_inode
                    && std::to_string(static_cast<uint64_t>(descriptor_stat.st_size)) == expected_size;
            if (!valid) {
                close(owned_model_fd);
                throw std::invalid_argument("ModelCommons descriptor identity or file contract changed");
            }
            cparams.model.fd = owned_model_fd;
            cparams.model.fd_owner = std::shared_ptr<int>(
                new int(owned_model_fd),
                [](int * descriptor) {
                    if (descriptor != nullptr && *descriptor >= 0) close(*descriptor);
                    delete descriptor;
                });
#else
            throw std::invalid_argument("model_fd is supported only on Android");
#endif
        }
        cparams.vocab_only = getPropertyAsBool(runtime, params, "vocab_only", false);
`) || changed;
  changed = replaceOnce(dependencyRoot, 'android/src/main/CMakeLists.txt',
`option(RNLLAMA_BUILD_FROM_SOURCE "Build rnllama libraries from source" OFF)

if (RNLLAMA_BUILD_FROM_SOURCE)
`,
`option(RNLLAMA_BUILD_FROM_SOURCE "Build rnllama libraries from source" OFF)

if (NOT RNLLAMA_BUILD_FROM_SOURCE)
    message(FATAL_ERROR "${PATCH_ID} requires RNLLAMA_BUILD_FROM_SOURCE=ON so patched headers and common implementation have one ABI")
endif()

if (RNLLAMA_BUILD_FROM_SOURCE)
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.cpp',
`#else
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif
`,
`#else
#include <cerrno>
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <unistd.h>
#endif
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.cpp',
`    llama_model_ptr   model;
    llama_context_ptr context;
`,
`    // FILE* must outlive model mappings and is destroyed after the model.
    std::unique_ptr<FILE, decltype(&fclose)> model_file{nullptr, &fclose};
    llama_model_ptr   model;
    llama_context_ptr context;
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.cpp',
`    llama_model * model = llama_model_load_from_file(params.model.path.c_str(), mparams);
    if (model == NULL) {
        return;
    }
`,
`    llama_model * model = nullptr;
    if (params.model.fd >= 0) {
#if defined(__ANDROID__)
        const int flags = fcntl(params.model.fd, F_GETFL);
        struct stat descriptor_stat {};
        if (flags < 0 || (flags & O_ACCMODE) != O_RDONLY
                || fstat(params.model.fd, &descriptor_stat) != 0
                || !S_ISREG(descriptor_stat.st_mode)
                || descriptor_stat.st_size <= 0
                || lseek(params.model.fd, 0, SEEK_CUR) < 0) {
            COM_ERR("%s", "ModelCommons descriptor must be read-only, regular, non-empty, and seekable.\\n");
            return;
        }
        const int owned_fd = fcntl(params.model.fd, F_DUPFD_CLOEXEC, 0);
        if (owned_fd < 0) {
            COM_ERR("ModelCommons descriptor duplication failed: %s\\n", strerror(errno));
            return;
        }
        FILE * stream = fdopen(owned_fd, "rb");
        if (stream == nullptr) {
            close(owned_fd);
            COM_ERR("ModelCommons descriptor stream failed: %s\\n", strerror(errno));
            return;
        }
        pimpl->model_file.reset(stream);
        model = llama_model_load_from_file_ptr(stream, mparams);
#else
        COM_ERR("%s", "Descriptor-backed models are supported only on Android.\\n");
        return;
#endif
    } else {
        model = llama_model_load_from_file(params.model.path.c_str(), mparams);
    }
    if (model == NULL) {
        return;
    }
`) || changed;
  changed = replaceOnce(dependencyRoot, 'src/jsi.ts',
`declare global {
`,
`declare global {
  var llamaModelCommonsDescriptorSupport: (() => {
    version: number; nativeHandshakeVersion: number; buildId: string; ownership: string
  }) | undefined
`) || changed;
  changed = replaceOnce(dependencyRoot, 'src/index.ts',
`let jsiBindings: JsiBindings | null = null
`,
`let jsiBindings: JsiBindings | null = null
let modelCommonsNativeSupport: typeof globalThis.llamaModelCommonsDescriptorSupport
`) || changed;
  changed = replaceOnce(dependencyRoot, 'src/index.ts',
`  jsiBindings = bindings as JsiBindings
`,
`  modelCommonsNativeSupport = global.llamaModelCommonsDescriptorSupport
  delete global.llamaModelCommonsDescriptorSupport
  jsiBindings = bindings as JsiBindings
`) || changed;
  changed = replaceOnce(dependencyRoot, 'src/index.ts',
`export type TokenData = {
`,
`/** Queries the loaded JNI wrapper and its linked common core, before FD handoff. */
export async function getModelCommonsDescriptorSupport() {
  await installJsi()
  return typeof modelCommonsNativeSupport === 'function' ? modelCommonsNativeSupport() : undefined
}

export type TokenData = {
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/common/common.cpp',
`struct common_init_result::impl {
`,
`#if defined(__ANDROID__)
extern "C" __attribute__((visibility("default"))) size_t modelcommons_android_fd_v2_params_size() {
    return sizeof(common_params);
}
#endif

struct common_init_result::impl {
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/jsi/RNLlamaJSI.cpp',
`using namespace facebook;
`,
`#if defined(__ANDROID__)
extern "C" size_t modelcommons_android_fd_v2_params_size();
#endif

using namespace facebook;
`) || changed;
  changed = replaceOnce(dependencyRoot, 'cpp/jsi/RNLlamaJSI.cpp',
`        TaskManager::getInstance().reset();
`,
`        TaskManager::getInstance().reset();
#if defined(__ANDROID__)
        runtime.global().setProperty(runtime, "llamaModelCommonsDescriptorSupport",
            jsi::Function::createFromHostFunction(runtime,
                jsi::PropNameID::forAscii(runtime, "llamaModelCommonsDescriptorSupport"), 0,
                [](jsi::Runtime& rt, const jsi::Value&, const jsi::Value*, size_t) -> jsi::Value {
                    if (modelcommons_android_fd_v2_params_size() != sizeof(common_params)) {
                        throw std::runtime_error("ModelCommons native descriptor ABI mismatch");
                    }
                    jsi::Object support(rt);
                    support.setProperty(rt, "version", 2);
                    support.setProperty(rt, "nativeHandshakeVersion", ${NATIVE_HANDSHAKE_VERSION});
                    support.setProperty(rt, "buildId", jsi::String::createFromUtf8(rt, "${PATCH_ID}"));
                    support.setProperty(rt, "ownership", jsi::String::createFromUtf8(rt, "runtime-validates-and-duplicates-descriptor"));
                    return support;
                }));
#endif
`) || changed;
  const marker = path.join(dependencyRoot, '.modelcommons-android-fd-v2');
  fs.writeFileSync(marker, `${PATCH_ID}\n`, 'utf8');
  return { changed, patchId: PATCH_ID };
}

if (require.main === module) {
  const dependencyRoot = process.argv[2];
  if (!dependencyRoot) throw new Error('Pass the installed llama.rn package directory.');
  const result = applyLlamaRnAndroidFdPatch(path.resolve(dependencyRoot));
  process.stdout.write(`${result.patchId}: ${result.changed ? 'applied' : 'already present'}\n`);
}

module.exports = { PATCH_ID, NATIVE_HANDSHAKE_VERSION, applyLlamaRnAndroidFdPatch };
