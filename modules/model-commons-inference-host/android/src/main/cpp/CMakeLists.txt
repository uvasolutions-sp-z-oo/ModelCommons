cmake_minimum_required(VERSION 3.22)
project(modelcommons_host LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
if(NOT ANDROID_ABI STREQUAL "arm64-v8a")
  message(FATAL_ERROR "The first ModelCommons host supports arm64-v8a only")
endif()
set(SRC "${LLAMA_PACKAGE}/cpp")
# This file enumerates and verifies every pinned source/header; glob additions cannot slip in.
include("${CMAKE_CURRENT_SOURCE_DIR}/../../../../source-files.cmake")
file(GLOB CORE "${SRC}/llama*.cpp" "${SRC}/models/*.cpp")
file(GLOB CPU "${SRC}/ggml-cpu/*.c" "${SRC}/ggml-cpu/*.cpp" "${SRC}/ggml-cpu/amx/*.cpp")
add_library(modelcommons_host SHARED worker.cpp ${CORE} ${CPU}
  "${SRC}/ggml.c" "${SRC}/ggml-alloc.c" "${SRC}/ggml-backend.cpp"
  "${SRC}/ggml-backend-dl.cpp" "${SRC}/ggml-backend-meta.cpp" "${SRC}/ggml-backend-reg.cpp"
  "${SRC}/ggml-opt.cpp" "${SRC}/ggml-threading.cpp" "${SRC}/ggml-quants.c"
  "${SRC}/gguf.cpp" "${SRC}/unicode.cpp" "${SRC}/unicode-data.cpp"
  "${SRC}/ggml-cpu/arch/arm/quants.c" "${SRC}/ggml-cpu/arch/arm/repack.cpp")
target_include_directories(modelcommons_host PRIVATE "${SRC}" "${SRC}/ggml-cpu")
target_compile_definitions(modelcommons_host PRIVATE LM_GGML_USE_CPU LM_GGML_USE_CPU_REPACK _GNU_SOURCE)
target_compile_options(modelcommons_host PRIVATE -fvisibility=hidden -fvisibility-inlines-hidden -pthread)
target_link_options(modelcommons_host PRIVATE "-Wl,--version-script=${CMAKE_CURRENT_SOURCE_DIR}/exports.map" -Wl,-Bsymbolic -Wl,--no-undefined)
target_link_libraries(modelcommons_host PRIVATE log android)
