#include <jni.h>
#include "llama.h"
#include <atomic>
#include <cstdio>
#include <memory>
#include <mutex>
#include <new>
#include <stdexcept>
#include <string>
#include <vector>
#include <unistd.h>

namespace {
struct Control { std::atomic<bool> cancelled{false}; };
bool aborted(void * p) { return static_cast<Control *>(p)->cancelled.load(); }
void check(Control * p) { if (aborted(p)) throw std::runtime_error("USER_CANCELLED"); }
void quiet(lm_ggml_log_level, const char *, void *) {} // No model metadata or prompt in logcat.
std::string bytes(JNIEnv * env, jbyteArray a) {
  const auto n = env->GetArrayLength(a);
  std::string s(n, '\0');
  env->GetByteArrayRegion(a, 0, n, reinterpret_cast<jbyte *>(s.data()));
  return s;
}
}

extern "C" JNIEXPORT jlong JNICALL Java_org_modelcommons_host_NativeWorker_create(JNIEnv * env, jobject) {
  auto * control = new (std::nothrow) Control();
  if (!control) env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), "INSUFFICIENT_MEMORY");
  return reinterpret_cast<jlong>(control);
}
extern "C" JNIEXPORT void JNICALL Java_org_modelcommons_host_NativeWorker_cancel(JNIEnv *, jobject, jlong p) {
  reinterpret_cast<Control *>(p)->cancelled.store(true);
}
extern "C" JNIEXPORT void JNICALL Java_org_modelcommons_host_NativeWorker_destroy(JNIEnv *, jobject, jlong p) {
  delete reinterpret_cast<Control *>(p);
}
extern "C" JNIEXPORT jintArray JNICALL Java_org_modelcommons_host_NativeWorker_run(
    JNIEnv * env, jobject, jlong handle, jint fd, jobjectArray roles, jobjectArray texts,
    jint outputLimit, jfloat temperature, jfloat topP, jobject sink) {
  try {
    auto * control = reinterpret_cast<Control *>(handle);
    check(control);
    static std::once_flag initialized;
    std::call_once(initialized, [] { llama_log_set(quiet, nullptr); lm_ggml_log_set(quiet, nullptr); llama_backend_init(); });
    // Duplicate the verified descriptor, never reopen a caller-controlled path.
    const int copied = dup(fd);
    if (copied < 0) throw std::runtime_error("STORAGE_UNAVAILABLE");
    FILE * raw = fdopen(copied, "rb");
    if (!raw) { close(copied); throw std::runtime_error("STORAGE_UNAVAILABLE"); }
    std::unique_ptr<FILE, decltype(&fclose)> file(raw, fclose);
    rewind(file.get());
    auto mp = llama_model_default_params();
    mp.n_gpu_layers = 0;
    mp.use_mmap = true;
    mp.progress_callback = [](float, void * p) { return !aborted(p); };
    mp.progress_callback_user_data = control;
    std::unique_ptr<llama_model, decltype(&llama_model_free)> model(
      llama_model_load_from_file_ptr(file.get(), mp), llama_model_free);
    check(control);
    if (!model) throw std::runtime_error("RUNTIME_INITIALIZATION_FAILED");
    const char * tmpl = llama_model_chat_template(model.get(), nullptr);
    if (!tmpl) throw std::runtime_error("FEATURE_UNSUPPORTED");
    std::vector<std::string> roleStrings, textStrings;
    const int count = env->GetArrayLength(texts);
    if (count < 1 || count > 64 || env->GetArrayLength(roles) != count || outputLimit < 1 || outputLimit > 128)
      throw std::runtime_error("INVALID_REQUEST");
    for (int i = 0; i < count; ++i) {
      auto r = static_cast<jbyteArray>(env->GetObjectArrayElement(roles, i));
      auto t = static_cast<jbyteArray>(env->GetObjectArrayElement(texts, i));
      roleStrings.push_back(bytes(env, r)); textStrings.push_back(bytes(env, t));
      env->DeleteLocalRef(r); env->DeleteLocalRef(t);
    }
    std::vector<llama_chat_message> messages;
    for (int i = 0; i < count; ++i) messages.push_back({roleStrings[i].c_str(), textStrings[i].c_str()});
    int needed = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, nullptr, 0);
    if (needed <= 0 || needed > 64 * 1024) throw std::runtime_error("FEATURE_UNSUPPORTED");
    std::vector<char> prompt(needed + 1);
    int written = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, prompt.data(), prompt.size());
    if (written != needed) throw std::runtime_error("FEATURE_UNSUPPORTED");
    auto * vocab = llama_model_get_vocab(model.get());
    std::vector<llama_token> tokens(1024);
    int input = llama_tokenize(vocab, prompt.data(), needed, tokens.data(), tokens.size(), true, true);
    if (input <= 0 || input + outputLimit > 1024) throw std::runtime_error("CONTEXT_LIMIT_EXCEEDED");
    auto cp = llama_context_default_params();
    cp.n_ctx = 1024; cp.n_batch = 1024; cp.n_ubatch = 128;
    cp.n_threads = 2; cp.n_threads_batch = 2;
    cp.abort_callback = aborted; cp.abort_callback_data = control;
    std::unique_ptr<llama_context, decltype(&llama_free)> ctx(llama_init_from_model(model.get(), cp), llama_free);
    if (!ctx) throw std::runtime_error("INSUFFICIENT_MEMORY");
    check(control);
    if (llama_decode(ctx.get(), llama_batch_get_one(tokens.data(), input)) != 0) {
      check(control); throw std::runtime_error("RUNTIME_ERROR");
    }
    std::unique_ptr<llama_sampler, decltype(&llama_sampler_free)> sampler(
      llama_sampler_chain_init(llama_sampler_chain_default_params()), llama_sampler_free);
    if (temperature == 0) llama_sampler_chain_add(sampler.get(), llama_sampler_init_greedy());
    else {
      llama_sampler_chain_add(sampler.get(), llama_sampler_init_top_p(topP, 1));
      llama_sampler_chain_add(sampler.get(), llama_sampler_init_temp(temperature));
      llama_sampler_chain_add(sampler.get(), llama_sampler_init_dist(LLAMA_DEFAULT_SEED));
    }
    const auto sinkClass = env->GetObjectClass(sink);
    const auto emit = env->GetMethodID(sinkClass, "emit", "([B)V");
    env->DeleteLocalRef(sinkClass);
    int output = 0, stopped = 0;
    for (; output < outputLimit; ) {
      check(control);
      auto token = llama_sampler_sample(sampler.get(), ctx.get(), -1);
      // llama_sampler_sample already accepts the chosen token into its chain.
      ++output;
      if (llama_vocab_is_eog(vocab, token)) { stopped = 1; break; }
      std::vector<char> piece(256);
      int n = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false);
      if (n < 0 && n > -4096) {
        piece.resize(-n);
        n = llama_token_to_piece(vocab, token, piece.data(), piece.size(), 0, false);
      }
      if (n < 0 || n > 4096) throw std::runtime_error("RUNTIME_ERROR");
      if (n) {
        auto data = env->NewByteArray(n);
        env->SetByteArrayRegion(data, 0, n, reinterpret_cast<jbyte *>(piece.data()));
        env->CallVoidMethod(sink, emit, data);
        env->DeleteLocalRef(data);
        if (env->ExceptionCheck()) return nullptr; // RAII still frees context before lease release.
      }
      if (output < outputLimit && llama_decode(ctx.get(), llama_batch_get_one(&token, 1)) != 0) {
        check(control); throw std::runtime_error("RUNTIME_ERROR");
      }
    }
    check(control);
    jint values[] = {input, output, stopped};
    auto result = env->NewIntArray(3);
    env->SetIntArrayRegion(result, 0, 3, values);
    return result;
  } catch (const std::bad_alloc &) {
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), "INSUFFICIENT_MEMORY");
  } catch (const std::exception & e) {
    // Only fixed codes originate here. Never expose parser diagnostics or paths.
    const std::string code = e.what();
    const char * safe = code == "USER_CANCELLED" || code == "STORAGE_UNAVAILABLE" ||
      code == "RUNTIME_INITIALIZATION_FAILED" || code == "FEATURE_UNSUPPORTED" ||
      code == "CONTEXT_LIMIT_EXCEEDED" || code == "INVALID_REQUEST" || code == "INSUFFICIENT_MEMORY"
      ? code.c_str() : "RUNTIME_ERROR";
    env->ThrowNew(env->FindClass("java/lang/IllegalStateException"), safe);
  }
  return nullptr;
}
