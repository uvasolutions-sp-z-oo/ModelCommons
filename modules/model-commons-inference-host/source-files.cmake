# Generated from authorized reads of llama.rn 0.12.9; see source-pin.json.
# Four reviewed alternate hashes cover the Android FD v2 patch with native handshake 1.
# They do not relax the file inventory or the hashes of any other upstream source.
file(GLOB_RECURSE ACTUAL RELATIVE "${SRC}" "${SRC}/*")
set(EXPECTED
  "anyascii.c"
  "anyascii.h"
  "chat.cpp.patch"
  "common/build-info.cpp"
  "common/build-info.h"
  "common/chat-auto-parser-generator.cpp"
  "common/chat-auto-parser-helpers.cpp"
  "common/chat-auto-parser-helpers.h"
  "common/chat-auto-parser.h"
  "common/chat-diff-analyzer.cpp"
  "common/chat-peg-parser.cpp"
  "common/chat-peg-parser.h"
  "common/chat.cpp"
  "common/chat.h"
  "common/common.cpp"
  "common/common.h"
  "common/fit.cpp"
  "common/fit.h"
  "common/jinja/caps.cpp"
  "common/jinja/caps.h"
  "common/jinja/jinja-string.h"
  "common/jinja/lexer.cpp"
  "common/jinja/lexer.h"
  "common/jinja/parser.cpp"
  "common/jinja/parser.h"
  "common/jinja/README.md"
  "common/jinja/runtime.cpp"
  "common/jinja/runtime.h"
  "common/jinja/string.cpp"
  "common/jinja/utils.h"
  "common/jinja/value.cpp"
  "common/jinja/value.h"
  "common/json-schema-to-grammar.cpp"
  "common/json-schema-to-grammar.h"
  "common/log.cpp"
  "common/log.h"
  "common/ngram-cache.cpp"
  "common/ngram-cache.h"
  "common/ngram-map.cpp"
  "common/ngram-map.h"
  "common/ngram-mod.cpp"
  "common/ngram-mod.h"
  "common/peg-parser.cpp"
  "common/peg-parser.h"
  "common/reasoning-budget.cpp"
  "common/reasoning-budget.h"
  "common/sampling.cpp"
  "common/sampling.h"
  "common/speculative.cpp"
  "common/speculative.h"
  "common/trie.cpp"
  "common/trie.h"
  "common/unicode.cpp"
  "common/unicode.h"
  "ggml-alloc.c"
  "ggml-alloc.h"
  "ggml-backend-dl.cpp"
  "ggml-backend-dl.h"
  "ggml-backend-impl.h"
  "ggml-backend-meta.cpp"
  "ggml-backend-reg.cpp"
  "ggml-backend.cpp"
  "ggml-backend.h"
  "ggml-blas/ggml-blas.cpp"
  "ggml-blas.h"
  "ggml-common.h"
  "ggml-cpp.h"
  "ggml-cpu/amx/amx.cpp"
  "ggml-cpu/amx/amx.h"
  "ggml-cpu/amx/common.h"
  "ggml-cpu/amx/mmq.cpp"
  "ggml-cpu/amx/mmq.h"
  "ggml-cpu/arch/arm/cpu-feats.cpp"
  "ggml-cpu/arch/arm/quants.c"
  "ggml-cpu/arch/arm/repack.cpp"
  "ggml-cpu/arch/x86/cpu-feats.cpp"
  "ggml-cpu/arch/x86/quants.c"
  "ggml-cpu/arch/x86/repack.cpp"
  "ggml-cpu/arch-fallback.h"
  "ggml-cpu/binary-ops.cpp"
  "ggml-cpu/binary-ops.h"
  "ggml-cpu/common.h"
  "ggml-cpu/ggml-cpu-impl.h"
  "ggml-cpu/ggml-cpu.c"
  "ggml-cpu/ggml-cpu.cpp"
  "ggml-cpu/ops.cpp"
  "ggml-cpu/ops.h"
  "ggml-cpu/quants.c"
  "ggml-cpu/quants.h"
  "ggml-cpu/repack.cpp"
  "ggml-cpu/repack.h"
  "ggml-cpu/simd-gemm.h"
  "ggml-cpu/simd-mappings.h"
  "ggml-cpu/traits.cpp"
  "ggml-cpu/traits.h"
  "ggml-cpu/unary-ops.cpp"
  "ggml-cpu/unary-ops.h"
  "ggml-cpu/vec.cpp"
  "ggml-cpu/vec.h"
  "ggml-cpu.h"
  "ggml-ext.h"
  "ggml-hexagon/CMakeLists.txt"
  "ggml-hexagon/ggml-hexagon.cpp"
  "ggml-hexagon/htp/act-ops.c"
  "ggml-hexagon/htp/argsort-ops.c"
  "ggml-hexagon/htp/binary-ops.c"
  "ggml-hexagon/htp/cmake-toolchain.cmake"
  "ggml-hexagon/htp/CMakeLists.txt"
  "ggml-hexagon/htp/concat-ops.c"
  "ggml-hexagon/htp/cpy-ops.c"
  "ggml-hexagon/htp/cumsum-ops.c"
  "ggml-hexagon/htp/diag-ops.c"
  "ggml-hexagon/htp/dma-queue.c"
  "ggml-hexagon/htp/dma-queue.h"
  "ggml-hexagon/htp/fill-ops.c"
  "ggml-hexagon/htp/flash-attn-ops.c"
  "ggml-hexagon/htp/flash-attn-ops.h"
  "ggml-hexagon/htp/gated-delta-net-ops.c"
  "ggml-hexagon/htp/get-rows-ops.c"
  "ggml-hexagon/htp/hex-bitmap.h"
  "ggml-hexagon/htp/hex-common.h"
  "ggml-hexagon/htp/hex-dma.c"
  "ggml-hexagon/htp/hex-dma.h"
  "ggml-hexagon/htp/hex-dump.h"
  "ggml-hexagon/htp/hex-fastdiv.h"
  "ggml-hexagon/htp/hex-profile.h"
  "ggml-hexagon/htp/hex-utils.h"
  "ggml-hexagon/htp/hmx-fa-kernels.h"
  "ggml-hexagon/htp/hmx-flash-attn-ops.c"
  "ggml-hexagon/htp/hmx-matmul-ops.c"
  "ggml-hexagon/htp/hmx-mm-kernels-tiled.h"
  "ggml-hexagon/htp/hmx-ops.c"
  "ggml-hexagon/htp/hmx-ops.h"
  "ggml-hexagon/htp/hmx-profile.h"
  "ggml-hexagon/htp/hmx-queue.c"
  "ggml-hexagon/htp/hmx-queue.h"
  "ggml-hexagon/htp/hmx-utils.h"
  "ggml-hexagon/htp/htp-ctx.h"
  "ggml-hexagon/htp/htp-msg.h"
  "ggml-hexagon/htp/htp-ops.h"
  "ggml-hexagon/htp/htp-tensor.c"
  "ggml-hexagon/htp/htp-tensor.h"
  "ggml-hexagon/htp/htp-vtcm.h"
  "ggml-hexagon/htp/htp_iface.idl"
  "ggml-hexagon/htp/hvx-arith.h"
  "ggml-hexagon/htp/hvx-base.h"
  "ggml-hexagon/htp/hvx-copy.h"
  "ggml-hexagon/htp/hvx-div.h"
  "ggml-hexagon/htp/hvx-dump.h"
  "ggml-hexagon/htp/hvx-exp.h"
  "ggml-hexagon/htp/hvx-fa-kernels.h"
  "ggml-hexagon/htp/hvx-flash-attn.h"
  "ggml-hexagon/htp/hvx-floor.h"
  "ggml-hexagon/htp/hvx-inverse.h"
  "ggml-hexagon/htp/hvx-log.h"
  "ggml-hexagon/htp/hvx-mm-kernels-flat.h"
  "ggml-hexagon/htp/hvx-mm-kernels-tiled.h"
  "ggml-hexagon/htp/hvx-norm.h"
  "ggml-hexagon/htp/hvx-pow.h"
  "ggml-hexagon/htp/hvx-reduce.h"
  "ggml-hexagon/htp/hvx-repl.h"
  "ggml-hexagon/htp/hvx-scale.h"
  "ggml-hexagon/htp/hvx-sigmoid.h"
  "ggml-hexagon/htp/hvx-sin-cos.h"
  "ggml-hexagon/htp/hvx-sqrt.h"
  "ggml-hexagon/htp/hvx-types.h"
  "ggml-hexagon/htp/hvx-utils.h"
  "ggml-hexagon/htp/im2col-ops.c"
  "ggml-hexagon/htp/main.c"
  "ggml-hexagon/htp/matmul-ops.c"
  "ggml-hexagon/htp/matmul-ops.h"
  "ggml-hexagon/htp/pad-ops.c"
  "ggml-hexagon/htp/repeat-ops.c"
  "ggml-hexagon/htp/rope-ops.c"
  "ggml-hexagon/htp/set-rows-ops.c"
  "ggml-hexagon/htp/softmax-ops.c"
  "ggml-hexagon/htp/solve-tri-ops.c"
  "ggml-hexagon/htp/ssm-conv.c"
  "ggml-hexagon/htp/sum-rows-ops.c"
  "ggml-hexagon/htp/unary-ops.c"
  "ggml-hexagon/htp/unary-ops.h"
  "ggml-hexagon/htp/v73/htp_iface.h"
  "ggml-hexagon/htp/v73/htp_iface_stub.c"
  "ggml-hexagon/htp/vtcm-utils.h"
  "ggml-hexagon/htp/work-queue.c"
  "ggml-hexagon/htp/work-queue.h"
  "ggml-hexagon/htp/worker-pool.c"
  "ggml-hexagon/htp/worker-pool.h"
  "ggml-hexagon/htp-drv.cpp"
  "ggml-hexagon/htp-drv.h"
  "ggml-hexagon/htp-opnode.h"
  "ggml-hexagon/libdl.h"
  "ggml-hexagon/libggml-htp.inf"
  "ggml-hexagon.h"
  "ggml-impl.h"
  "ggml-metal/ggml-metal-common.cpp"
  "ggml-metal/ggml-metal-common.h"
  "ggml-metal/ggml-metal-context.h"
  "ggml-metal/ggml-metal-context.m"
  "ggml-metal/ggml-metal-device.cpp"
  "ggml-metal/ggml-metal-device.h"
  "ggml-metal/ggml-metal-device.m"
  "ggml-metal/ggml-metal-embed.s"
  "ggml-metal/ggml-metal-impl.h"
  "ggml-metal/ggml-metal-ops.cpp"
  "ggml-metal/ggml-metal-ops.h"
  "ggml-metal/ggml-metal.cpp"
  "ggml-metal/ggml-metal.metal"
  "ggml-metal.h"
  "ggml-opencl/cl-program-cache.cpp"
  "ggml-opencl/cl-program-cache.h"
  "ggml-opencl/fa_tune.h"
  "ggml-opencl/ggml-opencl.cpp"
  "ggml-opencl/kernels/abs.cl"
  "ggml-opencl/kernels/add.cl"
  "ggml-opencl/kernels/add_id.cl"
  "ggml-opencl/kernels/argsort.cl"
  "ggml-opencl/kernels/clamp.cl"
  "ggml-opencl/kernels/concat.cl"
  "ggml-opencl/kernels/conv2d.cl"
  "ggml-opencl/kernels/conv2d_f16_f32.cl"
  "ggml-opencl/kernels/cpy.cl"
  "ggml-opencl/kernels/cumsum.cl"
  "ggml-opencl/kernels/cvt.cl"
  "ggml-opencl/kernels/diag.cl"
  "ggml-opencl/kernels/diag_mask_inf.cl"
  "ggml-opencl/kernels/div.cl"
  "ggml-opencl/kernels/embed_kernel.py"
  "ggml-opencl/kernels/exp.cl"
  "ggml-opencl/kernels/expm1.cl"
  "ggml-opencl/kernels/fill.cl"
  "ggml-opencl/kernels/flash_attn_f16.cl"
  "ggml-opencl/kernels/flash_attn_f32.cl"
  "ggml-opencl/kernels/flash_attn_f32_f16.cl"
  "ggml-opencl/kernels/flash_attn_f32_q4_0.cl"
  "ggml-opencl/kernels/flash_attn_f32_q8_0.cl"
  "ggml-opencl/kernels/flash_attn_pre_f16.cl"
  "ggml-opencl/kernels/gated_delta_net.cl"
  "ggml-opencl/kernels/gelu.cl"
  "ggml-opencl/kernels/gemm_moe_mxfp4_f32.cl"
  "ggml-opencl/kernels/gemm_moe_mxfp4_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_mxfp4_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_moe_q4_0_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q4_0_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_moe_q4_1_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q4_k_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q4_k_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_moe_q5_0_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q5_1_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q5_k_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q6_k_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q6_k_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_moe_q8_0_f32_ns.cl"
  "ggml-opencl/kernels/gemm_moe_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_iq4_nl_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_iq4_nl_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q1_0_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q4_0_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q4_0_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q4_1_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q4_k_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q4_k_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q5_0_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q5_0_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q5_1_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q5_k_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q5_k_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q6_k_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q6_k_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q8_0_f32.cl"
  "ggml-opencl/kernels/gemm_noshuffle_q8_0_q8_1_dp4a.cl"
  "ggml-opencl/kernels/gemm_xmem_f16_f32_os8.cl"
  "ggml-opencl/kernels/gemv_moe_mxfp4_f32.cl"
  "ggml-opencl/kernels/gemv_moe_mxfp4_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q4_0_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q4_1_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q4_k_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q5_0_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q5_1_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q5_k_f32_ns.cl"
  "ggml-opencl/kernels/gemv_moe_q6_k_f32_ns.cl"
  "ggml-opencl/kernels/gemv_noshuffle_iq4_nl_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q1_0_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q4_0_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q4_0_f32_spec.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q4_1_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q4_k_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q5_0_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q5_1_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q5_k_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q6_k_f32.cl"
  "ggml-opencl/kernels/gemv_noshuffle_q8_0_f32.cl"
  "ggml-opencl/kernels/get_rows.cl"
  "ggml-opencl/kernels/glu.cl"
  "ggml-opencl/kernels/group_norm.cl"
  "ggml-opencl/kernels/im2col_f16.cl"
  "ggml-opencl/kernels/im2col_f32.cl"
  "ggml-opencl/kernels/l2_norm.cl"
  "ggml-opencl/kernels/mean.cl"
  "ggml-opencl/kernels/moe_combine.cl"
  "ggml-opencl/kernels/moe_reorder_b.cl"
  "ggml-opencl/kernels/moe_reorder_quant_a_q8_1.cl"
  "ggml-opencl/kernels/moe_sort_by_expert.cl"
  "ggml-opencl/kernels/mul.cl"
  "ggml-opencl/kernels/mul_mat_f16_f32.cl"
  "ggml-opencl/kernels/mul_mm_f16_f32_kq_kqv.cl"
  "ggml-opencl/kernels/mul_mm_f16_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_f32_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_iq4_nl_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q1_0_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q4_0_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q4_1_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q4_k_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q5_0_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q5_1_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q5_k_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q6_k_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mm_q8_0_f32_l4_lm.cl"
  "ggml-opencl/kernels/mul_mv_f16_f16.cl"
  "ggml-opencl/kernels/mul_mv_f16_f32.cl"
  "ggml-opencl/kernels/mul_mv_f16_f32_1row.cl"
  "ggml-opencl/kernels/mul_mv_f16_f32_l4.cl"
  "ggml-opencl/kernels/mul_mv_f32_f32.cl"
  "ggml-opencl/kernels/mul_mv_id_mxfp4_f32.cl"
  "ggml-opencl/kernels/mul_mv_id_mxfp4_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_id_q4_0_f32_8x_flat.cl"
  "ggml-opencl/kernels/mul_mv_id_q8_0_f32.cl"
  "ggml-opencl/kernels/mul_mv_id_q8_0_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_iq4_nl_f32.cl"
  "ggml-opencl/kernels/mul_mv_iq4_nl_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_mxfp4_f32.cl"
  "ggml-opencl/kernels/mul_mv_mxfp4_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q1_0_f32.cl"
  "ggml-opencl/kernels/mul_mv_q1_0_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q4_0_f32.cl"
  "ggml-opencl/kernels/mul_mv_q4_0_f32_1d_16x_flat.cl"
  "ggml-opencl/kernels/mul_mv_q4_0_f32_1d_8x_flat.cl"
  "ggml-opencl/kernels/mul_mv_q4_0_f32_8x_flat.cl"
  "ggml-opencl/kernels/mul_mv_q4_0_f32_v.cl"
  "ggml-opencl/kernels/mul_mv_q4_1_f32.cl"
  "ggml-opencl/kernels/mul_mv_q4_1_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q4_k_f32.cl"
  "ggml-opencl/kernels/mul_mv_q4_k_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q5_0_f32.cl"
  "ggml-opencl/kernels/mul_mv_q5_0_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q5_1_f32.cl"
  "ggml-opencl/kernels/mul_mv_q5_1_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q5_k_f32.cl"
  "ggml-opencl/kernels/mul_mv_q5_k_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q6_k_f32.cl"
  "ggml-opencl/kernels/mul_mv_q6_k_f32_flat.cl"
  "ggml-opencl/kernels/mul_mv_q8_0_f32.cl"
  "ggml-opencl/kernels/mul_mv_q8_0_f32_flat.cl"
  "ggml-opencl/kernels/neg.cl"
  "ggml-opencl/kernels/norm.cl"
  "ggml-opencl/kernels/pad.cl"
  "ggml-opencl/kernels/quant_a_q8_1.cl"
  "ggml-opencl/kernels/relu.cl"
  "ggml-opencl/kernels/repeat.cl"
  "ggml-opencl/kernels/rms_norm.cl"
  "ggml-opencl/kernels/rope.cl"
  "ggml-opencl/kernels/scale.cl"
  "ggml-opencl/kernels/set_rows.cl"
  "ggml-opencl/kernels/sigmoid.cl"
  "ggml-opencl/kernels/silu.cl"
  "ggml-opencl/kernels/softmax_4_f16.cl"
  "ggml-opencl/kernels/softmax_4_f32.cl"
  "ggml-opencl/kernels/softmax_f16.cl"
  "ggml-opencl/kernels/softmax_f32.cl"
  "ggml-opencl/kernels/softplus.cl"
  "ggml-opencl/kernels/solve_tri.cl"
  "ggml-opencl/kernels/sqr.cl"
  "ggml-opencl/kernels/sqrt.cl"
  "ggml-opencl/kernels/ssm_conv.cl"
  "ggml-opencl/kernels/sub.cl"
  "ggml-opencl/kernels/sum_rows.cl"
  "ggml-opencl/kernels/tanh.cl"
  "ggml-opencl/kernels/transpose.cl"
  "ggml-opencl/kernels/tri.cl"
  "ggml-opencl/kernels/tsembd.cl"
  "ggml-opencl/kernels/upscale.cl"
  "ggml-opencl/libdl.h"
  "ggml-opencl.h"
  "ggml-opt.cpp"
  "ggml-opt.h"
  "ggml-quants.c"
  "ggml-quants.h"
  "ggml-threading.cpp"
  "ggml-threading.h"
  "ggml.c"
  "ggml.h"
  "gguf.cpp"
  "gguf.h"
  "jsi/JSICompletion.h"
  "jsi/JSIContext.cpp"
  "jsi/JSIContext.h"
  "jsi/JSIHelpers.h"
  "jsi/JSINativeHeaders.h"
  "jsi/JSIParams.cpp"
  "jsi/JSIParams.h"
  "jsi/JSIRequestManager.h"
  "jsi/JSISession.h"
  "jsi/JSITaskManager.cpp"
  "jsi/JSITaskManager.h"
  "jsi/JSIUtils.cpp"
  "jsi/JSIUtils.h"
  "jsi/RNLlamaJSI.cpp"
  "jsi/RNLlamaJSI.h"
  "jsi/ThreadPool.cpp"
  "jsi/ThreadPool.h"
  "LICENSE"
  "llama-adapter.cpp"
  "llama-adapter.h"
  "llama-arch.cpp"
  "llama-arch.h"
  "llama-batch.cpp"
  "llama-batch.h"
  "llama-chat.cpp"
  "llama-chat.h"
  "llama-context.cpp"
  "llama-context.h"
  "llama-cparams.cpp"
  "llama-cparams.h"
  "llama-cpp.h"
  "llama-ext.h"
  "llama-grammar.cpp"
  "llama-grammar.h"
  "llama-graph.cpp"
  "llama-graph.h"
  "llama-hparams.cpp"
  "llama-hparams.h"
  "llama-impl.cpp"
  "llama-impl.h"
  "llama-io.cpp"
  "llama-io.h"
  "llama-kv-cache-dsa.cpp"
  "llama-kv-cache-dsa.h"
  "llama-kv-cache-dsv4.cpp"
  "llama-kv-cache-dsv4.h"
  "llama-kv-cache-iswa.cpp"
  "llama-kv-cache-iswa.h"
  "llama-kv-cache-msa.cpp"
  "llama-kv-cache-msa.h"
  "llama-kv-cache.cpp"
  "llama-kv-cache.h"
  "llama-kv-cells.h"
  "llama-memory-hybrid-iswa.cpp"
  "llama-memory-hybrid-iswa.h"
  "llama-memory-hybrid.cpp"
  "llama-memory-hybrid.h"
  "llama-memory-recurrent.cpp"
  "llama-memory-recurrent.h"
  "llama-memory.cpp"
  "llama-memory.h"
  "llama-mmap.cpp"
  "llama-mmap.h"
  "llama-model-loader.cpp"
  "llama-model-loader.h"
  "llama-model-saver.cpp"
  "llama-model-saver.h"
  "llama-model.cpp"
  "llama-model.h"
  "llama-sampler.cpp"
  "llama-sampler.h"
  "llama-vocab.cpp"
  "llama-vocab.h"
  "llama.cpp"
  "llama.h"
  "models/afmoe.cpp"
  "models/apertus.cpp"
  "models/arcee.cpp"
  "models/arctic.cpp"
  "models/arwkv7.cpp"
  "models/baichuan.cpp"
  "models/bailingmoe.cpp"
  "models/bailingmoe2.cpp"
  "models/bert.cpp"
  "models/bitnet.cpp"
  "models/bloom.cpp"
  "models/chameleon.cpp"
  "models/chatglm.cpp"
  "models/codeshell.cpp"
  "models/cogvlm.cpp"
  "models/cohere2.cpp"
  "models/cohere2moe.cpp"
  "models/command-r.cpp"
  "models/dbrx.cpp"
  "models/deci.cpp"
  "models/deepseek.cpp"
  "models/deepseek2.cpp"
  "models/deepseek2ocr.cpp"
  "models/deepseek32.cpp"
  "models/deepseek4.cpp"
  "models/delta-net-base.cpp"
  "models/dflash.cpp"
  "models/dots1.cpp"
  "models/dream.cpp"
  "models/eagle3.cpp"
  "models/ernie4-5-moe.cpp"
  "models/ernie4-5.cpp"
  "models/eurobert.cpp"
  "models/exaone-moe.cpp"
  "models/exaone.cpp"
  "models/exaone4.cpp"
  "models/falcon-h1.cpp"
  "models/falcon.cpp"
  "models/gemma-embedding.cpp"
  "models/gemma.cpp"
  "models/gemma2.cpp"
  "models/gemma3.cpp"
  "models/gemma3n.cpp"
  "models/gemma4-assistant.cpp"
  "models/gemma4.cpp"
  "models/glm-dsa.cpp"
  "models/glm4-moe.cpp"
  "models/glm4.cpp"
  "models/gpt2.cpp"
  "models/gptneox.cpp"
  "models/granite-hybrid.cpp"
  "models/granite-moe.cpp"
  "models/granite.cpp"
  "models/grok.cpp"
  "models/grovemoe.cpp"
  "models/hunyuan-dense.cpp"
  "models/hunyuan-moe.cpp"
  "models/hunyuan-vl.cpp"
  "models/hy-v3.cpp"
  "models/internlm2.cpp"
  "models/jais.cpp"
  "models/jais2.cpp"
  "models/jamba.cpp"
  "models/jina-bert-v2.cpp"
  "models/jina-bert-v3.cpp"
  "models/kimi-linear.cpp"
  "models/laguna.cpp"
  "models/lfm2.cpp"
  "models/lfm2moe.cpp"
  "models/llada-moe.cpp"
  "models/llada.cpp"
  "models/llama-embed.cpp"
  "models/llama.cpp"
  "models/llama4.cpp"
  "models/maincoder.cpp"
  "models/mamba-base.cpp"
  "models/mamba.cpp"
  "models/mamba2.cpp"
  "models/mellum.cpp"
  "models/mimo2.cpp"
  "models/minicpm.cpp"
  "models/minicpm3.cpp"
  "models/minimax-m2.cpp"
  "models/minimax-m3.cpp"
  "models/mistral3.cpp"
  "models/mistral4.cpp"
  "models/models.h"
  "models/modern-bert.cpp"
  "models/mpt.cpp"
  "models/nanbeige.cpp"
  "models/nemotron-h-moe.cpp"
  "models/nemotron-h.cpp"
  "models/nemotron.cpp"
  "models/neo-bert.cpp"
  "models/nomic-bert-moe.cpp"
  "models/nomic-bert.cpp"
  "models/olmo.cpp"
  "models/olmo2.cpp"
  "models/olmoe.cpp"
  "models/openai-moe.cpp"
  "models/openelm.cpp"
  "models/orion.cpp"
  "models/paddleocr.cpp"
  "models/pangu-embed.cpp"
  "models/phi2.cpp"
  "models/phi3.cpp"
  "models/phimoe.cpp"
  "models/plamo.cpp"
  "models/plamo2.cpp"
  "models/plamo3.cpp"
  "models/plm.cpp"
  "models/qwen.cpp"
  "models/qwen2.cpp"
  "models/qwen2moe.cpp"
  "models/qwen2vl.cpp"
  "models/qwen3.cpp"
  "models/qwen35.cpp"
  "models/qwen35moe.cpp"
  "models/qwen3moe.cpp"
  "models/qwen3next.cpp"
  "models/qwen3vl.cpp"
  "models/qwen3vlmoe.cpp"
  "models/refact.cpp"
  "models/rnd1.cpp"
  "models/rwkv6-base.cpp"
  "models/rwkv6.cpp"
  "models/rwkv6qwen2.cpp"
  "models/rwkv7-base.cpp"
  "models/rwkv7.cpp"
  "models/seed-oss.cpp"
  "models/smallthinker.cpp"
  "models/smollm3.cpp"
  "models/stablelm.cpp"
  "models/starcoder.cpp"
  "models/starcoder2.cpp"
  "models/step35.cpp"
  "models/t5.cpp"
  "models/t5encoder.cpp"
  "models/talkie.cpp"
  "models/wavtokenizer-dec.cpp"
  "models/xverse.cpp"
  "nlohmann/json.hpp"
  "nlohmann/json_fwd.hpp"
  "README.md"
  "rn-common.hpp"
  "rn-completion.cpp"
  "rn-completion.h"
  "rn-llama.cpp"
  "rn-llama.h"
  "rn-mtmd.hpp"
  "rn-slot-manager.cpp"
  "rn-slot-manager.h"
  "rn-slot.cpp"
  "rn-slot.h"
  "rn-tts.cpp"
  "rn-tts.h"
  "tools/mtmd/clip-graph.h"
  "tools/mtmd/clip-impl.h"
  "tools/mtmd/clip-model.h"
  "tools/mtmd/clip.cpp"
  "tools/mtmd/clip.h"
  "tools/mtmd/debug/mtmd-debug.cpp"
  "tools/mtmd/debug/mtmd-debug.h"
  "tools/mtmd/debug/mtmd-debug.md"
  "tools/mtmd/miniaudio/miniaudio.h"
  "tools/mtmd/models/cogvlm.cpp"
  "tools/mtmd/models/conformer.cpp"
  "tools/mtmd/models/deepseekocr.cpp"
  "tools/mtmd/models/deepseekocr2.cpp"
  "tools/mtmd/models/dotsocr.cpp"
  "tools/mtmd/models/exaone4_5.cpp"
  "tools/mtmd/models/gemma4a.cpp"
  "tools/mtmd/models/gemma4ua.cpp"
  "tools/mtmd/models/gemma4uv.cpp"
  "tools/mtmd/models/gemma4v.cpp"
  "tools/mtmd/models/glm4v.cpp"
  "tools/mtmd/models/granite-speech.cpp"
  "tools/mtmd/models/granite4-vision.cpp"
  "tools/mtmd/models/hunyuanvl.cpp"
  "tools/mtmd/models/internvl.cpp"
  "tools/mtmd/models/kimik25.cpp"
  "tools/mtmd/models/kimivl.cpp"
  "tools/mtmd/models/llama4.cpp"
  "tools/mtmd/models/llava.cpp"
  "tools/mtmd/models/mimo-audio.cpp"
  "tools/mtmd/models/mimovl.cpp"
  "tools/mtmd/models/minicpmv.cpp"
  "tools/mtmd/models/minimax-m3.cpp"
  "tools/mtmd/models/mobilenetv5.cpp"
  "tools/mtmd/models/models.h"
  "tools/mtmd/models/nemotron-v2-vl.cpp"
  "tools/mtmd/models/paddleocr.cpp"
  "tools/mtmd/models/parakeet.cpp"
  "tools/mtmd/models/pixtral.cpp"
  "tools/mtmd/models/qwen2vl.cpp"
  "tools/mtmd/models/qwen3a.cpp"
  "tools/mtmd/models/qwen3vl.cpp"
  "tools/mtmd/models/siglip.cpp"
  "tools/mtmd/models/step3vl.cpp"
  "tools/mtmd/models/whisper-enc.cpp"
  "tools/mtmd/models/yasa2.cpp"
  "tools/mtmd/models/youtuvl.cpp"
  "tools/mtmd/mtmd-audio.cpp"
  "tools/mtmd/mtmd-audio.h"
  "tools/mtmd/mtmd-helper.cpp"
  "tools/mtmd/mtmd-helper.h"
  "tools/mtmd/mtmd-image.cpp"
  "tools/mtmd/mtmd-image.h"
  "tools/mtmd/mtmd.cpp"
  "tools/mtmd/mtmd.h"
  "tools/mtmd/stb/stb_image.h"
  "unicode-data.cpp"
  "unicode-data.h"
  "unicode.cpp"
  "unicode.h"
)
list(SORT ACTUAL)
list(SORT EXPECTED)
if(NOT "${ACTUAL}" STREQUAL "${EXPECTED}")
  message(FATAL_ERROR "Pinned llama source file inventory changed")
endif()
file(SHA256 "${SRC}/anyascii.c" DIGEST)
if(NOT DIGEST STREQUAL "79900a045802d2bf4ff4c1e4f64dff5baefecc96d3fc2a28c452e19bba79cbf5")
  message(FATAL_ERROR "Pinned llama source mismatch: anyascii.c")
endif()
file(SHA256 "${SRC}/anyascii.h" DIGEST)
if(NOT DIGEST STREQUAL "0b4fe4cd6c064bfe27651fd2f3a8b22f470210f990a63fa35443b042ab99274b")
  message(FATAL_ERROR "Pinned llama source mismatch: anyascii.h")
endif()
file(SHA256 "${SRC}/chat.cpp.patch" DIGEST)
if(NOT DIGEST STREQUAL "7e278d8b9b3da4cd4c3085311cc83ccf9f2d6d18f3495fc697668cb8ad8d924e")
  message(FATAL_ERROR "Pinned llama source mismatch: chat.cpp.patch")
endif()
file(SHA256 "${SRC}/common/build-info.cpp" DIGEST)
if(NOT DIGEST STREQUAL "46f98005e608f6c0d4612dc363fe1f49033d69ff727a18c128d9943e8e6b6d17")
  message(FATAL_ERROR "Pinned llama source mismatch: common/build-info.cpp")
endif()
file(SHA256 "${SRC}/common/build-info.h" DIGEST)
if(NOT DIGEST STREQUAL "a255949ff4f726bef2dc3464188ad05a8af4465689a0939503940066eefbb393")
  message(FATAL_ERROR "Pinned llama source mismatch: common/build-info.h")
endif()
file(SHA256 "${SRC}/common/chat-auto-parser-generator.cpp" DIGEST)
if(NOT DIGEST STREQUAL "431ec29f7cd61a7cad80c9596918eda04e3e37ca25b7fcb1a6d424ff3c0cad7b")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-auto-parser-generator.cpp")
endif()
file(SHA256 "${SRC}/common/chat-auto-parser-helpers.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e1d5ce28501aa564fdd49103b13dd61a43c84d11e37517b4d216f029b17ec595")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-auto-parser-helpers.cpp")
endif()
file(SHA256 "${SRC}/common/chat-auto-parser-helpers.h" DIGEST)
if(NOT DIGEST STREQUAL "a2866e5411ab5c23171db7214fa9aa60171b52ed4737bd37ce66f828d8683998")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-auto-parser-helpers.h")
endif()
file(SHA256 "${SRC}/common/chat-auto-parser.h" DIGEST)
if(NOT DIGEST STREQUAL "a8748dda4cf7867d4e5df624274a103dd4404c7356603f881595cbaee6e71550")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-auto-parser.h")
endif()
file(SHA256 "${SRC}/common/chat-diff-analyzer.cpp" DIGEST)
if(NOT DIGEST STREQUAL "663834746dd6495aac982fe5e4df33b741194e8a2d24f189248b5b7ca7585309")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-diff-analyzer.cpp")
endif()
file(SHA256 "${SRC}/common/chat-peg-parser.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b8039362db741365ac3b1341d80d2ef050df5816630184c0fd9cea6475aab3ea")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-peg-parser.cpp")
endif()
file(SHA256 "${SRC}/common/chat-peg-parser.h" DIGEST)
if(NOT DIGEST STREQUAL "8584594a3afd814b6d93ad7f9b3f671c1f353fcdf53f23f94c015e85b64729a4")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat-peg-parser.h")
endif()
file(SHA256 "${SRC}/common/chat.cpp" DIGEST)
if(NOT DIGEST STREQUAL "50bd71e883b5d993cd16b7e8286763f535fea1d67c7adb86db3c4f09d472d931")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat.cpp")
endif()
file(SHA256 "${SRC}/common/chat.h" DIGEST)
if(NOT DIGEST STREQUAL "d58471e45e5bfc73fbc31dfdd5812a5f28889431087e6dbfef40f76ec3489fb8")
  message(FATAL_ERROR "Pinned llama source mismatch: common/chat.h")
endif()
file(SHA256 "${SRC}/common/common.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a5ea14a4351cf60efda3ab154e34ad02bd0d8976e88517ae6a5b2734fca6d49f"
   AND NOT DIGEST STREQUAL "c56fa5480100551dec93806a37a7f81b1f877106ac809d7110cb8b7d196b7b01")
  message(FATAL_ERROR "Pinned llama source mismatch: common/common.cpp")
endif()
file(SHA256 "${SRC}/common/common.h" DIGEST)
if(NOT DIGEST STREQUAL "4c7c0355737c86765001c46704250b61dce544639d8e41a94bf7a26db4c477be"
   AND NOT DIGEST STREQUAL "cd6b8b1133ac28080d0f6ba05616f10223125894db8e208f5553fb04e41ffc6c")
  message(FATAL_ERROR "Pinned llama source mismatch: common/common.h")
endif()
file(SHA256 "${SRC}/common/fit.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0d27372ea2ccf24fff7d89db8c14d2194b9e2070515b5fc3aa1c726934d3eb69")
  message(FATAL_ERROR "Pinned llama source mismatch: common/fit.cpp")
endif()
file(SHA256 "${SRC}/common/fit.h" DIGEST)
if(NOT DIGEST STREQUAL "eccf6c8ddf74b1bfb001e4025a1b76e487ced675a221e87c6370806027bb20ed")
  message(FATAL_ERROR "Pinned llama source mismatch: common/fit.h")
endif()
file(SHA256 "${SRC}/common/jinja/caps.cpp" DIGEST)
if(NOT DIGEST STREQUAL "21cece87f3be78487df7be5dd989fbaa3cf05851a9bd4bdebeddcdc8042cafbc")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/caps.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/caps.h" DIGEST)
if(NOT DIGEST STREQUAL "30f25aee0be5e9deed745c522eca969998564a27926f59238bdfe2a5a160cfd0")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/caps.h")
endif()
file(SHA256 "${SRC}/common/jinja/jinja-string.h" DIGEST)
if(NOT DIGEST STREQUAL "4cbff76daf9c9e23da83310cf1b667b710777f074598277222e4650e055c8bd7")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/jinja-string.h")
endif()
file(SHA256 "${SRC}/common/jinja/lexer.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3d6774bc2dac477e10ddbee69eff403df36f5925c8512ccf8a249bde5c26dbd7")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/lexer.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/lexer.h" DIGEST)
if(NOT DIGEST STREQUAL "93aecd72cc952fab08f657aa2a70e9f58421672b19d3179f8bdf555e683a1cc7")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/lexer.h")
endif()
file(SHA256 "${SRC}/common/jinja/parser.cpp" DIGEST)
if(NOT DIGEST STREQUAL "284c3dcc92cfcbdb3391f4b251bdc2bd5191899973bf665e9351aca3b795c724")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/parser.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/parser.h" DIGEST)
if(NOT DIGEST STREQUAL "6225eb759da910f3dd7753aed71c6938131cfa04c609d744e6f1390396422316")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/parser.h")
endif()
file(SHA256 "${SRC}/common/jinja/README.md" DIGEST)
if(NOT DIGEST STREQUAL "345767ad59a6e193751e57d5b46d7c3bcdfa761c337aa4e2c94f0c06328e9361")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/README.md")
endif()
file(SHA256 "${SRC}/common/jinja/runtime.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d360afb87e9615bd57f955a7c59617a06ed1cdce1376bd7f6bd7053a782d792c")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/runtime.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/runtime.h" DIGEST)
if(NOT DIGEST STREQUAL "d03b9f179e2be427074ae65152aec5797a3997bf11ebb437fc7d6875add85479")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/runtime.h")
endif()
file(SHA256 "${SRC}/common/jinja/string.cpp" DIGEST)
if(NOT DIGEST STREQUAL "07fea1d6512b0644b325a288dbb9cd1ed907292c9462d5fcdaac65e80c3d17f5")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/string.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/utils.h" DIGEST)
if(NOT DIGEST STREQUAL "61ae8bc57a7a551bdfb294a23a0ef8b5ba8e3cf4d695389f0f0797e2d7689781")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/utils.h")
endif()
file(SHA256 "${SRC}/common/jinja/value.cpp" DIGEST)
if(NOT DIGEST STREQUAL "37875617ba55ec28c0a9c75188076c5e89676fc1e90e1638f05e3e8ed3cd3dfe")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/value.cpp")
endif()
file(SHA256 "${SRC}/common/jinja/value.h" DIGEST)
if(NOT DIGEST STREQUAL "e9ccb56494b22fd2cd4cc8cffab4e941ecd0bff24956433556207b2a9749acd2")
  message(FATAL_ERROR "Pinned llama source mismatch: common/jinja/value.h")
endif()
file(SHA256 "${SRC}/common/json-schema-to-grammar.cpp" DIGEST)
if(NOT DIGEST STREQUAL "41ae82921a142b6fc507726a3cdc9532673d60c7af575a442072c896f417bdaa")
  message(FATAL_ERROR "Pinned llama source mismatch: common/json-schema-to-grammar.cpp")
endif()
file(SHA256 "${SRC}/common/json-schema-to-grammar.h" DIGEST)
if(NOT DIGEST STREQUAL "d156490f8cb7e5fb9f714efcc119dba8acda0140c1addd4a446a49708163c44d")
  message(FATAL_ERROR "Pinned llama source mismatch: common/json-schema-to-grammar.h")
endif()
file(SHA256 "${SRC}/common/log.cpp" DIGEST)
if(NOT DIGEST STREQUAL "26a5545c37799504e3e5725fc32b34d5426fc127d34b0d608b34aaa3ff1a559d")
  message(FATAL_ERROR "Pinned llama source mismatch: common/log.cpp")
endif()
file(SHA256 "${SRC}/common/log.h" DIGEST)
if(NOT DIGEST STREQUAL "b72b53110ea883d9dfdcfed3608f660d43f40bb350f3557c7b542dec74f84888")
  message(FATAL_ERROR "Pinned llama source mismatch: common/log.h")
endif()
file(SHA256 "${SRC}/common/ngram-cache.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b118dfb510b874e0aabce13a9c877d34ec3e6a392b8690e45f80587c94f7661d")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-cache.cpp")
endif()
file(SHA256 "${SRC}/common/ngram-cache.h" DIGEST)
if(NOT DIGEST STREQUAL "91ec39f1e523e410c8af1aa48a904fc99893223f4197ac4474a5f2d49a4ad60f")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-cache.h")
endif()
file(SHA256 "${SRC}/common/ngram-map.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1a1f7cc92238c28a339cd8726b3e3989e87130fd7f1763a605c4703a4f7dc876")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-map.cpp")
endif()
file(SHA256 "${SRC}/common/ngram-map.h" DIGEST)
if(NOT DIGEST STREQUAL "39decafa216df72bc77783c4d3ca659cc19e587d661e9149b8d0c2a3dff4fbe2")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-map.h")
endif()
file(SHA256 "${SRC}/common/ngram-mod.cpp" DIGEST)
if(NOT DIGEST STREQUAL "06ed2b6d42854f42b74a2fb940a5b5bf405c619fa0d40f81cf8ca18b566104f7")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-mod.cpp")
endif()
file(SHA256 "${SRC}/common/ngram-mod.h" DIGEST)
if(NOT DIGEST STREQUAL "bf676fd31f89e7a557f960461f60afe8182799c8974ce9be32fc6f1b00669e20")
  message(FATAL_ERROR "Pinned llama source mismatch: common/ngram-mod.h")
endif()
file(SHA256 "${SRC}/common/peg-parser.cpp" DIGEST)
if(NOT DIGEST STREQUAL "44860cd9e709bf5d819afc6ee1a05d3cd83b5333d9459859ddc1dfacbe4d0943")
  message(FATAL_ERROR "Pinned llama source mismatch: common/peg-parser.cpp")
endif()
file(SHA256 "${SRC}/common/peg-parser.h" DIGEST)
if(NOT DIGEST STREQUAL "2210f2a15566e9509db22a3d928e7c1255d118be52f2d20206feb469eb40f1d5")
  message(FATAL_ERROR "Pinned llama source mismatch: common/peg-parser.h")
endif()
file(SHA256 "${SRC}/common/reasoning-budget.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ec9c4d9cbe0d259abc6b2809f9de82ec9d1eef707bc69400576b8535920126fa")
  message(FATAL_ERROR "Pinned llama source mismatch: common/reasoning-budget.cpp")
endif()
file(SHA256 "${SRC}/common/reasoning-budget.h" DIGEST)
if(NOT DIGEST STREQUAL "bef856179c9e76b779139e6fd712199aab2efd3e49facbe8ed6e8691dee69cd8")
  message(FATAL_ERROR "Pinned llama source mismatch: common/reasoning-budget.h")
endif()
file(SHA256 "${SRC}/common/sampling.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4765b131aceffe4dac3af3b26bea6a6ef571744dbd45cf699a570f09505784bc")
  message(FATAL_ERROR "Pinned llama source mismatch: common/sampling.cpp")
endif()
file(SHA256 "${SRC}/common/sampling.h" DIGEST)
if(NOT DIGEST STREQUAL "1a4960b0f282cb5945a6167ac7ab0fc0611feda8c77de958613c2bd519d8751b")
  message(FATAL_ERROR "Pinned llama source mismatch: common/sampling.h")
endif()
file(SHA256 "${SRC}/common/speculative.cpp" DIGEST)
if(NOT DIGEST STREQUAL "85279708386fbc76809ce19db70c1ee2de093b54d78482df1ceea429bb565ea0")
  message(FATAL_ERROR "Pinned llama source mismatch: common/speculative.cpp")
endif()
file(SHA256 "${SRC}/common/speculative.h" DIGEST)
if(NOT DIGEST STREQUAL "145fb801cc15d1d9799a8baaa8ee81b7e187ba06c13181604700895c286947eb")
  message(FATAL_ERROR "Pinned llama source mismatch: common/speculative.h")
endif()
file(SHA256 "${SRC}/common/trie.cpp" DIGEST)
if(NOT DIGEST STREQUAL "807cac6c6296ca294397360fbfdd5f19a65fb7c50a587c8b56094261eec5acb2")
  message(FATAL_ERROR "Pinned llama source mismatch: common/trie.cpp")
endif()
file(SHA256 "${SRC}/common/trie.h" DIGEST)
if(NOT DIGEST STREQUAL "391806c154f074d63e208f5a79d4d19df07592a645d860bb2c845525afda898e")
  message(FATAL_ERROR "Pinned llama source mismatch: common/trie.h")
endif()
file(SHA256 "${SRC}/common/unicode.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a07137a4fe6a657acf0d4b16ee5fa4ba388f7e9c8d3c98993410b28720b69b6d")
  message(FATAL_ERROR "Pinned llama source mismatch: common/unicode.cpp")
endif()
file(SHA256 "${SRC}/common/unicode.h" DIGEST)
if(NOT DIGEST STREQUAL "b88c29194f028c27988c05a64bd72948ff55081dc1b07e5ff9c3bb72601c62b5")
  message(FATAL_ERROR "Pinned llama source mismatch: common/unicode.h")
endif()
file(SHA256 "${SRC}/ggml-alloc.c" DIGEST)
if(NOT DIGEST STREQUAL "cc0f1dde8fbee4e979011311115022a4e37bec8b71c0b764e5a210744fb7416b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-alloc.c")
endif()
file(SHA256 "${SRC}/ggml-alloc.h" DIGEST)
if(NOT DIGEST STREQUAL "1878ddb19eedd5efca222f8b97b0fe0ba628f26a224a645897551bbc5de09c5b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-alloc.h")
endif()
file(SHA256 "${SRC}/ggml-backend-dl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "acd76df8b83bcdef6807bc7b0520f57b379d61b4ff1027c04aa4d140d16ad07f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend-dl.cpp")
endif()
file(SHA256 "${SRC}/ggml-backend-dl.h" DIGEST)
if(NOT DIGEST STREQUAL "225bd83a197c4e8b5f985717176824d1144e2b74a79f04838f51b84115c14dc5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend-dl.h")
endif()
file(SHA256 "${SRC}/ggml-backend-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "8bb519f9eb2bfb94953895a250d509291487c78f619224b6988ea6e8b0b7b08a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend-impl.h")
endif()
file(SHA256 "${SRC}/ggml-backend-meta.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5f5f6d77697d8381e651ee29dbb15edcd9ff905e04c30dbf70a7897df4453608")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend-meta.cpp")
endif()
file(SHA256 "${SRC}/ggml-backend-reg.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bf975ff50b354f339436351377e969224dd21b86d49922817da0f7448b58682b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend-reg.cpp")
endif()
file(SHA256 "${SRC}/ggml-backend.cpp" DIGEST)
if(NOT DIGEST STREQUAL "001504464c64f9c46408f00b3f1a9b997791c24fc81a68cf0430b4f6bf7e5450")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend.cpp")
endif()
file(SHA256 "${SRC}/ggml-backend.h" DIGEST)
if(NOT DIGEST STREQUAL "2944a951bc918d95dbfa62395309f7a8555ab2a1f15908d86231a58ac351656e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-backend.h")
endif()
file(SHA256 "${SRC}/ggml-blas/ggml-blas.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f83f5d812a66a6a7250e9ded4465323619b3a32040ed2bd5c90b8697d05d3009")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-blas/ggml-blas.cpp")
endif()
file(SHA256 "${SRC}/ggml-blas.h" DIGEST)
if(NOT DIGEST STREQUAL "cfcec8d03a991e628088cd0a576fd830ea49f5f7ad5e5a121418b99f1d132f80")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-blas.h")
endif()
file(SHA256 "${SRC}/ggml-common.h" DIGEST)
if(NOT DIGEST STREQUAL "934c2562b5eab09bd10de05b74f2c645e509af33bc55b722c2d2de8e5f2abe7c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-common.h")
endif()
file(SHA256 "${SRC}/ggml-cpp.h" DIGEST)
if(NOT DIGEST STREQUAL "01b6c9764367b1ae6223da8258b346278198da3ead960325e66e542286ef9848")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpp.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/amx/amx.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4c2c3e6cf5026807f735e8a680b8db6ea829406d3c213e95514ff91fc8994431")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/amx/amx.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/amx/amx.h" DIGEST)
if(NOT DIGEST STREQUAL "ed014f1b15f48e599835279dc04a84b8661cd579cdf1d7874c9bbbf4798061da")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/amx/amx.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/amx/common.h" DIGEST)
if(NOT DIGEST STREQUAL "9fbe47ce88648d2bc32bc42176ef4ba02a3366722014e828fe67cd0e5ab8be40")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/amx/common.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/amx/mmq.cpp" DIGEST)
if(NOT DIGEST STREQUAL "03b3aba4a17eeaa4a6737cf37643b7066d8c6a194fbfe124e562ee230f4774f8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/amx/mmq.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/amx/mmq.h" DIGEST)
if(NOT DIGEST STREQUAL "60bccafc0a3c8f3cf9ee73e834086b7eaf36b03be43bc05b36c4cda048deffa2")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/amx/mmq.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/arm/cpu-feats.cpp" DIGEST)
if(NOT DIGEST STREQUAL "090cf4d21e667f2c359a03d639c3bbe105124bf7bb59983bf8593352d6c06619")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/arm/cpu-feats.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/arm/quants.c" DIGEST)
if(NOT DIGEST STREQUAL "edb15b62111d41fa68e8f4c069eb50a8ce1c2de8a9525a3cd02b1cd5aca7391b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/arm/quants.c")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/arm/repack.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f36e53ebde15b39147eb77d444ebf5c494af7aefed096444256fdf2836722e98")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/arm/repack.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/x86/cpu-feats.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6150df1eb438af9e1047aa8fed20f3f92c99bdd995819a6a9dd362cfdb2b560e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/x86/cpu-feats.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/x86/quants.c" DIGEST)
if(NOT DIGEST STREQUAL "0b0942f1030384ae3a907350d69b0ad29f5a9dffe3bf35286a24489f9caa9eeb")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/x86/quants.c")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch/x86/repack.cpp" DIGEST)
if(NOT DIGEST STREQUAL "18c55964dcdf1ac589dfca0e5013755a856505f5d48e4c935ed8300580e4a7c2")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch/x86/repack.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/arch-fallback.h" DIGEST)
if(NOT DIGEST STREQUAL "14dfbac8a0a2c3b400d66017c63ac70a926a9c68cba0d540d0e82bc7d94c2cc7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/arch-fallback.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/binary-ops.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e8f4bfcf7bd6ed21f6372e88ba4e7078dced1bd53896b704fb34e4f0ab3de5f7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/binary-ops.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/binary-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "364ada010973819d83d4ad2b19e0d4ab71dae0fbf9f845fae6ef18251104dbc3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/binary-ops.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/common.h" DIGEST)
if(NOT DIGEST STREQUAL "3cdbaad46d6fcf884e3268c6b073a9e55b8115b820ec009b22f2079103596d0a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/common.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/ggml-cpu-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "2f2da39c67330553ca933da6fcc9a1dae9636db0b6255f6e17f4ce42afa32681")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/ggml-cpu-impl.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/ggml-cpu.c" DIGEST)
if(NOT DIGEST STREQUAL "574093f6e0b59744d2d7a7a76a754e123782d546ed6196abfd162d64c477d272")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/ggml-cpu.c")
endif()
file(SHA256 "${SRC}/ggml-cpu/ggml-cpu.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5b2f15e3f99fb4b27a1ac22bd52a83dadffc8cd869330b48a2ae84f3eeefd76f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/ggml-cpu.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/ops.cpp" DIGEST)
if(NOT DIGEST STREQUAL "58fd34d1764ecf75a913bdc805181a6d386c28b90e69a333fb228a33727d2b27")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/ops.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/ops.h" DIGEST)
if(NOT DIGEST STREQUAL "67fc19b01eb8c5284788e7360095ae2b96ef71c1d30414643438bc2525fe2bd7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/ops.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/quants.c" DIGEST)
if(NOT DIGEST STREQUAL "623744bb484fee9175a2509d69f4a8b96c36764ff0d3a5174c20775d81a87d5a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/quants.c")
endif()
file(SHA256 "${SRC}/ggml-cpu/quants.h" DIGEST)
if(NOT DIGEST STREQUAL "fb390e1332a65c5f6a8bcb63528dc82bcb82c5194361498d2fa47cad7b28753a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/quants.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/repack.cpp" DIGEST)
if(NOT DIGEST STREQUAL "95e7a9c2e2e7dd0f081c2a85f1911077f7ca9bd764017fce5e83bcdd05c50732")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/repack.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/repack.h" DIGEST)
if(NOT DIGEST STREQUAL "a95a9781431d5e81813513d76d2064788cc51036c22fedee10ebceed78ad9b9e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/repack.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/simd-gemm.h" DIGEST)
if(NOT DIGEST STREQUAL "a7608383b15d238d9044c40fd52ed7a717a137895a16f835c515ccb1b8473bc4")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/simd-gemm.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/simd-mappings.h" DIGEST)
if(NOT DIGEST STREQUAL "6277bc0b9354080b37c13c8609c922db481b823546f69e85b2a8abe1fcb9aeff")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/simd-mappings.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/traits.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b745670e089ce3ccfe16e5bc742badedd65c2e268b4c464dfd60691e27de58d1")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/traits.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/traits.h" DIGEST)
if(NOT DIGEST STREQUAL "58fdb2358c0521b4e818e2a7197f791fc144ac74a85c470153381a7865f57177")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/traits.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/unary-ops.cpp" DIGEST)
if(NOT DIGEST STREQUAL "332f8352c50ba1190bc06c25cce02044b82149254f6ba029cb344fe607128e22")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/unary-ops.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/unary-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "edfff2529af0bf7578dadd08403d178842839d4492f931820cfec447a2c22408")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/unary-ops.h")
endif()
file(SHA256 "${SRC}/ggml-cpu/vec.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a3f71f4e391ecc4fd4289f2b5fda7155a7edd0bf52462b4c0bee5043e83e0f8b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/vec.cpp")
endif()
file(SHA256 "${SRC}/ggml-cpu/vec.h" DIGEST)
if(NOT DIGEST STREQUAL "4de8d22a43ed554f41972466fe22b4aae9b1d94ca2d0e3438f2531b763f8bee9")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu/vec.h")
endif()
file(SHA256 "${SRC}/ggml-cpu.h" DIGEST)
if(NOT DIGEST STREQUAL "99e3a26468ab48d130dd32ba54cd6f1ad3df26098a393545cd5b63208b5323fe")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-cpu.h")
endif()
file(SHA256 "${SRC}/ggml-ext.h" DIGEST)
if(NOT DIGEST STREQUAL "10596a52b61a0383c8f934a0c517c3e3eecbb93d1adcb3e41b654ac5c420fff6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-ext.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/CMakeLists.txt" DIGEST)
if(NOT DIGEST STREQUAL "00d8487f4ebdc088304e59d4ef08987077323c8c4f8a3c1bfe58e10538ea0f83")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/CMakeLists.txt")
endif()
file(SHA256 "${SRC}/ggml-hexagon/ggml-hexagon.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3c13a46119e5c836ecc59510a18f8958a6892b10de473e438ec40544a9b6b8a9")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/ggml-hexagon.cpp")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/act-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "ef82b50f5fb488c04cf974c743954dfaf4033f9caf702aafded147fbdf7f23a9")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/act-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/argsort-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "b17442bc1bbd11e767edb7a98df862b677bace2d68f428e7e28dca4914baf5d7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/argsort-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/binary-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "b8d42d7822a55eae528c35afe14c750f851382fa087bd28f03a954beeda76923")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/binary-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/cmake-toolchain.cmake" DIGEST)
if(NOT DIGEST STREQUAL "10c38f76324a9ef05f7aa19a76c951373740d42cf4b415956038e07718679a5e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/cmake-toolchain.cmake")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/CMakeLists.txt" DIGEST)
if(NOT DIGEST STREQUAL "36a6332e95ff3cf7baa7e53962955bb2530c73cc10ce3148b096625d2165e5e1")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/CMakeLists.txt")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/concat-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "cdde888e31475ebc6f631c7bfe854aedb0c04bf4d5ce712bcd867a681036d08f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/concat-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/cpy-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "c4c2d4bed284cc35df984362e3291e8117dac717f5052cd7afc3353f14213a80")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/cpy-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/cumsum-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "b329550c275b360b6f176b20960286ba6780724fda4ae053236d79d5ae028311")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/cumsum-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/diag-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "f777daa4cec563071b190046c7feaa01cc06fe68013a3028899dffa1e43017df")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/diag-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/dma-queue.c" DIGEST)
if(NOT DIGEST STREQUAL "d2e942fc859d89acdfc585dd155c53532854ee0beb1924fe9140f981a2625204")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/dma-queue.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/dma-queue.h" DIGEST)
if(NOT DIGEST STREQUAL "84a6a62510516fad35a7c2510050a822b131305110d73ab274459eea7ddcb1bd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/dma-queue.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/fill-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "6cf393707f566ff58105f87c55e5f0e1c3fdeccbe32dfa2758e671ffb39fd42e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/fill-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/flash-attn-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "b3b0394234679cab4eec9fd8d9a470c290a6b3e4449d50613719bd3d4c334393")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/flash-attn-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/flash-attn-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "cebcea9dbdf38c6f85875985cfe0f4465acaf7fe90f6705cacb5c17d62049938")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/flash-attn-ops.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/gated-delta-net-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "abbbc4454cf4cb94963df1a75a6611656db6d3c0482311acc3977cbbe54c5e00")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/gated-delta-net-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/get-rows-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "d57c38507928fef50d39797b0f2d1a30ed641a2fb3976a61fd09b4b6129ca71b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/get-rows-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-bitmap.h" DIGEST)
if(NOT DIGEST STREQUAL "9beef7d2d017c601977e0d8e202870ca5b751b070de298767c24c4191ce0d186")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-bitmap.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-common.h" DIGEST)
if(NOT DIGEST STREQUAL "947bd19c7e7754b5fbe40b4e5ea547fc86e5b881f0d18de78c4f251a85816f11")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-common.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-dma.c" DIGEST)
if(NOT DIGEST STREQUAL "d554a108d826146e8b9385885f4b6f86739af91f83a04d11ffbf092916506c05")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-dma.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-dma.h" DIGEST)
if(NOT DIGEST STREQUAL "1713573d54d8c709398d2672a8e6f91ec235d3a779466d95fcb9d4709e8d77f0")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-dma.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-dump.h" DIGEST)
if(NOT DIGEST STREQUAL "c041593d6d656d1a240cabd2d4745769adfcc11c04c0dd2e82d3a6e78fd3d154")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-dump.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-fastdiv.h" DIGEST)
if(NOT DIGEST STREQUAL "de933ab1cca4da4b285a38027899d2ed867646d7ccfa6f932620eab2065ca51d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-fastdiv.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-profile.h" DIGEST)
if(NOT DIGEST STREQUAL "28021274dbdf7d95de621ef0c303d68a406b1a0843d01c4aa7087f66518f0831")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-profile.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hex-utils.h" DIGEST)
if(NOT DIGEST STREQUAL "81b8a0707374f68387f6b07a8369486d6be376d009f299bdef3b12550533fa3f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hex-utils.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-fa-kernels.h" DIGEST)
if(NOT DIGEST STREQUAL "fe999d3cf83104391dda50adfaf799420ed789117e4499fbe141ff8b28a8268c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-fa-kernels.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-flash-attn-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "0eeba8513a8c0a911e4311b474149bb16ff38b3ffc041687fad6c549b12f4d3d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-flash-attn-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-matmul-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "257b2264f443ec5c708c80fc153d2c6ce7e28d4ca79fdcaccb335b39ca0a3912")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-matmul-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-mm-kernels-tiled.h" DIGEST)
if(NOT DIGEST STREQUAL "bf7535255c4775da6bbea6bb5e7acbcb85b5b0d3fbbb85bbe5b70beb2b8d5e93")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-mm-kernels-tiled.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "dec8a656ac632c586a779391869c3629cbe936a1fc03320fd6800517aba984d7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "ac7512b43c6e38840e53a8bf63aeac8dc7bf1178c75eda5ebf8caa6dfd5e8498")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-ops.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-profile.h" DIGEST)
if(NOT DIGEST STREQUAL "5339d7c5e946bb1b3a92093bba99ac6091ae668539726ead2ed9b0620565cbaa")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-profile.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-queue.c" DIGEST)
if(NOT DIGEST STREQUAL "6465cf29dafad76766430831e5cf1c792ef14b796b42db449e767e169e60279d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-queue.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-queue.h" DIGEST)
if(NOT DIGEST STREQUAL "75e4e5a19cdcc7b1746e8aabb4de390d368159bb98d85703f1f6c8f6881b8442")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-queue.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hmx-utils.h" DIGEST)
if(NOT DIGEST STREQUAL "6d9e853eb7614c17cda0425a14913c745c77fd54e1b3c86a28ce386d8762e113")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hmx-utils.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-ctx.h" DIGEST)
if(NOT DIGEST STREQUAL "1c6cee542dc23b174acf8c50b958663b7c9a6ed5fb16806a57fc8a9e7946459d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-ctx.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-msg.h" DIGEST)
if(NOT DIGEST STREQUAL "2a1f1483bca6d9c646183b5899e79dbef2618d552756c8c8ebfed4e509db8009")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-msg.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "ede9fdf31e45e7e1f9fffc5a8a965d0974371266073380a5928f9cd47daf6846")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-ops.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-tensor.c" DIGEST)
if(NOT DIGEST STREQUAL "1a442f5299a38897aa08ebe900f30f21eb2bfc9eac2a716e6c9201f6581a09dd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-tensor.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-tensor.h" DIGEST)
if(NOT DIGEST STREQUAL "fefe46121e9a994a95b58204f6f56c2b7793386ac5fb501ffc3928c4c15cfa9a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-tensor.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp-vtcm.h" DIGEST)
if(NOT DIGEST STREQUAL "ab67516a9d376b0c7e7478d344e41844e681a428f44feadbb190f8d6ccab3c7d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp-vtcm.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/htp_iface.idl" DIGEST)
if(NOT DIGEST STREQUAL "4784157a24826409f3feac97e870aed32d9105fe7ccc56e8732d8ac14a989411")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/htp_iface.idl")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-arith.h" DIGEST)
if(NOT DIGEST STREQUAL "eeb7bcd29561bf1d498f87bd342ab679d0bdb9006310bc176ceb0a0d02549e09")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-arith.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-base.h" DIGEST)
if(NOT DIGEST STREQUAL "ecc7c7f61dcf62563b846bb0a9026d5f4940f19c90273043fcd2c2cb500670d7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-base.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-copy.h" DIGEST)
if(NOT DIGEST STREQUAL "e54af83eae4a02655c55bb4a9ac8c9d3e9c9bbb6d2e73589a7259f3b8c8cc4cf")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-copy.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-div.h" DIGEST)
if(NOT DIGEST STREQUAL "29479865f528bc6901a29877bb9e8bc2b8b2fa9cb2cc403435175927a18fb52d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-div.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-dump.h" DIGEST)
if(NOT DIGEST STREQUAL "6e1013808fc4f8e9e810f1bbe615c85d3166c6e922d65b9c8da80fab15c885f3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-dump.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-exp.h" DIGEST)
if(NOT DIGEST STREQUAL "a4dede9de1bc124121ab0ea3508e5ddb3c8110aeff72bfbfe302265823ece5ec")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-exp.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-fa-kernels.h" DIGEST)
if(NOT DIGEST STREQUAL "12bc86e269d39f9809b0530c0e8da29912cdb383f8e1fce5563cc5ffcabee81f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-fa-kernels.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-flash-attn.h" DIGEST)
if(NOT DIGEST STREQUAL "91d074063e5497ea1b31fc3c88d54e6ba2d47045094decb35800bdab44364b50")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-flash-attn.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-floor.h" DIGEST)
if(NOT DIGEST STREQUAL "f23c2407f8b8e3007c2a4535595ac1966576eb9fb067d6443b6d7e3048e919a5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-floor.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-inverse.h" DIGEST)
if(NOT DIGEST STREQUAL "632fc3be5685b0f9b616f58274c5fcc28e829391fef67eec0d5ba1862e4e625c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-inverse.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-log.h" DIGEST)
if(NOT DIGEST STREQUAL "625fc3747a1d96cc0b1c3d0af69df2006f63d59eac82c0262ff9ea7376ccd606")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-log.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-mm-kernels-flat.h" DIGEST)
if(NOT DIGEST STREQUAL "6187c53cce36e653d56adfc4fe411107b1bdb51033b55060bfda64a6a4c03b7a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-mm-kernels-flat.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-mm-kernels-tiled.h" DIGEST)
if(NOT DIGEST STREQUAL "2f11fe128054022e58d2d797ada93938a78eb2781250ef492e54aa90c2b1078c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-mm-kernels-tiled.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-norm.h" DIGEST)
if(NOT DIGEST STREQUAL "9f7eb46c7690a0b21d82809ef7fbd897777c112b6a23fcc122df24e45d90176a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-norm.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-pow.h" DIGEST)
if(NOT DIGEST STREQUAL "590f8534add5ebb374a52704d629c28323dca6e533c7b68c8c5ba68e37bb6dbc")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-pow.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-reduce.h" DIGEST)
if(NOT DIGEST STREQUAL "23d9a1a15fb80247c7183d92e2c5dd60f326e5799e1241f263a623592e54f198")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-reduce.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-repl.h" DIGEST)
if(NOT DIGEST STREQUAL "bdc510fd038f3e8c1361cac0d257d1cc0344b9bd8f4dfd5cf42dee3441f6a69f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-repl.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-scale.h" DIGEST)
if(NOT DIGEST STREQUAL "5c846e42b243fb3ff23f2ccd01fca34a0ab4096b47f071ecd442071beca1d392")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-scale.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-sigmoid.h" DIGEST)
if(NOT DIGEST STREQUAL "3b4e71be26601fcbc0245af0eb812e4e42d4e206ffcf80429312be64f95ec763")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-sigmoid.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-sin-cos.h" DIGEST)
if(NOT DIGEST STREQUAL "a16563ad43260fad007646c0126fc5e64143476c466d589dfbaaa2d492b3b0e6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-sin-cos.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-sqrt.h" DIGEST)
if(NOT DIGEST STREQUAL "b59c68269a5b75aef730f1c92ecca862cc8900b557f1b2a1ca2aa8a155923475")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-sqrt.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-types.h" DIGEST)
if(NOT DIGEST STREQUAL "0f749cd2da86b6571b9d15b11468443cd164a524ad1e743efb64d0165795e867")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-types.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/hvx-utils.h" DIGEST)
if(NOT DIGEST STREQUAL "378d92827ffe236403a44eeffd7072e201115b053eeae4d66106d78cb5e156b8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/hvx-utils.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/im2col-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "91819e75e2eada21a9d8c82ba15a03f638d644438f2703107d0790ac4f0d52dd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/im2col-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/main.c" DIGEST)
if(NOT DIGEST STREQUAL "65911ea5292f0dd5ed555476e13b2b5db17b391603441d2e1388d0f57a3c096c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/main.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/matmul-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "7b261cf2540a97bd128f603713b45f62a94bf5ef43289ae96417fdc097c73733")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/matmul-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/matmul-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "d5056fce6f2dc261a6526e2fdbc5e5b6037dacc63e77554c66ce0be7e2474136")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/matmul-ops.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/pad-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "500ffc951d6ebe96f0e17d62384ad35564525117f4ea2ba1bd395f2205a1978d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/pad-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/repeat-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "92f71a2ba83526e020e73f935c0da22b6cfdeadfcf64d122855667d73147062d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/repeat-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/rope-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "aad96ca61e23a572b370f4b82009b9b8c9d10003c5e38cf1cada1ed85dc11cc8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/rope-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/set-rows-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "1d03c1fb649377941d0b9bde856dae954b768103bc70ed0235eef54e7149ba07")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/set-rows-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/softmax-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "c3f729f8f42945f8875e20af33742435e3fa7e58be2ce64114cd7392018956ca")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/softmax-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/solve-tri-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "d15dbf16ea134c7366231e9d8f920d650498eaeeeca8cafad1a6c496d8544165")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/solve-tri-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/ssm-conv.c" DIGEST)
if(NOT DIGEST STREQUAL "ed6ae628df3b829f6caafb51fa6f928332f261e71652f0df75313aa96e0c8e0e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/ssm-conv.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/sum-rows-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "fb330e58033a894d47a63236f177f6ae96d7f1063ab611809c7ba1ee5282a4e6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/sum-rows-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/unary-ops.c" DIGEST)
if(NOT DIGEST STREQUAL "ee10a8eec9ac2d514d16054c66e49cd399532d3805024fcbd8e447bcc4c742af")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/unary-ops.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/unary-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "47f1451466ca899f6555138f1aa0b5fd28602ebd2840d48d11e1a29d3eed83df")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/unary-ops.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/v73/htp_iface.h" DIGEST)
if(NOT DIGEST STREQUAL "0b637338de2a7e51217fb15a0295e6b39a0a2366eb22ec1fad8d57e9b4da2466")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/v73/htp_iface.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/v73/htp_iface_stub.c" DIGEST)
if(NOT DIGEST STREQUAL "8ac842936f06f1812355d158af234a2dd91987fd6bebe93873fae4974ffd589f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/v73/htp_iface_stub.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/vtcm-utils.h" DIGEST)
if(NOT DIGEST STREQUAL "36babb04e0bdbc7a1a44e83c4ff4e7e4909c5ab606ef3cc2aade04384747bc1d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/vtcm-utils.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/work-queue.c" DIGEST)
if(NOT DIGEST STREQUAL "e12a0175e890c2c732bec6f338c597527d0548da4f6fe09c7aeb0816f766d419")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/work-queue.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/work-queue.h" DIGEST)
if(NOT DIGEST STREQUAL "966ab07319214aa2a1f46672db99959e4e0a7fb59001883282c102dfe617a6a4")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/work-queue.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/worker-pool.c" DIGEST)
if(NOT DIGEST STREQUAL "952461204f522bd9664ee2052128e75d1a44d67d7be7e45e604b3c2b42cc5e3d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/worker-pool.c")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp/worker-pool.h" DIGEST)
if(NOT DIGEST STREQUAL "118f2387865eab5a0df56dfa3d2a90d7f6dcd0f59b985160d0318a10a85fa77a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp/worker-pool.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp-drv.cpp" DIGEST)
if(NOT DIGEST STREQUAL "340bce26f076d909649a432963f709ed38dce8fca3f9cd0f4aa559557ed858c9")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp-drv.cpp")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp-drv.h" DIGEST)
if(NOT DIGEST STREQUAL "246b28b6eb1a6d5da0a043545ec204804690fe4e6e68fbabcb73d99897d280da")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp-drv.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/htp-opnode.h" DIGEST)
if(NOT DIGEST STREQUAL "e2ef33fc68873f2426495956261f774330d4273096f101b883e363034dc76ee1")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/htp-opnode.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/libdl.h" DIGEST)
if(NOT DIGEST STREQUAL "af1f5aa8d4b3f38cfc450991aaed0eff430f0bdb2106b0a9644bfed559ee3bd3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/libdl.h")
endif()
file(SHA256 "${SRC}/ggml-hexagon/libggml-htp.inf" DIGEST)
if(NOT DIGEST STREQUAL "d4458eee3612b9281be900c4a622e613262a52dacbdbab4a6b3e0d4abe6bb7b3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon/libggml-htp.inf")
endif()
file(SHA256 "${SRC}/ggml-hexagon.h" DIGEST)
if(NOT DIGEST STREQUAL "573035cda63cc3ca666baa4aebc6b253035103bd3c23bec1942af6776b3fc988")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-hexagon.h")
endif()
file(SHA256 "${SRC}/ggml-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "44519c69eed19754f3e0bf332c33a86328387e21aae7a5d26bd10db114a31535")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-impl.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-common.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f22d08626e60f3a8f45523d419ba41e1d769091d5150d21b19885353cb7b5847")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-common.cpp")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-common.h" DIGEST)
if(NOT DIGEST STREQUAL "14fc10420fc47501c1ba88f27e73fe860cd65516e2e9afabadf9a92ec6d1f2c8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-common.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-context.h" DIGEST)
if(NOT DIGEST STREQUAL "756503f17f2e7450cda685c3057c4228d7b8ff53d4fd6b7a80209d7395c18f17")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-context.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-context.m" DIGEST)
if(NOT DIGEST STREQUAL "d60a2a40e504b11214481d01f2ee3faf5b836efff26d807c2ac573456827e096")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-context.m")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-device.cpp" DIGEST)
if(NOT DIGEST STREQUAL "413f4842a63fb93e2e417fa4427dd4be90eb0b610e026cc7923cdb716d16e9d5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-device.cpp")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-device.h" DIGEST)
if(NOT DIGEST STREQUAL "e53ecea583599d42a7732d3a3ba65a9e3650258bdb7c10480ecc73021e8524eb")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-device.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-device.m" DIGEST)
if(NOT DIGEST STREQUAL "747d04104969b395d1593773799187d744745c9ebc1e76bcc5c37000d2c3e10b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-device.m")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-embed.s" DIGEST)
if(NOT DIGEST STREQUAL "9de319161cde707a7dac4f3abc925665d333934db21a4af56cb5f9e50b3f5d49")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-embed.s")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "661ebb8b453c1a469b6fe044918a3f199991dc50716b02b058cbeb01ca174aed")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-impl.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-ops.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f66d8eb5cfda76140e08298253c3472b40a9662b723398cf634086efe78529cd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-ops.cpp")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal-ops.h" DIGEST)
if(NOT DIGEST STREQUAL "89595bcfabeb3c9e3d6ac92dae1d5651e05cd1c4f174dfc8e7385cf9b701c221")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal-ops.h")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6277dda3426265062957fa993c30bd6dcbd5bc3010026badc53dce7cff1caddd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal.cpp")
endif()
file(SHA256 "${SRC}/ggml-metal/ggml-metal.metal" DIGEST)
if(NOT DIGEST STREQUAL "0d699ba9e9bb98283c50096b46f44635d5640f89a028a8c3d0c29d1d34067ebe")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal/ggml-metal.metal")
endif()
file(SHA256 "${SRC}/ggml-metal.h" DIGEST)
if(NOT DIGEST STREQUAL "af2a9939ef3bb579096ff718ca23253b83e1519ea2d5e26dbca45bf2b1584e36")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-metal.h")
endif()
file(SHA256 "${SRC}/ggml-opencl/cl-program-cache.cpp" DIGEST)
if(NOT DIGEST STREQUAL "64667eff4ceec360377571e541bbd78ea874ac9e65bf4a0fc9b95d6078fa61c4")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/cl-program-cache.cpp")
endif()
file(SHA256 "${SRC}/ggml-opencl/cl-program-cache.h" DIGEST)
if(NOT DIGEST STREQUAL "afa4de32cc21f538a159105be995573bcb00253a31e9b04f5937d4fb938d1a56")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/cl-program-cache.h")
endif()
file(SHA256 "${SRC}/ggml-opencl/fa_tune.h" DIGEST)
if(NOT DIGEST STREQUAL "35d079c7fadcc62191fd62be3ddf6e6d44e4a4bce476659c5777ab65f852d778")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/fa_tune.h")
endif()
file(SHA256 "${SRC}/ggml-opencl/ggml-opencl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "43f7192a2e383505028fe8d8ae189e2472cf430289c36346726fb43f223b2669")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/ggml-opencl.cpp")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/abs.cl" DIGEST)
if(NOT DIGEST STREQUAL "9c41791e6ec06c5448f3b150b1a59f2d3c9adf2f6cdbd5756bb0369e0e323d06")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/abs.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/add.cl" DIGEST)
if(NOT DIGEST STREQUAL "6238fb564860780ea2d1e06a4e968723f7f8c36e3b116e7bc1144f3577d2364d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/add.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/add_id.cl" DIGEST)
if(NOT DIGEST STREQUAL "2f06cbbb1a9c4c095793a98406f8e85556d753f3bd76cef040eef5991ff74863")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/add_id.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/argsort.cl" DIGEST)
if(NOT DIGEST STREQUAL "117e230784923448ccdd3a889d835bfc2e036c1a88a5dcd69fa08e4d7c23f93f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/argsort.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/clamp.cl" DIGEST)
if(NOT DIGEST STREQUAL "ef45c5fc27d05a0db31e33d087a4b7649296275a1730885f09b5c04c7654af8e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/clamp.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/concat.cl" DIGEST)
if(NOT DIGEST STREQUAL "a846fdb0eecf4f3cd2d0a639dc117e67adfe349a1305549b5fd0f8305bc5fafd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/concat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/conv2d.cl" DIGEST)
if(NOT DIGEST STREQUAL "f62779e3aefedadfb516d0fda3872cf13d8eecb1a55507edc5177879bfe5d712")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/conv2d.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/conv2d_f16_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "69bfd9eb4f94ac075c6e135276b2a3c969735fb42a2a2d793f0505d720d73adb")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/conv2d_f16_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/cpy.cl" DIGEST)
if(NOT DIGEST STREQUAL "d7826e4a069263240ca20c9d88c80063e50036c4bdf6c041476c632bca54c063")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/cpy.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/cumsum.cl" DIGEST)
if(NOT DIGEST STREQUAL "0fd0872ae1160c2f22a55367ff2b92fd405f460b04a18df53b3104d86f3cd9d9")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/cumsum.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/cvt.cl" DIGEST)
if(NOT DIGEST STREQUAL "4e6b09bda87b463d360ec5c119494b20e497b8dd2c7f22e0c7d0adf80af8d1e6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/cvt.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/diag.cl" DIGEST)
if(NOT DIGEST STREQUAL "3cf59888813fe39b08fc5bc40430d08cc3ed31ed1747a043ae4abc0ad2f0484d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/diag.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/diag_mask_inf.cl" DIGEST)
if(NOT DIGEST STREQUAL "5f3e9eb9afd94b718c140ceb1adb9e8bab02d8e93daa6adfd11ac929e900a94e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/diag_mask_inf.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/div.cl" DIGEST)
if(NOT DIGEST STREQUAL "909cd261ce2240aa76c07989035aa3e82afd2c0864712eef22744db11996f14a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/div.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/embed_kernel.py" DIGEST)
if(NOT DIGEST STREQUAL "6d251d56b50405e40f071fd68441ed6fa7c94ad3c46b810b2bc16ee1df4d392e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/embed_kernel.py")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/exp.cl" DIGEST)
if(NOT DIGEST STREQUAL "69be86c93176ff4424b716eafbcf8eac700c389bd30922bd781838488809a72b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/exp.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/expm1.cl" DIGEST)
if(NOT DIGEST STREQUAL "4d8a49e38fdd8afa83ffe47bc28732872a178333fd0cb0aeb9c774852f4b5625")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/expm1.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/fill.cl" DIGEST)
if(NOT DIGEST STREQUAL "13561d91d1a5f0cdb02df812280c79e7f697817195cc3fb5073837616c1cb85f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/fill.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "cf724319f90932ab85f2f6b158b752a9ddeb1e1c9d1708cbd58b0846c5a6035e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "f15fedeb403d614871e9aad5ef402eb7a7a46641234de36c3a7b20d73ec511f0")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_f32_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "3f48e1f3027dd474a005edd1de06135c6e89dd29e10819641ce55f31f82b0081")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_f32_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_f32_q4_0.cl" DIGEST)
if(NOT DIGEST STREQUAL "40ed5745fb192162cb3b24fd2c0cc40514753bb8f050c0cee93df3ca198d9330")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_f32_q4_0.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_f32_q8_0.cl" DIGEST)
if(NOT DIGEST STREQUAL "025db265d63c3c41dddcc1fb32cfa2f55759b7bb92f699909c7018160d7b292f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_f32_q8_0.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/flash_attn_pre_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "93e22dccf1696b21d1c4a2969c1a263c16b5bcce787a71a0f594b450a8ed6b46")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/flash_attn_pre_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gated_delta_net.cl" DIGEST)
if(NOT DIGEST STREQUAL "8479333644d58bbf43c752d8c3220252771f1cc534159454a16456d1b12ecc30")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gated_delta_net.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gelu.cl" DIGEST)
if(NOT DIGEST STREQUAL "7c310cd4cf0b8fadc0826807f5ef0800a4cd263fcbe64c69b24c4c927d9e6588")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gelu.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_mxfp4_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "d31e0f9e255486872c7256777abb272c3cfe4d01a1763bf8c98560f874ea103f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_mxfp4_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_mxfp4_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "57e6c09c514c7f23970ef46804f66edcf06a12b14eb15ef457c6223701b76931")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_mxfp4_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_mxfp4_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "fbd4edb19b542efbaa8dc85dc22a61d02d4ca0387f9fef51fce84bb9c77a9165")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_mxfp4_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q4_0_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "ff76a884eca5749d8cbe229fea4eb3d3606f75a09a33283ef66bb71fba4173a1")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q4_0_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q4_0_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "3425d7ae9da27c5af3cc163359778a3cf7c8984344d166845ebd8d527c749fca")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q4_0_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q4_1_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "f6b00e4e53f4d86dc4cb7cf0d6befed902d3ff538adb763187b58b7f948555e8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q4_1_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q4_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "3e1e79741528073537d833bc197357a6c9d0748479a7332d252419f3a3434443")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q4_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q4_k_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "f25eb336a3aad09d69cee53fced300ec898dbf1c6949078d1d92a52ce54c1958")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q4_k_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q5_0_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "69edb8fa52fa8d23090fac5f7ac288489215ebcdc208075ec1d1abe216c2bdac")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q5_0_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q5_1_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "ac195292d9354decdfa9fd473fb70d1b865d9db79dcc91046a60b6b4c4c07c27")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q5_1_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q5_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "dd7935c2e23b273f5d7f52d1c7ce7b66036dd7d3a0f6a21ef70ed7a3bff9e6a6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q5_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q6_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "51ec4f4d0c999b0e09f3f62915fec0f3adfbef58766ea23bdfcb43fe63f6852e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q6_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q6_k_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "84c86f7f85444f2ce7a6a67ef1f851f4aa58cf8c5df74d032485b0e24f293ffd")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q6_k_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q8_0_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "a5f17669db47f1805a7004b4358bc5927cbabbe1544f5f7e6316bb9e7284dc02")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q8_0_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_moe_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "ff0257129e0d019855ed0ec0fd329a18aceaadadc7a03bfa78f7022eea9b5a1a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_moe_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_iq4_nl_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "0fec735eb684218124a5a7cb12d8e14310b64b61da785100da14d4c359afb63b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_iq4_nl_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_iq4_nl_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "dda415702b97cf1f42b432820c00d40b5de5cbc49d1c813d1bb88f18836b4621")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_iq4_nl_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q1_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "71d56b71df869faef74775534f26350b80e22dff6b590928dad17863437ee779")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q1_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q4_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "84a586fdfadfcd068b688115cd0b2aa8af9d01e3f9f0e83ee5b283b10c29c8ef")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q4_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q4_0_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "b4949be6b2c8a668d773ccff7024ed4953b9227fbe52526a35acebec9f8d9c15")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q4_0_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q4_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "fd0d6518110e8e9136f122e1a07cf81f87c3b5af4ca3bd6fc682abed9ddd6617")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q4_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q4_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "6de4063357a2064806ebc06d6857fe2fbf2b431e332c662339314b28cb2475af")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q4_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q4_k_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "8c274daeb362ea4d94ee76addf2555cd94fccbe89c7e33102dc424e9474b8440")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q4_k_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q5_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "c9f2c99ec7da63fd90726f44f2026e7f8c8320b96086d70ac3793ee8890deb68")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q5_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q5_0_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "f6f6c1c0a7056d463ed21b51e54bee098cb710d825217f61cec285248f230ccf")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q5_0_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q5_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "671abe8bcbbda0ba5cb4d034dac1a3d0cacbbdf8830a4316d00d7cb01fea4cfc")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q5_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q5_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "ab0533c5a339e6788f7f21fb378b1f4c08e33fe87e4a01d0436d890a9a17d49e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q5_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q5_k_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "0a4892a5661e80edc53688a5cbefd32b58514664d0de2552ae86efac47cd2614")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q5_k_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q6_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "11f99794669c6ada56a611a62c82f39cbdd0c6beb2e2573305cc3d78b4b5e8d4")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q6_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q6_k_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "b4c9ddb57676cb29fd0a925d70e08c8c5c0cfcce441915de54f81fdaa44f1df4")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q6_k_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q8_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "fc28ed3601c8d0ff05355d339c2b8c378203d966d11277e4c988736715b35e02")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q8_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_noshuffle_q8_0_q8_1_dp4a.cl" DIGEST)
if(NOT DIGEST STREQUAL "7edc1e0d265818876107ec4fd28945f1740523e4c965c4fb6d1068ffd6f79340")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_noshuffle_q8_0_q8_1_dp4a.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemm_xmem_f16_f32_os8.cl" DIGEST)
if(NOT DIGEST STREQUAL "d97d8a9d13d160d8e5a7afe5f65694b202544e0a32e79f2108a1a41a10fa5dd3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemm_xmem_f16_f32_os8.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_mxfp4_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "ccc19f3d0745f2eb30738c77f8e555c48deb275606e0439f41a8b169e8416f9f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_mxfp4_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_mxfp4_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "7364676cdc93e7748e3b73b887f2f27922b0ee483efb8c8d05eef0dc1eeca9ef")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_mxfp4_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q4_0_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "7b4f3f439c90d80fa7138e16db4dac04ab9845bf0ecc2e9973334df1759eafb8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q4_0_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q4_1_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "60619d405d7aaeff9af4a83e792d541021b5ce3e124d042a674a75565703cbe7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q4_1_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q4_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "4824726c8c56c6d26f075c3d3b1c5bc305611347eed2a08b45573d9462cfae7b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q4_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q5_0_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "1e5f74e6bea6fe9f959ba62aa74d3232d5971a6b082123a7cc7a7578995e0e39")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q5_0_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q5_1_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "c776520fdda51269597c1667641c15deef9a86e614e7696dd38eb162cfd31b4d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q5_1_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q5_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "3697f74eabfca8c5c19b8b3d9589c887668b357167348cbdae159b312a8748ec")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q5_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_moe_q6_k_f32_ns.cl" DIGEST)
if(NOT DIGEST STREQUAL "55be79672e4161a30c9706e14bcc17c7f5efea20ff16735c0c075571afd906e8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_moe_q6_k_f32_ns.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_iq4_nl_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "215d9dbfda486c61981011728e93970b7bce7c919bf77f39e6d8b0c8dc42ab3b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_iq4_nl_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q1_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "30209c8990331e88db260ffa1499facfdec26b5602bc75b4c83ded2bbddb92d2")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q1_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q4_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "fdac7fab2eac03be16846d48161c57f43d08517af072f01098dc39d27df7ee6d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q4_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q4_0_f32_spec.cl" DIGEST)
if(NOT DIGEST STREQUAL "1dbcf646d1fa1daf474be6ab5ac95b9c61af230c31270fc68a505d2cc200f834")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q4_0_f32_spec.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q4_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "42426ee4fea7eac0b4b98049040ecfb6f8e8161e9ceaa1f569e51321154a7a39")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q4_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q4_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "53883d3323e304e95bbc959ee483845a7e978bc21888bd11f1fc86d99a5f67ac")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q4_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q5_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "32cba41c076e9a513a884a7e824378c216ba6b1e9c1eed1b0fb866dc0a15c97e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q5_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q5_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "4bcaf014097558cff9c051529e216ee8107f89f820da0ccfe79a0fb1e0332795")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q5_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q5_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "2ded79ba2103e9b94b57afd7f82625cad877e7b1e9be29f8e4b83e3aad788db5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q5_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q6_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "1b5dc6758675fbba46ae0b224f59893a8f4774a41ba8cbdfe1ea7da6817a2545")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q6_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/gemv_noshuffle_q8_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "82515f31157b13a57b2a25e683cf609289f967cc2d2d69f2be98e03ec569ba97")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/gemv_noshuffle_q8_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/get_rows.cl" DIGEST)
if(NOT DIGEST STREQUAL "7ae68438405590d504e74b7643c03506d155426193c0b61b1aa036d1eb1efb57")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/get_rows.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/glu.cl" DIGEST)
if(NOT DIGEST STREQUAL "c3cdc7d3161dba3a956a8e8452a8a10dabc4625c9db8a4ebfb4c86484c933b97")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/glu.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/group_norm.cl" DIGEST)
if(NOT DIGEST STREQUAL "eb71a746af3208aa308a4880dabc48b56e149ee9c6646e27fa0d9d97f42e8cea")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/group_norm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/im2col_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "c979e828cbe9a92c7b8036e2096d9f971d7480232ab0410988dd319f307b2327")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/im2col_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/im2col_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "cb9ac873bafd985f0cfdb5d83946322ac2a8ea114d72477ab42d1ed306fd7215")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/im2col_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/l2_norm.cl" DIGEST)
if(NOT DIGEST STREQUAL "551e6f18b4ffc74658096c9969b71014ccaa6964a8cf0c6225508d0d0d218dab")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/l2_norm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mean.cl" DIGEST)
if(NOT DIGEST STREQUAL "0c1e5e24b741a99ebce8262b095b4666f2f96a8fe16f49bb1d14b9a60c1c9098")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mean.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/moe_combine.cl" DIGEST)
if(NOT DIGEST STREQUAL "2f1875b7f9d414a6e9f7c000d238c36b23eea4f54fa25a601ecf61ab1b614950")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/moe_combine.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/moe_reorder_b.cl" DIGEST)
if(NOT DIGEST STREQUAL "c2905cf5177a2e10393581ecd45dfa9df13d37530649b7563122551e8058bbc3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/moe_reorder_b.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/moe_reorder_quant_a_q8_1.cl" DIGEST)
if(NOT DIGEST STREQUAL "b8fb1d8b33e73544acde03d5de141250cdec0f663ae1fc3abeced81f408806af")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/moe_reorder_quant_a_q8_1.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/moe_sort_by_expert.cl" DIGEST)
if(NOT DIGEST STREQUAL "b7844d2f9bdd4dba8bd7fb83f1f9eb5bab8bca5fc94d75f3a25053a4b812e8c0")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/moe_sort_by_expert.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul.cl" DIGEST)
if(NOT DIGEST STREQUAL "f47e8fa2844256680b18d7815852ee9b9ada7f10d857ca653111139e21872497")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mat_f16_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "4ab746d6c02edc4865da40f6c555753f40bf66ffb89d50e2ee0c1efff5954795")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mat_f16_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_f16_f32_kq_kqv.cl" DIGEST)
if(NOT DIGEST STREQUAL "4596e973a925b53d6048d97a628637bf643c0f618d2e34b9989ac9f2edf9d356")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_f16_f32_kq_kqv.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_f16_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "a15f4e537d7308b898178c2bf81f63a08ee7b8e9a2b78edf09a464eadf7adb88")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_f16_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_f32_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "b7778884c0a4fd931ebd8b6584ed95d0ace0a41e076edae15929af814d417f55")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_f32_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_iq4_nl_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "60476776abf2c3c039868b10cfeab9de2155ebdd3e0c9119879574230d8bd973")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_iq4_nl_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q1_0_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "19688e37e09a604592a43f09bdb981c636af710686390d27420c0b9dc98fbdf6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q1_0_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q4_0_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "609423c8caaa065e3214725b70f175ea9cb79200dfb8a550a388c5257e051ffa")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q4_0_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q4_1_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "0112ee7384ff4f3adba679061be287430efcdf617853ec4bdbc6f5c4b5a8435d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q4_1_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q4_k_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "12f6e45a94a64a9f085b0ac99dfd000a2351aa9861ae5ccbd5acf7dda47201d5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q4_k_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q5_0_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "afa88d7ed8e4a6fc6f9efa457fdeec950037c024912d3b6fc3534febd9e19f2e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q5_0_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q5_1_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "2fc685da26ae914007b12ea45cb3a8363969376614571e0b5e165a8d82f2cb4d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q5_1_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q5_k_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "86ff5d043dbdadaf9ae20b3ca705ab470ae40104e1798c556339cfa2d0b29722")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q5_k_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q6_k_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "77e47f8f5a7353205cfa29a566b5b4065933aba8f96a4d734283bde763eeb522")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q6_k_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mm_q8_0_f32_l4_lm.cl" DIGEST)
if(NOT DIGEST STREQUAL "e9dee2e88bf65fc8645b048e84a0e6bead25f99878d83989dbb07474f76b5c30")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mm_q8_0_f32_l4_lm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_f16_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "0e616a7a9b211e3f20a48f0e1afe3adbdc1a787d68e897aa61a326e5ee88646d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_f16_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_f16_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "20de041c1a015ec0ba17102353b63ec623bab02087e90fe546ecf9967581f607")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_f16_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_f16_f32_1row.cl" DIGEST)
if(NOT DIGEST STREQUAL "db18c262abddf64502fea480e4d2a8104c944ea620b1ae24e117e322dbdf892e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_f16_f32_1row.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_f16_f32_l4.cl" DIGEST)
if(NOT DIGEST STREQUAL "9612d1074d18887d6eeab5c1b494a7f7f7e4c3e6541d5af0b25cda12d318a15c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_f16_f32_l4.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_f32_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "e94093be0544bffd5f377b008e256dde4341cd29cf7e2f90ef2dbdd688f19fea")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_f32_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_id_mxfp4_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "141c176f220d31d8974cd6c201043284384ed0ff228718f8d61fcc556e2a1c1d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_id_mxfp4_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_id_mxfp4_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "48c44dc196e24d8698db084353e5ecf3df67fb57463ed823afc8170245343512")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_id_mxfp4_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_id_q4_0_f32_8x_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "0830a2b4a3191a01e745abb21b7ea395b2d6736fd65ca15a929e61eec27cf9de")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_id_q4_0_f32_8x_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_id_q8_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "7358049436e4b2740e0ca74e5bc1bb0d8cd19866410bbdc3340b4e40652c9163")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_id_q8_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_id_q8_0_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "23113d9a7e6d25c114309e3ae532d54ff091f2fbf3f4c6373787f1aee4d4d334")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_id_q8_0_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_iq4_nl_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "96f215a4ef37bcc6ce1ea1c3c96ada63adf4984e3145f0dcf7088fbdc6663b79")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_iq4_nl_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_iq4_nl_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "320423827aebd8fa18490575215750e644e894b532618ab99b6665eaeaec9cf6")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_iq4_nl_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_mxfp4_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "40fa6b1b5aa2bed36fb3e96ddedbf25f9f7b2f83f02307228eadbb4377782aad")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_mxfp4_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_mxfp4_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "c6f67690232d858c282f47a39924d252ab55d04436e2df221e9be33d54da471a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_mxfp4_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q1_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "58cd9d350714ee3b569ca3e7cc17220b545209661a6b6a93e18afdd5c9992d98")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q1_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q1_0_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "33a3d2f357b341e3c581096404ef35beb96e517f79c8da835d1b4a909f741f54")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q1_0_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "79484395e986a2971678492750183f7e5d7b07d635a50ca8ee3b3263ec1a4c4c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_0_f32_1d_16x_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "6da8f357a375b21cc908a10eec351b6a63cf4dc91420183be4688bb3dd3dae73")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_0_f32_1d_16x_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_0_f32_1d_8x_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "ec7abec391c516f6f77e7805f10697bf93e6b58f09e2f72b1c3b8c613c3919d3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_0_f32_1d_8x_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_0_f32_8x_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "8f38909620be973c2a8018141093c0278f39eb7ebebafb75ec2245a2747b0748")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_0_f32_8x_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_0_f32_v.cl" DIGEST)
if(NOT DIGEST STREQUAL "d144489d59830879de907bcb8cf98280fcbbba1b06cd36003d1f35614f9cdf77")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_0_f32_v.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "e6bcea67f251124a51e579c359eac7e88bfac128ea5b34fc53e930d38e9db8e0")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_1_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "f13ab4f2a9fbb30d7c54285cbe7ba8fa884bbbaa298102a4eff3f1b24ddb3926")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_1_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "33f27d50ccb006a9d31ab677ac69fab61a39423a8df4f5e55dc17e8f896535b5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q4_k_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "15a59243fabf94d4dc33a98fa70e61d0adee8338bfb60a827b2e63c95034351e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q4_k_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "1689d7c9356666b4a77007879c5722030da317539e362a108e6f24aeccb6a32a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_0_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "25b04934fd9950ace2519c6bd16ff9e931b38c88cbaabb9da35daef5618cab8d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_0_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_1_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "465fa136ffb447ce37ba3311280248baa652557b9eb2dfca49b756be2b8845e3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_1_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_1_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "39db166eb86606fe2012a99b3008dec6d29fdb721d93efa0d6f73f081c12f710")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_1_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "8d2a5eb2eda7c105f23ca74f3b783d8ff9fd2950d5e8e0f24fa9ee008ddc385f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q5_k_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "29f18899004892ccc213435a93e20945258d0e222f6434b44ee81a8403e64cc7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q5_k_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q6_k_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "3a672447e9603cb434b956037aaaf1960c81083e21a18594b2719cfce77e012a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q6_k_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q6_k_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "1ffac95ccbc2ad514fd53a1d3ecb8d0ae04a429d080ecacd64166067b6095d3d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q6_k_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q8_0_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "4b74b38d2bb991b71f20cee993f7eaeddd5e49cfa41ef46bbe1ec2884e489e8b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q8_0_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/mul_mv_q8_0_f32_flat.cl" DIGEST)
if(NOT DIGEST STREQUAL "6e67804f54c5df29988e25980b47d696a09fd05371068482729f191253ee2abb")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/mul_mv_q8_0_f32_flat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/neg.cl" DIGEST)
if(NOT DIGEST STREQUAL "f175c2e9dd58a76304a5c23c8fa575cc96e89766c8ea7c80bab07e1b751548df")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/neg.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/norm.cl" DIGEST)
if(NOT DIGEST STREQUAL "4a40083281f550338d49eff03ef36733ccb00e4839938c5cfa4523684486ef6c")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/norm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/pad.cl" DIGEST)
if(NOT DIGEST STREQUAL "69f8fca26ad3c1b9bb50c7e8fd7cbc540626512ba9807fae3970888f8009f288")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/pad.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/quant_a_q8_1.cl" DIGEST)
if(NOT DIGEST STREQUAL "6ac9eca6b2adc5b3ede60a60a5fd4eade11a66784b58de7ba131c09f5c1242c2")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/quant_a_q8_1.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/relu.cl" DIGEST)
if(NOT DIGEST STREQUAL "cf98afe0fbae9384edcad1503c26849a0f63de52ffe5addc1ea5784b732bc8ce")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/relu.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/repeat.cl" DIGEST)
if(NOT DIGEST STREQUAL "ed6077b921da4d218903abf232da16087d4f555caeaed1532aa84a1111d05b46")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/repeat.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/rms_norm.cl" DIGEST)
if(NOT DIGEST STREQUAL "301104fa843ca7eab5b279ddd3f85c95d789403579515cf9a0d3ad10031f8f13")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/rms_norm.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/rope.cl" DIGEST)
if(NOT DIGEST STREQUAL "825f80b453abb9924a2eee0678f011346daeb3c62bac83bf996c2f47c0c4edf1")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/rope.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/scale.cl" DIGEST)
if(NOT DIGEST STREQUAL "3fe6cf32591d79cb555af2c00b131c586e878ac195a83bc98b5f5f3689876e74")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/scale.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/set_rows.cl" DIGEST)
if(NOT DIGEST STREQUAL "7f41f1eb32d23827ca67d338bdaa204f18271a25b25f40351c62b135eefd9959")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/set_rows.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/sigmoid.cl" DIGEST)
if(NOT DIGEST STREQUAL "3f8d5256d67d68e3e481b0fb44f83c3c31ebc690eabdbae401e2c21458cc2385")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/sigmoid.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/silu.cl" DIGEST)
if(NOT DIGEST STREQUAL "e26acfbc7b9d3319ec3ea50de655f2448860870ef6adad3000cd1e1a4b5b476e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/silu.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/softmax_4_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "f60ab0a37c83a2f7fa3ce98cf9de923b4eb1ff03dbfc8f929341cda468fa5f9d")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/softmax_4_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/softmax_4_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "6d2e6af0bffa7e28a68a1706d2ac9431fcf83824b7ebf475bb0119168a9c44e0")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/softmax_4_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/softmax_f16.cl" DIGEST)
if(NOT DIGEST STREQUAL "99e8c820ef8970f1768a428073bb147d23323a405989f910e6012deab415d4ee")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/softmax_f16.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/softmax_f32.cl" DIGEST)
if(NOT DIGEST STREQUAL "444449e65a299be65277b50ed1eeb5c4a430de979c05ff87cab708417d09cebe")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/softmax_f32.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/softplus.cl" DIGEST)
if(NOT DIGEST STREQUAL "ac89e40d08b774ada9d3f88deaf57e2bf66e146fa2cdd4ed5fd2e3f048818e22")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/softplus.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/solve_tri.cl" DIGEST)
if(NOT DIGEST STREQUAL "404f9eab2e9a5c8f4717837504bc6a7220bcd95ce70c80fba86812132925c2e5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/solve_tri.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/sqr.cl" DIGEST)
if(NOT DIGEST STREQUAL "e30d537e03ef84afdef18d1be5218e6f6e1add812f5f2c19b83c9f32550997e5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/sqr.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/sqrt.cl" DIGEST)
if(NOT DIGEST STREQUAL "57271da1a8960064901070333ef43ecfec2de43b2537ea97ef86ef0c9ed6deae")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/sqrt.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/ssm_conv.cl" DIGEST)
if(NOT DIGEST STREQUAL "7f92b8c836d99c212134bb2163e5c7d09adf854e40f8b57d927de42632b2e4f7")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/ssm_conv.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/sub.cl" DIGEST)
if(NOT DIGEST STREQUAL "1f262f41f74699f4c534730d7ae48b58250afc4ac54b622816984b5b33a08887")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/sub.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/sum_rows.cl" DIGEST)
if(NOT DIGEST STREQUAL "7e82c5900435042a6352f99dc99a62003b35b93ac3a1d997ef0327683de7066b")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/sum_rows.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/tanh.cl" DIGEST)
if(NOT DIGEST STREQUAL "dfdbc6106d1f012941b450da9ac0c51f6d3d53ada86acf5d5938d60d538fe60f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/tanh.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/transpose.cl" DIGEST)
if(NOT DIGEST STREQUAL "997d41b1c528857a9330de02e37da9eb4b60bb746bbbde8eba505038ceb7f095")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/transpose.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/tri.cl" DIGEST)
if(NOT DIGEST STREQUAL "3305a216719b01ce9b8d470a7d698c6260d695cc7bf8709164af72c247b7006e")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/tri.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/tsembd.cl" DIGEST)
if(NOT DIGEST STREQUAL "006463e6dbd3bd70bc286270e373b2e90e1dffcff6f4cde3c701c3d123cacb14")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/tsembd.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/kernels/upscale.cl" DIGEST)
if(NOT DIGEST STREQUAL "d00461bd87317b072782d1727a2fa6d0d4ba2a5c7bc59dbc14f62a5b10dd21c8")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/kernels/upscale.cl")
endif()
file(SHA256 "${SRC}/ggml-opencl/libdl.h" DIGEST)
if(NOT DIGEST STREQUAL "af1f5aa8d4b3f38cfc450991aaed0eff430f0bdb2106b0a9644bfed559ee3bd3")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl/libdl.h")
endif()
file(SHA256 "${SRC}/ggml-opencl.h" DIGEST)
if(NOT DIGEST STREQUAL "93d880b408a2edf3a7a5b213b600cf91aba75f16b3b2682678ba82cac9479a88")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opencl.h")
endif()
file(SHA256 "${SRC}/ggml-opt.cpp" DIGEST)
if(NOT DIGEST STREQUAL "90303cf0d8f353d322219ff8b82d18515d9a3de7ba24a8b41df165618e948e41")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opt.cpp")
endif()
file(SHA256 "${SRC}/ggml-opt.h" DIGEST)
if(NOT DIGEST STREQUAL "fc340c70d708aae6ca7536649fa5e8be0191786d2f0e3849c718ec6076644d02")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-opt.h")
endif()
file(SHA256 "${SRC}/ggml-quants.c" DIGEST)
if(NOT DIGEST STREQUAL "2ac9b8c8431ebe301ca906a487c531d2cccbd4ffe809846fd84499efad0edd4f")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-quants.c")
endif()
file(SHA256 "${SRC}/ggml-quants.h" DIGEST)
if(NOT DIGEST STREQUAL "eb7fd5daefb407e090c35ff7a5190d7c80265ff4e00e2fd66573f8451895139a")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-quants.h")
endif()
file(SHA256 "${SRC}/ggml-threading.cpp" DIGEST)
if(NOT DIGEST STREQUAL "06e9fb8c6aac72c11b6deaedc201675657cbfec974e8fb2d43284a2e54904cf5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-threading.cpp")
endif()
file(SHA256 "${SRC}/ggml-threading.h" DIGEST)
if(NOT DIGEST STREQUAL "23bfbfdf0530c9de79106edba51082291d15034f23b900a16cbf010362561a17")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml-threading.h")
endif()
file(SHA256 "${SRC}/ggml.c" DIGEST)
if(NOT DIGEST STREQUAL "55a93a4f8730bd56546da611df829ed88c02afe1f258f1abd3e7243672e20fff")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml.c")
endif()
file(SHA256 "${SRC}/ggml.h" DIGEST)
if(NOT DIGEST STREQUAL "e78c66f669617f4fb86dc5b6ac73ba7e43ce8f55532f0a44254b7864e1be47f5")
  message(FATAL_ERROR "Pinned llama source mismatch: ggml.h")
endif()
file(SHA256 "${SRC}/gguf.cpp" DIGEST)
if(NOT DIGEST STREQUAL "17e28eda6c57358846718288a5e1d1e2f14f89e50d8575f87e57b858ef421fee")
  message(FATAL_ERROR "Pinned llama source mismatch: gguf.cpp")
endif()
file(SHA256 "${SRC}/gguf.h" DIGEST)
if(NOT DIGEST STREQUAL "80714e4221906a2e8fbe639c005101ce90d8b1475be97c3441fce35a6f102026")
  message(FATAL_ERROR "Pinned llama source mismatch: gguf.h")
endif()
file(SHA256 "${SRC}/jsi/JSICompletion.h" DIGEST)
if(NOT DIGEST STREQUAL "0b4d03a14a1c61fd5a38f75365ad2e57df3b05ac7e3162d2f911beffb20c914c")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSICompletion.h")
endif()
file(SHA256 "${SRC}/jsi/JSIContext.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6b9409c850ac7f7ebee3a6bd00c95c0c497c60b49c63960df83b003a81454fc6")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIContext.cpp")
endif()
file(SHA256 "${SRC}/jsi/JSIContext.h" DIGEST)
if(NOT DIGEST STREQUAL "84e5dd1fec18888a1505fb2993856b74caeae69f706b8bae39b3e4f9fec12286")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIContext.h")
endif()
file(SHA256 "${SRC}/jsi/JSIHelpers.h" DIGEST)
if(NOT DIGEST STREQUAL "906ae5ace758edf9cc2f5d8c70e67ce5e87eaa3cc163f0d3f00ddbe2db3d9435")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIHelpers.h")
endif()
file(SHA256 "${SRC}/jsi/JSINativeHeaders.h" DIGEST)
if(NOT DIGEST STREQUAL "b36dcca15cd3e2d9d4824188ff18f575f46643c29f0c76e728564d3e71b639fc")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSINativeHeaders.h")
endif()
file(SHA256 "${SRC}/jsi/JSIParams.cpp" DIGEST)
if(NOT DIGEST STREQUAL "750e34c98ed0ce21b6f8969f84e721b1bcee424e6de7ce030483288b0e43ba89"
   AND NOT DIGEST STREQUAL "e9cfe1d7db5bd1859623b9d785a7d88f1048cb6aa7b3e561dc6d0c13e7475877")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIParams.cpp")
endif()
file(SHA256 "${SRC}/jsi/JSIParams.h" DIGEST)
if(NOT DIGEST STREQUAL "77e3b04d95f9404d72df247887a104e66ad9da7233b6d4f0c92708298f0997cd")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIParams.h")
endif()
file(SHA256 "${SRC}/jsi/JSIRequestManager.h" DIGEST)
if(NOT DIGEST STREQUAL "cd72c9ed5e20e151cdc00b91f4497fc446bfa88e1366a1c81608370e8f34f6e3")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIRequestManager.h")
endif()
file(SHA256 "${SRC}/jsi/JSISession.h" DIGEST)
if(NOT DIGEST STREQUAL "e0c8dc4d12e50c2108a6271542e1a269cfd273ce76af70bb7ed4968cc65d1bf5")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSISession.h")
endif()
file(SHA256 "${SRC}/jsi/JSITaskManager.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f2d3590c11828755f79d41137286cd289fb18ac9cbe736091affeb448485330f")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSITaskManager.cpp")
endif()
file(SHA256 "${SRC}/jsi/JSITaskManager.h" DIGEST)
if(NOT DIGEST STREQUAL "7d858450cb3c1890fa7f4166867bec9d788f65f128fc2a7e4b19e7b778248fd0")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSITaskManager.h")
endif()
file(SHA256 "${SRC}/jsi/JSIUtils.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2cc996f1e74e42eaec04b782128b280baa0a6e58fed999f15019b6355b999e23")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIUtils.cpp")
endif()
file(SHA256 "${SRC}/jsi/JSIUtils.h" DIGEST)
if(NOT DIGEST STREQUAL "126e8d28cae4b150e0e9665295139520931ae899e1601d3270aecefc48417cb8")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/JSIUtils.h")
endif()
file(SHA256 "${SRC}/jsi/RNLlamaJSI.cpp" DIGEST)
if(NOT DIGEST STREQUAL "c02583fcb0c08e3f6c69a144e54ad14a392ca9b4a65d71f35d8ff16b66ccc3e7"
   AND NOT DIGEST STREQUAL "c8b796539fa7e9ecaec4fe4ee164356ce297532b924481df856d3a06a5f28adf")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/RNLlamaJSI.cpp")
endif()
file(SHA256 "${SRC}/jsi/RNLlamaJSI.h" DIGEST)
if(NOT DIGEST STREQUAL "56850ec0e1101c29570b1f8f5c51bd7583e664ec2b1ba7c87bea5cbbcbbfc33f")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/RNLlamaJSI.h")
endif()
file(SHA256 "${SRC}/jsi/ThreadPool.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d723881651d164ad6fd735e1a261c61ea5dfa1f9e4b4227b6f88f170d5df26ae")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/ThreadPool.cpp")
endif()
file(SHA256 "${SRC}/jsi/ThreadPool.h" DIGEST)
if(NOT DIGEST STREQUAL "79d6234f9aee277d8175a599de9cbd4500b9535e5c7cb87071fab2eb17385cd4")
  message(FATAL_ERROR "Pinned llama source mismatch: jsi/ThreadPool.h")
endif()
file(SHA256 "${SRC}/LICENSE" DIGEST)
if(NOT DIGEST STREQUAL "e562a2ddfaf8280537795ac5ecd34e3012b6582a147ef69ba6a6a5c08c84757d")
  message(FATAL_ERROR "Pinned llama source mismatch: LICENSE")
endif()
file(SHA256 "${SRC}/llama-adapter.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f183d47b38786ae7509ac9e0a1e513cae532968637716d7dd33d98cb7be63dfc")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-adapter.cpp")
endif()
file(SHA256 "${SRC}/llama-adapter.h" DIGEST)
if(NOT DIGEST STREQUAL "1a7c66087fcc619bd243828e6dcea21324daf1cd639b566fc2de6fe76d294f1c")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-adapter.h")
endif()
file(SHA256 "${SRC}/llama-arch.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f838dcb5989b4da39b994001897d6e10700c23151a1bd5fe8385b6bcb251bf66")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-arch.cpp")
endif()
file(SHA256 "${SRC}/llama-arch.h" DIGEST)
if(NOT DIGEST STREQUAL "a7544559ab9db85eadcea1a5ded3b41d9ba717ae6915d88b239494f0bfbb59fd")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-arch.h")
endif()
file(SHA256 "${SRC}/llama-batch.cpp" DIGEST)
if(NOT DIGEST STREQUAL "88f7b462c41fda25c1767880c0d0a70550bfd816a1477663de06de8d5f5ca2fe")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-batch.cpp")
endif()
file(SHA256 "${SRC}/llama-batch.h" DIGEST)
if(NOT DIGEST STREQUAL "7000dfd8750e06c544642dd7b84c882191702ad46ced1a4d6ad109462d1a1013")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-batch.h")
endif()
file(SHA256 "${SRC}/llama-chat.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0029616465e6d641c1e75a0e0e6e132f3ea6177593735d7f16c89e7edfbbe9a8")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-chat.cpp")
endif()
file(SHA256 "${SRC}/llama-chat.h" DIGEST)
if(NOT DIGEST STREQUAL "15d7f3257e01e3f095d79350f969658abfb0f0305a4f9bc734ebfafb067ed80c")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-chat.h")
endif()
file(SHA256 "${SRC}/llama-context.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0821a5fc1726e348b27dff25e29414a44313ca49a07b11029994c3c13fbfb2ee")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-context.cpp")
endif()
file(SHA256 "${SRC}/llama-context.h" DIGEST)
if(NOT DIGEST STREQUAL "d24b04c9d7e3a4a88950bcd0fbb4f5a1e9e864c9acaf61d5db83be194bdc43e6")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-context.h")
endif()
file(SHA256 "${SRC}/llama-cparams.cpp" DIGEST)
if(NOT DIGEST STREQUAL "95ab4b7b72851eb381a3d2ff2e9f18731103ba5f9f5f216882a034319e709297")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-cparams.cpp")
endif()
file(SHA256 "${SRC}/llama-cparams.h" DIGEST)
if(NOT DIGEST STREQUAL "0a75d5c11eda7d0b696820f79eab028bc4807c723618e230bf9878c6e98b83f0")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-cparams.h")
endif()
file(SHA256 "${SRC}/llama-cpp.h" DIGEST)
if(NOT DIGEST STREQUAL "c48fd31095d2403a3bf7cbe98333ba0e61a398ee6e83b56f9d8b7237143b9877")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-cpp.h")
endif()
file(SHA256 "${SRC}/llama-ext.h" DIGEST)
if(NOT DIGEST STREQUAL "b7cd7d69d99d7c345e22e9c5c38a58375c5fa4831f431d483cb70bc90af9aeec")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-ext.h")
endif()
file(SHA256 "${SRC}/llama-grammar.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8fc9bd108cdaef89b1b7fce509ccb9852b2bcbcca9a5696a5bf39fb1dce08c1a")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-grammar.cpp")
endif()
file(SHA256 "${SRC}/llama-grammar.h" DIGEST)
if(NOT DIGEST STREQUAL "db730e5aff77f96274aba4a43670f036400d89c7ed44b6e98d3ced41c7b9d193")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-grammar.h")
endif()
file(SHA256 "${SRC}/llama-graph.cpp" DIGEST)
if(NOT DIGEST STREQUAL "90baa3bdf432e64cc811a93feeedf2553564fa0835664902aae94c84bb09630a")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-graph.cpp")
endif()
file(SHA256 "${SRC}/llama-graph.h" DIGEST)
if(NOT DIGEST STREQUAL "2660be1dd54f1e20b156395dccd89c423cb18024e920dec37c73c3fb52173106")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-graph.h")
endif()
file(SHA256 "${SRC}/llama-hparams.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b7bf58c7e46871753c136727d7aac26e28967728959b98fff139f1bfe3779ce7")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-hparams.cpp")
endif()
file(SHA256 "${SRC}/llama-hparams.h" DIGEST)
if(NOT DIGEST STREQUAL "d81536735944be201abea6b836d79a59d5bcf70b617f27bac4a7269e92c0cb26")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-hparams.h")
endif()
file(SHA256 "${SRC}/llama-impl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b3d497813221035aef20d5fc2dec26c8508aabb2ada284742cebe0050adc5181")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-impl.cpp")
endif()
file(SHA256 "${SRC}/llama-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "395c3dbe5e2b8b04470f73f755978a3b89fb233d6e616a6d2176a2fc8880551d")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-impl.h")
endif()
file(SHA256 "${SRC}/llama-io.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4ed1a8b75a4e82dd765f7b6ca8970bb8a2ae371c56c833af0355231072e70045")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-io.cpp")
endif()
file(SHA256 "${SRC}/llama-io.h" DIGEST)
if(NOT DIGEST STREQUAL "cc3d1a0bccd79cb71f96ac84463454f6cc96da64e55acb5c94d4f0f0334329ac")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-io.h")
endif()
file(SHA256 "${SRC}/llama-kv-cache-dsa.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2ff6f3f587f8b188dfc7a90681723eba4403d55230b6f4f18d99ec0e86a70975")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-dsa.cpp")
endif()
file(SHA256 "${SRC}/llama-kv-cache-dsa.h" DIGEST)
if(NOT DIGEST STREQUAL "bcf757ee7ede8ec0152e62a4d97b5b739a21fba002099dfa002491e5f42ada3f")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-dsa.h")
endif()
file(SHA256 "${SRC}/llama-kv-cache-dsv4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ee4e30ebd9b0872817b79f31bb76b5a57210d291812cc70de3271c8cb5dddec5")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-dsv4.cpp")
endif()
file(SHA256 "${SRC}/llama-kv-cache-dsv4.h" DIGEST)
if(NOT DIGEST STREQUAL "0ee9bdb1f554980575a23b130faabbe5e217015d5e8eba91a789b6432516ad8a")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-dsv4.h")
endif()
file(SHA256 "${SRC}/llama-kv-cache-iswa.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0aac9ed140d0858fa9b2256fe3460bf17f80ac31df96ddd5123824f76e47edd5")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-iswa.cpp")
endif()
file(SHA256 "${SRC}/llama-kv-cache-iswa.h" DIGEST)
if(NOT DIGEST STREQUAL "b49616204286692877a367efcf3aa73cada3955915cfcd61d0bcea7a7b070ef1")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-iswa.h")
endif()
file(SHA256 "${SRC}/llama-kv-cache-msa.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e205e2eba52f546eb9edf8d852084811ff5d2e0638f3d7c9a0f8279657cb89ea")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-msa.cpp")
endif()
file(SHA256 "${SRC}/llama-kv-cache-msa.h" DIGEST)
if(NOT DIGEST STREQUAL "25b476d949e0d8659bfe1963c5f478bf2f4a0d16b148422028fe22cae37674f4")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache-msa.h")
endif()
file(SHA256 "${SRC}/llama-kv-cache.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7a86d85ae6f70404ce079fc57aaab8f53c9b31bc61ae2393a76d2174823f41f5")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache.cpp")
endif()
file(SHA256 "${SRC}/llama-kv-cache.h" DIGEST)
if(NOT DIGEST STREQUAL "ed6ce82e1f1515ae7b1906d6438825d7794399f4227de998b3ce95157b781424")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cache.h")
endif()
file(SHA256 "${SRC}/llama-kv-cells.h" DIGEST)
if(NOT DIGEST STREQUAL "c0a9e9571adcc2521c7cc278cb6da83086afb7d19d10bcf88ce3c83df6ae5545")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-kv-cells.h")
endif()
file(SHA256 "${SRC}/llama-memory-hybrid-iswa.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bbdb56b8de86a8db7fc73f899f298790dbc548300ac8f180b2afead551902df1")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-hybrid-iswa.cpp")
endif()
file(SHA256 "${SRC}/llama-memory-hybrid-iswa.h" DIGEST)
if(NOT DIGEST STREQUAL "fe4e1cc7c39d35e3a525e7af8ce4ab545353f0d9af0f2714e68f7591efe1f3c6")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-hybrid-iswa.h")
endif()
file(SHA256 "${SRC}/llama-memory-hybrid.cpp" DIGEST)
if(NOT DIGEST STREQUAL "55dca05d0593304070b1e64de2e2d2da38403ac90eacdd2edbff9564090f51d7")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-hybrid.cpp")
endif()
file(SHA256 "${SRC}/llama-memory-hybrid.h" DIGEST)
if(NOT DIGEST STREQUAL "c2abff2db2c258b9f1f0199614262fd7669932dfa3bd8c49fb837860fe59faa3")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-hybrid.h")
endif()
file(SHA256 "${SRC}/llama-memory-recurrent.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b74e817e969f4541b9f4d2164955b7e84aed17316dea79aea50cb5b917c29a3a")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-recurrent.cpp")
endif()
file(SHA256 "${SRC}/llama-memory-recurrent.h" DIGEST)
if(NOT DIGEST STREQUAL "6123a35d1b5360b79c9bd93ad260a1a1ef110e3261970c93b0145959759c2495")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory-recurrent.h")
endif()
file(SHA256 "${SRC}/llama-memory.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1bf48d324cfa5fa57d5c486ec17ddd12b844fc40ec82d72ba113a3fe76a1f2c6")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory.cpp")
endif()
file(SHA256 "${SRC}/llama-memory.h" DIGEST)
if(NOT DIGEST STREQUAL "05d272c31c28f6a730c00c59978c328db3eb6849979006da94e298cf870c86d0")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-memory.h")
endif()
file(SHA256 "${SRC}/llama-mmap.cpp" DIGEST)
if(NOT DIGEST STREQUAL "14847bcb8ba50c106815724092ab9694a3bb5188089fd3400370839031455034")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-mmap.cpp")
endif()
file(SHA256 "${SRC}/llama-mmap.h" DIGEST)
if(NOT DIGEST STREQUAL "778d279d36bdbcf55b22480ebf8a4d16cc78db66780e33234ed08a496a66295d")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-mmap.h")
endif()
file(SHA256 "${SRC}/llama-model-loader.cpp" DIGEST)
if(NOT DIGEST STREQUAL "57465e5692d95ac6ba339efada28b7307f2ffd412542c3be43973bf72f54ae72")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model-loader.cpp")
endif()
file(SHA256 "${SRC}/llama-model-loader.h" DIGEST)
if(NOT DIGEST STREQUAL "de1dac0fd334ce2816ee03592c37fea44b2abb387a2063279ab890fa114f3782")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model-loader.h")
endif()
file(SHA256 "${SRC}/llama-model-saver.cpp" DIGEST)
if(NOT DIGEST STREQUAL "61cdf014368a9c154316dfce5ed92ea690bfe255bf4f5a253727410eac92d331")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model-saver.cpp")
endif()
file(SHA256 "${SRC}/llama-model-saver.h" DIGEST)
if(NOT DIGEST STREQUAL "bc2ccd97cc7377986570bb1600546068486da37bfba16445bbc3d896e39d460c")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model-saver.h")
endif()
file(SHA256 "${SRC}/llama-model.cpp" DIGEST)
if(NOT DIGEST STREQUAL "808e3ec434ccbedbb4e3ddd4234b52cd99e235e032a9979630065251e4d38b47")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model.cpp")
endif()
file(SHA256 "${SRC}/llama-model.h" DIGEST)
if(NOT DIGEST STREQUAL "3f144f0bc5a0739dd1cf8f8fc6906a14e3330f1a3831a877f15356ecfb8c96bf")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-model.h")
endif()
file(SHA256 "${SRC}/llama-sampler.cpp" DIGEST)
if(NOT DIGEST STREQUAL "86087f998cfd89aa15c0781155d11fb1beb349f69dd83eb998c78a942ff8bf21")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-sampler.cpp")
endif()
file(SHA256 "${SRC}/llama-sampler.h" DIGEST)
if(NOT DIGEST STREQUAL "668d1a37d305fb81dece86405d49101e86dab6d7041f294c4d7688d59104c930")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-sampler.h")
endif()
file(SHA256 "${SRC}/llama-vocab.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b3ab25c3685414faf6f3aabdc65cf5d4067da8d3a66a0d6f73d3fa97a98adebb")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-vocab.cpp")
endif()
file(SHA256 "${SRC}/llama-vocab.h" DIGEST)
if(NOT DIGEST STREQUAL "864acfeaa8b14c871bc31f9c94e50e26b3a1274219bbb9b99c94263be63af91c")
  message(FATAL_ERROR "Pinned llama source mismatch: llama-vocab.h")
endif()
file(SHA256 "${SRC}/llama.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3b6930f1516ffe88d833760362b796623160f3f4c986c67adb54bd0efea341ac")
  message(FATAL_ERROR "Pinned llama source mismatch: llama.cpp")
endif()
file(SHA256 "${SRC}/llama.h" DIGEST)
if(NOT DIGEST STREQUAL "791c0aba232edbe24c471a75cc2fd1dff999bd3b234b835cd114fc1c6b9e57be")
  message(FATAL_ERROR "Pinned llama source mismatch: llama.h")
endif()
file(SHA256 "${SRC}/models/afmoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a56ee90b17aaf7804d59836129cffd4a817093859f4ad745482662d2dd35a3eb")
  message(FATAL_ERROR "Pinned llama source mismatch: models/afmoe.cpp")
endif()
file(SHA256 "${SRC}/models/apertus.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4c5641cd74b578e8a52f4ca83d152bf6b25f3668456c698f89709854bbbb4403")
  message(FATAL_ERROR "Pinned llama source mismatch: models/apertus.cpp")
endif()
file(SHA256 "${SRC}/models/arcee.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a67646d978776f1d8f47f7d3dc58661969e6fdafa804b82d6c9e5a102870ae78")
  message(FATAL_ERROR "Pinned llama source mismatch: models/arcee.cpp")
endif()
file(SHA256 "${SRC}/models/arctic.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1bf913336ae295758ecbf05e2ef10def26a94cd784ac892aa23ac0156bf062b0")
  message(FATAL_ERROR "Pinned llama source mismatch: models/arctic.cpp")
endif()
file(SHA256 "${SRC}/models/arwkv7.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ee0da54916aeeb73fb984174917f26104d6bbb2904a632567b2927128e9b7f88")
  message(FATAL_ERROR "Pinned llama source mismatch: models/arwkv7.cpp")
endif()
file(SHA256 "${SRC}/models/baichuan.cpp" DIGEST)
if(NOT DIGEST STREQUAL "edd31e6888eed4c40b66a644712f717dba3e8df59619ae2be8e489190f012439")
  message(FATAL_ERROR "Pinned llama source mismatch: models/baichuan.cpp")
endif()
file(SHA256 "${SRC}/models/bailingmoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8dfa72aaaca2bebda714c45fd05da8394e8d1a34e07075591a274ffbe188fdce")
  message(FATAL_ERROR "Pinned llama source mismatch: models/bailingmoe.cpp")
endif()
file(SHA256 "${SRC}/models/bailingmoe2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "41c66298798f4115ce0b282e1fd807bef8680e8526d0b100438e2ecdc3a6b3f5")
  message(FATAL_ERROR "Pinned llama source mismatch: models/bailingmoe2.cpp")
endif()
file(SHA256 "${SRC}/models/bert.cpp" DIGEST)
if(NOT DIGEST STREQUAL "cad6f2ba19875883e094882419a5f6342716f5c6806f365f898b30c581912734")
  message(FATAL_ERROR "Pinned llama source mismatch: models/bert.cpp")
endif()
file(SHA256 "${SRC}/models/bitnet.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9f1f006ced016456d3ab5a0e93c84275a23ebc26224db8328c854962cfcf2a7c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/bitnet.cpp")
endif()
file(SHA256 "${SRC}/models/bloom.cpp" DIGEST)
if(NOT DIGEST STREQUAL "69767866323b207d4a6758f3c11d6e2abd3ac775bbea012451743fa5c6b7b4cf")
  message(FATAL_ERROR "Pinned llama source mismatch: models/bloom.cpp")
endif()
file(SHA256 "${SRC}/models/chameleon.cpp" DIGEST)
if(NOT DIGEST STREQUAL "67eceb729dcc73d225db70b250801aabb11d97fa3dd6f1aab3fc114c1088804e")
  message(FATAL_ERROR "Pinned llama source mismatch: models/chameleon.cpp")
endif()
file(SHA256 "${SRC}/models/chatglm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4bdd6faeb92cb88ebcdba29c88e58f098b4780ee9c14cf7399cca862069a5f1a")
  message(FATAL_ERROR "Pinned llama source mismatch: models/chatglm.cpp")
endif()
file(SHA256 "${SRC}/models/codeshell.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5eff2867471aee4ab1594a0494d3e0464ef8b498c544e496438e7f988c16fda5")
  message(FATAL_ERROR "Pinned llama source mismatch: models/codeshell.cpp")
endif()
file(SHA256 "${SRC}/models/cogvlm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bb2c30162e4db139b95b1e2e3117073fbc11d2c46d567366764057215173cfab")
  message(FATAL_ERROR "Pinned llama source mismatch: models/cogvlm.cpp")
endif()
file(SHA256 "${SRC}/models/cohere2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7049b2d51f0fa9f409f0d76a0c934edaecc58aec3a88f123ff2347f73e26b5a4")
  message(FATAL_ERROR "Pinned llama source mismatch: models/cohere2.cpp")
endif()
file(SHA256 "${SRC}/models/cohere2moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "22285cac4500c6550fbb547430b9ef3b5953305403ee666c7bebc78714bfbf89")
  message(FATAL_ERROR "Pinned llama source mismatch: models/cohere2moe.cpp")
endif()
file(SHA256 "${SRC}/models/command-r.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7be682423fe663a3e64335b4013de71b631be318631bbe7f8f6bb672b67e34b6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/command-r.cpp")
endif()
file(SHA256 "${SRC}/models/dbrx.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ad1984ece0b728e79cd7e7fe16eb7bffdfab226c795e2697f4ccb6edb3951f44")
  message(FATAL_ERROR "Pinned llama source mismatch: models/dbrx.cpp")
endif()
file(SHA256 "${SRC}/models/deci.cpp" DIGEST)
if(NOT DIGEST STREQUAL "dfb235d8687f3b3d043b69d2e3bdac3f1ba34c012b0cb2f4db13e5c440f1b6f1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deci.cpp")
endif()
file(SHA256 "${SRC}/models/deepseek.cpp" DIGEST)
if(NOT DIGEST STREQUAL "aebb23872b52154e5cb43fc4e030900a2d893822c5be4e3863b11df93452137b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deepseek.cpp")
endif()
file(SHA256 "${SRC}/models/deepseek2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1c96bae1f85ed694a5288b6f86797fcfbf6d03e69f00617d6502d4e5d0abb95d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deepseek2.cpp")
endif()
file(SHA256 "${SRC}/models/deepseek2ocr.cpp" DIGEST)
if(NOT DIGEST STREQUAL "580c854d54236872d33b1c0ba91c1ab4207ea9797a1ceb3acbb6e0fe2f5002f4")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deepseek2ocr.cpp")
endif()
file(SHA256 "${SRC}/models/deepseek32.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4dfb6dd17d44dc3079c40035823c627cf8a7133f46eb5a4b70908aeddcbdc2a1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deepseek32.cpp")
endif()
file(SHA256 "${SRC}/models/deepseek4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b0cefd768a81677b33e21a2c41ab87f8b324d2e89888f95b1b6c28913a99abac")
  message(FATAL_ERROR "Pinned llama source mismatch: models/deepseek4.cpp")
endif()
file(SHA256 "${SRC}/models/delta-net-base.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4aeb64bebb5233083426dd52d86558f5799d4dee139ecc7c9536762876f74985")
  message(FATAL_ERROR "Pinned llama source mismatch: models/delta-net-base.cpp")
endif()
file(SHA256 "${SRC}/models/dflash.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a5ac3f2db442ab3636f560fef91459d1959eeb389e76a5d7416f041f4c9ce238")
  message(FATAL_ERROR "Pinned llama source mismatch: models/dflash.cpp")
endif()
file(SHA256 "${SRC}/models/dots1.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d04cab51c556f0ac0682ab715877d54b2503bd7b89f55e576591dc2e2387c55a")
  message(FATAL_ERROR "Pinned llama source mismatch: models/dots1.cpp")
endif()
file(SHA256 "${SRC}/models/dream.cpp" DIGEST)
if(NOT DIGEST STREQUAL "51f64135853186cd8db4363f1f28df99c191b05aa1c95263494e56fb2f49b9da")
  message(FATAL_ERROR "Pinned llama source mismatch: models/dream.cpp")
endif()
file(SHA256 "${SRC}/models/eagle3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "23e5df49c9e2968e12b5ea48150a42128aac4e33861592ef202ec6b8cef72d8b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/eagle3.cpp")
endif()
file(SHA256 "${SRC}/models/ernie4-5-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d0d8283f03cd66335c62456ef13897d080a5cf4d47ee1bfca5d8cb6359e6498f")
  message(FATAL_ERROR "Pinned llama source mismatch: models/ernie4-5-moe.cpp")
endif()
file(SHA256 "${SRC}/models/ernie4-5.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7b7199c650e4981cdec6899ca988ab06fbd30f817880cb334b50ebabf1f8f520")
  message(FATAL_ERROR "Pinned llama source mismatch: models/ernie4-5.cpp")
endif()
file(SHA256 "${SRC}/models/eurobert.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2175628e4ed4fd6425b00f12a6c1c8c597ab0683a55080961f53b98eb2c35dfb")
  message(FATAL_ERROR "Pinned llama source mismatch: models/eurobert.cpp")
endif()
file(SHA256 "${SRC}/models/exaone-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "97bcee789e70f7ab21d538ce14b2311a434676482dc35ab73faed52830ef5e78")
  message(FATAL_ERROR "Pinned llama source mismatch: models/exaone-moe.cpp")
endif()
file(SHA256 "${SRC}/models/exaone.cpp" DIGEST)
if(NOT DIGEST STREQUAL "39c81efbe17311ad62e14a8dfef72b75235d7eff4ae73c4c2fb14976cad87ad1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/exaone.cpp")
endif()
file(SHA256 "${SRC}/models/exaone4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "291f5443ce8538e643b11a350867f44b343a4a635d940077ca7e8d05ddf454a5")
  message(FATAL_ERROR "Pinned llama source mismatch: models/exaone4.cpp")
endif()
file(SHA256 "${SRC}/models/falcon-h1.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4cdb190b6c093fe185da03338973187dee3c34b3f64d2635fa2f51b13030caf7")
  message(FATAL_ERROR "Pinned llama source mismatch: models/falcon-h1.cpp")
endif()
file(SHA256 "${SRC}/models/falcon.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e5181b4788d2a2e36af64d7c10aa8cea271a9419215f4979fe39e5dcaf7eb3d1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/falcon.cpp")
endif()
file(SHA256 "${SRC}/models/gemma-embedding.cpp" DIGEST)
if(NOT DIGEST STREQUAL "fbdd39b1b57cf4bc0e31a19be4bf5160ada5d48e143e6a7a04b2f0edf55c35e8")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma-embedding.cpp")
endif()
file(SHA256 "${SRC}/models/gemma.cpp" DIGEST)
if(NOT DIGEST STREQUAL "fedbc182c34407cb0c44928501dc857d391c69236dca20a9a75deea8e9aaed8b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma.cpp")
endif()
file(SHA256 "${SRC}/models/gemma2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3e2d52815dda1b5949e05162c65d83192631e5768e82fd663f82c87a1eb65416")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma2.cpp")
endif()
file(SHA256 "${SRC}/models/gemma3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bf5ef12389e9c6ea97986f809f00371fb7820a8d90b4bf1db6ec6a873462921f")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma3.cpp")
endif()
file(SHA256 "${SRC}/models/gemma3n.cpp" DIGEST)
if(NOT DIGEST STREQUAL "286b0feae9f4d572052bf25652de812cc68d157b9148168e25f784415426c67c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma3n.cpp")
endif()
file(SHA256 "${SRC}/models/gemma4-assistant.cpp" DIGEST)
if(NOT DIGEST STREQUAL "39206bb93671cbd53095904b054373e02960620e065365744ea2995a41a7bdd7")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma4-assistant.cpp")
endif()
file(SHA256 "${SRC}/models/gemma4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f7faeb2a73e3f81a25de9370110446bf040fbae21ca9c44ba8d07c2bcf572c2c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gemma4.cpp")
endif()
file(SHA256 "${SRC}/models/glm-dsa.cpp" DIGEST)
if(NOT DIGEST STREQUAL "69c5781d664d3a38f35549334540e81d2bbfa39572a09289e4200f5c955830fd")
  message(FATAL_ERROR "Pinned llama source mismatch: models/glm-dsa.cpp")
endif()
file(SHA256 "${SRC}/models/glm4-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "c1397b79df8e96598a2cca361dd7d088e3fab3f7a04ec467f4cdbec1f163394f")
  message(FATAL_ERROR "Pinned llama source mismatch: models/glm4-moe.cpp")
endif()
file(SHA256 "${SRC}/models/glm4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bec277f85b80414c579a715e27f2497624aea1d2a1d070c8a11c21bc2f8a18ee")
  message(FATAL_ERROR "Pinned llama source mismatch: models/glm4.cpp")
endif()
file(SHA256 "${SRC}/models/gpt2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "82f794b0e60e1e8d1481ebb0506be190d1f9323915890fa82c52a9ff60c08753")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gpt2.cpp")
endif()
file(SHA256 "${SRC}/models/gptneox.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6cddd4e920f34ccf80848426bab32dbf8acf7a79e940ea17980c54f3ac4857cf")
  message(FATAL_ERROR "Pinned llama source mismatch: models/gptneox.cpp")
endif()
file(SHA256 "${SRC}/models/granite-hybrid.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7363f0ad5014489e509df4695dd438a4b2b85071b55efe5a829611b098bf04f2")
  message(FATAL_ERROR "Pinned llama source mismatch: models/granite-hybrid.cpp")
endif()
file(SHA256 "${SRC}/models/granite-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "62df31b8f6b97a6e65cc715b978ed94a38cc40eabc2f116b7691711cd55bc764")
  message(FATAL_ERROR "Pinned llama source mismatch: models/granite-moe.cpp")
endif()
file(SHA256 "${SRC}/models/granite.cpp" DIGEST)
if(NOT DIGEST STREQUAL "70afc1988a1b63795879c57bc23c2f0563effb8b0cd1c03bf9cd43c545588889")
  message(FATAL_ERROR "Pinned llama source mismatch: models/granite.cpp")
endif()
file(SHA256 "${SRC}/models/grok.cpp" DIGEST)
if(NOT DIGEST STREQUAL "79edf53cd30bbdd1cae5dc9d3711d242780bbb7c1ebaf70ae71edb9eb247cf58")
  message(FATAL_ERROR "Pinned llama source mismatch: models/grok.cpp")
endif()
file(SHA256 "${SRC}/models/grovemoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "96b28a4ef874407992cc9e018cf6feb79a42377aca57c928855ef6deabf8ff4d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/grovemoe.cpp")
endif()
file(SHA256 "${SRC}/models/hunyuan-dense.cpp" DIGEST)
if(NOT DIGEST STREQUAL "72d728a540dfb3a84efab43efa4231003e560ce19a56a582677d0b8814ec4185")
  message(FATAL_ERROR "Pinned llama source mismatch: models/hunyuan-dense.cpp")
endif()
file(SHA256 "${SRC}/models/hunyuan-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e75b170c29a8812f511c65438fe8446c7123a1808b40221b639e23acf5a35d7e")
  message(FATAL_ERROR "Pinned llama source mismatch: models/hunyuan-moe.cpp")
endif()
file(SHA256 "${SRC}/models/hunyuan-vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "aba3d1622913b24d9f74f667eb36d8a7c6adf7586b96c538a6562bfe2330ce68")
  message(FATAL_ERROR "Pinned llama source mismatch: models/hunyuan-vl.cpp")
endif()
file(SHA256 "${SRC}/models/hy-v3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ed42aed32b8d581b8399596143543eb8e3344e2b0952d1a3d7a0e0417e5dbd06")
  message(FATAL_ERROR "Pinned llama source mismatch: models/hy-v3.cpp")
endif()
file(SHA256 "${SRC}/models/internlm2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "57d6e091c029b6ffb2c913a8f8c15b5f8d2f10593e693fe017726f73acdbd3d6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/internlm2.cpp")
endif()
file(SHA256 "${SRC}/models/jais.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8d920f9ad32e0525deb3994c3b49725b67c96e55929dd2a8942c9ae23c834af9")
  message(FATAL_ERROR "Pinned llama source mismatch: models/jais.cpp")
endif()
file(SHA256 "${SRC}/models/jais2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "67415c9adcc82dedc6d69697db9aa6c87246f9c021fd1eb79d1e4101df7f69f9")
  message(FATAL_ERROR "Pinned llama source mismatch: models/jais2.cpp")
endif()
file(SHA256 "${SRC}/models/jamba.cpp" DIGEST)
if(NOT DIGEST STREQUAL "02cdd02a2e657537d3522439a4752ffa0e30a36c8977917697d9ca94b3a38f7d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/jamba.cpp")
endif()
file(SHA256 "${SRC}/models/jina-bert-v2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "26b31d965b597434b06671d0ae67edf43ab16b4dd432afe2e2e51e2ed54207f2")
  message(FATAL_ERROR "Pinned llama source mismatch: models/jina-bert-v2.cpp")
endif()
file(SHA256 "${SRC}/models/jina-bert-v3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "fa375ba9c4a0c1fe9188c3392572e410757004dfc4709563c5da36c769f168a3")
  message(FATAL_ERROR "Pinned llama source mismatch: models/jina-bert-v3.cpp")
endif()
file(SHA256 "${SRC}/models/kimi-linear.cpp" DIGEST)
if(NOT DIGEST STREQUAL "300bf896c12291fc20ee2771ab1c299e41add8dc228fa79b983aee61b37014f6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/kimi-linear.cpp")
endif()
file(SHA256 "${SRC}/models/laguna.cpp" DIGEST)
if(NOT DIGEST STREQUAL "192ef32ab5b0c40747c603446c724c4c5185e6fcc1470d7d869858bc17bd6538")
  message(FATAL_ERROR "Pinned llama source mismatch: models/laguna.cpp")
endif()
file(SHA256 "${SRC}/models/lfm2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4da948341fb38c401e8fc48179212e821f9bb9189ca4859d9afa586665a5b17a")
  message(FATAL_ERROR "Pinned llama source mismatch: models/lfm2.cpp")
endif()
file(SHA256 "${SRC}/models/lfm2moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9d53d23e0276d883a2533d20f52706d15a0d8dec95b1adfd5dfbe2f36e97bae4")
  message(FATAL_ERROR "Pinned llama source mismatch: models/lfm2moe.cpp")
endif()
file(SHA256 "${SRC}/models/llada-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ab8470d78ca16b7aa78147ac2ef31e9c16b038c73ad7282b1e237e854df3f9b7")
  message(FATAL_ERROR "Pinned llama source mismatch: models/llada-moe.cpp")
endif()
file(SHA256 "${SRC}/models/llada.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a5b08abee785f43930ae15ff5440ec33a34cf8991ac6b277d0de120cbf5a4b3b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/llada.cpp")
endif()
file(SHA256 "${SRC}/models/llama-embed.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bb9245b4c18e6f2ebea1ce72e16cfa10ee7fd1193adbfa370b5e5e205c851dc8")
  message(FATAL_ERROR "Pinned llama source mismatch: models/llama-embed.cpp")
endif()
file(SHA256 "${SRC}/models/llama.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a79cfc748ad63010397aa5093f6401c0f80f84a989b188434049c4ae82167552")
  message(FATAL_ERROR "Pinned llama source mismatch: models/llama.cpp")
endif()
file(SHA256 "${SRC}/models/llama4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2f8d77133efea19da58b3dccbd5b10dd39cddd99822f74a8ae81cd88bb3d1e1d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/llama4.cpp")
endif()
file(SHA256 "${SRC}/models/maincoder.cpp" DIGEST)
if(NOT DIGEST STREQUAL "4882a2d6755071c2bd3cb8744355ff4494458c12f2b3e0bc499c7ae6c1d959e8")
  message(FATAL_ERROR "Pinned llama source mismatch: models/maincoder.cpp")
endif()
file(SHA256 "${SRC}/models/mamba-base.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9d31f94f90a1cb3d8de31095a8e8ccb8981afb0532309f6991926cf3df67e3ed")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mamba-base.cpp")
endif()
file(SHA256 "${SRC}/models/mamba.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a02d53aa57ef8a0342d966d7e1996d0c5adaae0aab3f51e12bb187e97bfe374c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mamba.cpp")
endif()
file(SHA256 "${SRC}/models/mamba2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "18b05431fc5414c92463bd32a6e5270c885268ecd474a8b27b9b166f837b79fa")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mamba2.cpp")
endif()
file(SHA256 "${SRC}/models/mellum.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8f4fe70b93301a0a6d084c08bfa978438d84ca90bb6363d8ecaf978a7f3f8ca1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mellum.cpp")
endif()
file(SHA256 "${SRC}/models/mimo2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "fcd4312f8e256e0b3c584748e7140b8ac2859c14b5cb25f0492c7a1a4c1bb6b3")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mimo2.cpp")
endif()
file(SHA256 "${SRC}/models/minicpm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "742c12eb92763390bab64a55f3b28c5447abcfec1c9af5328a39ed39803c5fad")
  message(FATAL_ERROR "Pinned llama source mismatch: models/minicpm.cpp")
endif()
file(SHA256 "${SRC}/models/minicpm3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "29906844f91801d82990aa5a8290f57082442818df9221e5a436ea9edc7c7574")
  message(FATAL_ERROR "Pinned llama source mismatch: models/minicpm3.cpp")
endif()
file(SHA256 "${SRC}/models/minimax-m2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "60188df3b60b511bc9f87a856c4025d095792453872f25c1a6bf83cfc20a4582")
  message(FATAL_ERROR "Pinned llama source mismatch: models/minimax-m2.cpp")
endif()
file(SHA256 "${SRC}/models/minimax-m3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8c7c76ce73ceae329bae23d0054d663d66c5af17f2a26d7889ea2f4c21aad58d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/minimax-m3.cpp")
endif()
file(SHA256 "${SRC}/models/mistral3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3308c674a429df5a8d2b3167fd2128f0dcd3a43b3af29f666ea1e2aede8a629e")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mistral3.cpp")
endif()
file(SHA256 "${SRC}/models/mistral4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7f37e8d7f76f4fa138ce1edcd93e7acd0eb5df2e11491899e3866efe6df00d1c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mistral4.cpp")
endif()
file(SHA256 "${SRC}/models/models.h" DIGEST)
if(NOT DIGEST STREQUAL "397b0956132182244636f9abfd5e9fd48c14d881ac3b468012417e86f28ef274")
  message(FATAL_ERROR "Pinned llama source mismatch: models/models.h")
endif()
file(SHA256 "${SRC}/models/modern-bert.cpp" DIGEST)
if(NOT DIGEST STREQUAL "75bcef18c373efb5a0c8a5ab073665714369031dae9221a787c42bfb86cd2e23")
  message(FATAL_ERROR "Pinned llama source mismatch: models/modern-bert.cpp")
endif()
file(SHA256 "${SRC}/models/mpt.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b0aae0aa97e15a0136584a193a106fe281e49de53cb8fddcf0cab45d7bded750")
  message(FATAL_ERROR "Pinned llama source mismatch: models/mpt.cpp")
endif()
file(SHA256 "${SRC}/models/nanbeige.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2364be78c9b234f0d7c1a220ce6f0b25bb685d21164a3518bfff85ae5276014c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nanbeige.cpp")
endif()
file(SHA256 "${SRC}/models/nemotron-h-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3ee1d81961f2f4a9e5dfb4bfd58f4eb91fb3682fbef76fdc8958476f65b953c6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nemotron-h-moe.cpp")
endif()
file(SHA256 "${SRC}/models/nemotron-h.cpp" DIGEST)
if(NOT DIGEST STREQUAL "c88fb4d6ff117b0674898fcec8cad00c96c7d9eb6d6395f8c53fe3102dfb05e2")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nemotron-h.cpp")
endif()
file(SHA256 "${SRC}/models/nemotron.cpp" DIGEST)
if(NOT DIGEST STREQUAL "37d6b19fe663646ef45f5a3b2fdd53e0dbc58d6f34f1937e3ddaa2452c2658b6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nemotron.cpp")
endif()
file(SHA256 "${SRC}/models/neo-bert.cpp" DIGEST)
if(NOT DIGEST STREQUAL "523a9e0bdca8c06e702e516712e8dcf31cde582498b82f56f86df50e3349d594")
  message(FATAL_ERROR "Pinned llama source mismatch: models/neo-bert.cpp")
endif()
file(SHA256 "${SRC}/models/nomic-bert-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5e512af0b6468c50620906ef5820d671fce1d3b08cc89e6ef3e78ea057a816d4")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nomic-bert-moe.cpp")
endif()
file(SHA256 "${SRC}/models/nomic-bert.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f3f0478e11211a09b6fcb19c4e86432313799266cc43d7cefef867ed462343d0")
  message(FATAL_ERROR "Pinned llama source mismatch: models/nomic-bert.cpp")
endif()
file(SHA256 "${SRC}/models/olmo.cpp" DIGEST)
if(NOT DIGEST STREQUAL "173d2f7647bbda82ba52be7457c897631aa4dea1a84d30fb26d5101b6318d93d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/olmo.cpp")
endif()
file(SHA256 "${SRC}/models/olmo2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d3e6c0eb93516313419486e56cb21e2d990cd6941ae3cd3a75a41c6c039ad092")
  message(FATAL_ERROR "Pinned llama source mismatch: models/olmo2.cpp")
endif()
file(SHA256 "${SRC}/models/olmoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5f20f35d11eb8f34cd86c673ffd36f9c523ed6509bfb9886cb46ece41cc4ebef")
  message(FATAL_ERROR "Pinned llama source mismatch: models/olmoe.cpp")
endif()
file(SHA256 "${SRC}/models/openai-moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "341d7b7df3e3b40af4d5ab90d8ede0c8e4388642c3493bfb900b874f0507f967")
  message(FATAL_ERROR "Pinned llama source mismatch: models/openai-moe.cpp")
endif()
file(SHA256 "${SRC}/models/openelm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9a49ecc2f87235dcf2a8c36631d895c8810d491caf880281d4aef0b7e0073b0d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/openelm.cpp")
endif()
file(SHA256 "${SRC}/models/orion.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9660d01791a9f67308438a1ff83981e0a97767dccf5479e09a15eb95cb6c0577")
  message(FATAL_ERROR "Pinned llama source mismatch: models/orion.cpp")
endif()
file(SHA256 "${SRC}/models/paddleocr.cpp" DIGEST)
if(NOT DIGEST STREQUAL "17598edde62461aff9ed28758cd2bb385b454baf0fa237e5e2b67be545944345")
  message(FATAL_ERROR "Pinned llama source mismatch: models/paddleocr.cpp")
endif()
file(SHA256 "${SRC}/models/pangu-embed.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2800ced1411fc606301ff8808a58835866994dd2fa8dec22b27bf1a39b413465")
  message(FATAL_ERROR "Pinned llama source mismatch: models/pangu-embed.cpp")
endif()
file(SHA256 "${SRC}/models/phi2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bba78561a1e2c79ee6b303fee3f548ac5af6b04e36f834d839857f43fad34137")
  message(FATAL_ERROR "Pinned llama source mismatch: models/phi2.cpp")
endif()
file(SHA256 "${SRC}/models/phi3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e592a9d5a2b5dfa17720a771f572ef6cf31e89222cdfb72e8bad82824e88eba1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/phi3.cpp")
endif()
file(SHA256 "${SRC}/models/phimoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "8f5338f703fb921878a4e55bfdfe296c2e43ac7855eb1be248f8bd6d72d4187e")
  message(FATAL_ERROR "Pinned llama source mismatch: models/phimoe.cpp")
endif()
file(SHA256 "${SRC}/models/plamo.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1b1ea8bc68e3c5ae424e5d68c068b6eee73dadc8e6b3615b8be219618e67abce")
  message(FATAL_ERROR "Pinned llama source mismatch: models/plamo.cpp")
endif()
file(SHA256 "${SRC}/models/plamo2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b2a8b8479500a4d540abc285c6a65633f5546162bb264e821722482a13078767")
  message(FATAL_ERROR "Pinned llama source mismatch: models/plamo2.cpp")
endif()
file(SHA256 "${SRC}/models/plamo3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "656b25a6ff626450bfa3de65e4c0fa1f666706bee7524c79c72635afda37217d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/plamo3.cpp")
endif()
file(SHA256 "${SRC}/models/plm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3c2e67df1e0fa55616f6527b9b40bfbcb580d8afbc5c06891014636377fbde02")
  message(FATAL_ERROR "Pinned llama source mismatch: models/plm.cpp")
endif()
file(SHA256 "${SRC}/models/qwen.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1cc947c473a08bf530a8d4b1c320238675360a466dcf71a633e2c08c69a1c61f")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen.cpp")
endif()
file(SHA256 "${SRC}/models/qwen2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5507beb7f835fa49afe890ee3350c2c29d1789f7a30973599d9e81004159d016")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen2.cpp")
endif()
file(SHA256 "${SRC}/models/qwen2moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "de116d02f754db6014ad3f43358827839acbb254153d66ad3182331c347be2f3")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen2moe.cpp")
endif()
file(SHA256 "${SRC}/models/qwen2vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e7f4274e28816cc0d5286f6b2e9fb0f058e437211a46197ffc0aee7ff6ed8bac")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen2vl.cpp")
endif()
file(SHA256 "${SRC}/models/qwen3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9a90e1e24a697691c2250e3b03f5d1c498f50021f43645a917916f9a2b770144")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen3.cpp")
endif()
file(SHA256 "${SRC}/models/qwen35.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6521e593f1bd1517451a2167d071a2949d0561872b56a9fe853d91a580be4a72")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen35.cpp")
endif()
file(SHA256 "${SRC}/models/qwen35moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3cafefb0e6643e2e3ba7fc888ec06285385e01614665664857d62cdcec830870")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen35moe.cpp")
endif()
file(SHA256 "${SRC}/models/qwen3moe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bb0a94a193cc9a54624d99ddc68db44c53cb4cad2f160c7ffdd2c970afbd6a9a")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen3moe.cpp")
endif()
file(SHA256 "${SRC}/models/qwen3next.cpp" DIGEST)
if(NOT DIGEST STREQUAL "46667a34b8f7dc9953abcdbc9f5f25257d788d2b53765d4e7ec5485451c519d6")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen3next.cpp")
endif()
file(SHA256 "${SRC}/models/qwen3vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a42e14dc26482c98c0ef35bf88ce8f2c8c035b5d25a629c6e540f1cd7cca1f23")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen3vl.cpp")
endif()
file(SHA256 "${SRC}/models/qwen3vlmoe.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d279bb49ac15e9c0064fde620548e8a4deadc1b50bbac65dda8de300865e17b9")
  message(FATAL_ERROR "Pinned llama source mismatch: models/qwen3vlmoe.cpp")
endif()
file(SHA256 "${SRC}/models/refact.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bd25d472161552eea6308891bc35ea753400886d9cec24ecc31c5c2e27c1d5db")
  message(FATAL_ERROR "Pinned llama source mismatch: models/refact.cpp")
endif()
file(SHA256 "${SRC}/models/rnd1.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d25f6243e0884b56bfea9a06b3e84ec90800b58bd514c15873cdc9469d59b00b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rnd1.cpp")
endif()
file(SHA256 "${SRC}/models/rwkv6-base.cpp" DIGEST)
if(NOT DIGEST STREQUAL "7e6129985865984c0d2472ba2fbd96e574a5c58a139f01947bb531a985d13760")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rwkv6-base.cpp")
endif()
file(SHA256 "${SRC}/models/rwkv6.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0c7fd83b47b6f1346e852f7868d87dee6b9b0093d65997c4bd7ca7cd7a7ec1f1")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rwkv6.cpp")
endif()
file(SHA256 "${SRC}/models/rwkv6qwen2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "50a091b373985eb109799de8b50aabb77ea0e64992265ba11d79293632265efd")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rwkv6qwen2.cpp")
endif()
file(SHA256 "${SRC}/models/rwkv7-base.cpp" DIGEST)
if(NOT DIGEST STREQUAL "412d460939662540a46b0c64ad5d34914f5387e8d7b33e8fd0f32b0f0474a40f")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rwkv7-base.cpp")
endif()
file(SHA256 "${SRC}/models/rwkv7.cpp" DIGEST)
if(NOT DIGEST STREQUAL "59ffb96b219617e7b4ddd6e02557fbc4f469d75bd5653a34ec3a1ce840bf0c9b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/rwkv7.cpp")
endif()
file(SHA256 "${SRC}/models/seed-oss.cpp" DIGEST)
if(NOT DIGEST STREQUAL "baf138b892529359e6b44bc44f191dd3d4330ae3c354ba81e5ddc96ef35a4d0d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/seed-oss.cpp")
endif()
file(SHA256 "${SRC}/models/smallthinker.cpp" DIGEST)
if(NOT DIGEST STREQUAL "3721a8ae77b751e0b79e3b287fc06b0e86c27e554d98bc88a1db68bc8fa8ef65")
  message(FATAL_ERROR "Pinned llama source mismatch: models/smallthinker.cpp")
endif()
file(SHA256 "${SRC}/models/smollm3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "c9a6bc34af0658a19ce78255f34264c8d3ccaf52c88c95f779e29fbc841a2a35")
  message(FATAL_ERROR "Pinned llama source mismatch: models/smollm3.cpp")
endif()
file(SHA256 "${SRC}/models/stablelm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0cdfead740f46e9f0ce46c9a926f7140e93a5cfccd57f2a36baec6a90c6f6e2c")
  message(FATAL_ERROR "Pinned llama source mismatch: models/stablelm.cpp")
endif()
file(SHA256 "${SRC}/models/starcoder.cpp" DIGEST)
if(NOT DIGEST STREQUAL "90eba03f5197d3c1eac764676fbebb32060860e3febdb8302594a0003d848676")
  message(FATAL_ERROR "Pinned llama source mismatch: models/starcoder.cpp")
endif()
file(SHA256 "${SRC}/models/starcoder2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ffc2ed4bdf8346ef6afee21494e5f4e258624bc31d89b1c613f498489d458920")
  message(FATAL_ERROR "Pinned llama source mismatch: models/starcoder2.cpp")
endif()
file(SHA256 "${SRC}/models/step35.cpp" DIGEST)
if(NOT DIGEST STREQUAL "261ad40b82a8c45f32304618418101ae741ccef725fbc84270ae7e2d788f1d6d")
  message(FATAL_ERROR "Pinned llama source mismatch: models/step35.cpp")
endif()
file(SHA256 "${SRC}/models/t5.cpp" DIGEST)
if(NOT DIGEST STREQUAL "018102e47a55cc49e854aad4c1ae9cefe989c8c130f4990905c8ed23ff6bea56")
  message(FATAL_ERROR "Pinned llama source mismatch: models/t5.cpp")
endif()
file(SHA256 "${SRC}/models/t5encoder.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d6ed91afbf9318474ea1967d957a838e3c1183b52b2ff557b1ca024286bb865b")
  message(FATAL_ERROR "Pinned llama source mismatch: models/t5encoder.cpp")
endif()
file(SHA256 "${SRC}/models/talkie.cpp" DIGEST)
if(NOT DIGEST STREQUAL "458f6194186c88e6201453f59bfa154ca58c54acb36ea94332447af41cb6096e")
  message(FATAL_ERROR "Pinned llama source mismatch: models/talkie.cpp")
endif()
file(SHA256 "${SRC}/models/wavtokenizer-dec.cpp" DIGEST)
if(NOT DIGEST STREQUAL "316e37e7db600fffbd7a84279abf532d2ac79354bc75e739aab85c9470cdb7fd")
  message(FATAL_ERROR "Pinned llama source mismatch: models/wavtokenizer-dec.cpp")
endif()
file(SHA256 "${SRC}/models/xverse.cpp" DIGEST)
if(NOT DIGEST STREQUAL "81a3d18cbfebb0747af4ed80563c23fe52090e260c4f40a45ff9c391b00ca7d8")
  message(FATAL_ERROR "Pinned llama source mismatch: models/xverse.cpp")
endif()
file(SHA256 "${SRC}/nlohmann/json.hpp" DIGEST)
if(NOT DIGEST STREQUAL "aaf127c04cb31c406e5b04a63f1ae89369fccde6d8fa7cdda1ed4f32dfc5de63")
  message(FATAL_ERROR "Pinned llama source mismatch: nlohmann/json.hpp")
endif()
file(SHA256 "${SRC}/nlohmann/json_fwd.hpp" DIGEST)
if(NOT DIGEST STREQUAL "fb6aa70cbece087f37ab4685c182b287c53be54f785f981b9db9d30d2d028b37")
  message(FATAL_ERROR "Pinned llama source mismatch: nlohmann/json_fwd.hpp")
endif()
file(SHA256 "${SRC}/README.md" DIGEST)
if(NOT DIGEST STREQUAL "c450fddc2d580866f040ea693b5320546cbdc23de696b8346506d4f8cba8e77f")
  message(FATAL_ERROR "Pinned llama source mismatch: README.md")
endif()
file(SHA256 "${SRC}/rn-common.hpp" DIGEST)
if(NOT DIGEST STREQUAL "0aac4593173ca4db4f3c4e2e8db1575efb4b958fe9f4e2c72d9b65d1788b83af")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-common.hpp")
endif()
file(SHA256 "${SRC}/rn-completion.cpp" DIGEST)
if(NOT DIGEST STREQUAL "a0d2c1e97235bd94ec2b0ed1f87515e7b932b9dbc510d54f8ef264ab553a17d8")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-completion.cpp")
endif()
file(SHA256 "${SRC}/rn-completion.h" DIGEST)
if(NOT DIGEST STREQUAL "a25cadd56859a96c49da8efd58694894039fbb74e69e5e395d230f1323c7f53b")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-completion.h")
endif()
file(SHA256 "${SRC}/rn-llama.cpp" DIGEST)
if(NOT DIGEST STREQUAL "475fc27aa2a0507d0a3c25b799cc578515e844a55750d4256b72cc69c93aaff4")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-llama.cpp")
endif()
file(SHA256 "${SRC}/rn-llama.h" DIGEST)
if(NOT DIGEST STREQUAL "e8413ebbe864fc2b4f07e1cb78df127faf933fe473a65a9a9ad8dc336e91fe45")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-llama.h")
endif()
file(SHA256 "${SRC}/rn-mtmd.hpp" DIGEST)
if(NOT DIGEST STREQUAL "26e39f648a9bf51fc38465e8d31dad99bd3cf433b5d48ef2690cb27cb9f67f50")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-mtmd.hpp")
endif()
file(SHA256 "${SRC}/rn-slot-manager.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0e6a6b8dc2af72028dd0589361d8a88b2a3a7c4b3c879f53d338d9703375cb78")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-slot-manager.cpp")
endif()
file(SHA256 "${SRC}/rn-slot-manager.h" DIGEST)
if(NOT DIGEST STREQUAL "76b457c59ae574134094e203c38d411f1dc7243b6616c4fd13d32d3c80b88dce")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-slot-manager.h")
endif()
file(SHA256 "${SRC}/rn-slot.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0f77eafe81ff7df72151cc7cdf36c0bf096a5858b8ddae37b9dfe39a8ace5a8e")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-slot.cpp")
endif()
file(SHA256 "${SRC}/rn-slot.h" DIGEST)
if(NOT DIGEST STREQUAL "6c44d5d937212addb9e31ec629953937e77be26ba0427047190992e2bf2794d2")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-slot.h")
endif()
file(SHA256 "${SRC}/rn-tts.cpp" DIGEST)
if(NOT DIGEST STREQUAL "87d66023cdb50fb844011b4d77f1d8a9037c091329f42c77308af80175ba5b46")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-tts.cpp")
endif()
file(SHA256 "${SRC}/rn-tts.h" DIGEST)
if(NOT DIGEST STREQUAL "52a9a4d5de7e166bb6e70daca60a7ec265c9bf666d46c3ad7c817787238b36ee")
  message(FATAL_ERROR "Pinned llama source mismatch: rn-tts.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/clip-graph.h" DIGEST)
if(NOT DIGEST STREQUAL "61addc2da44cd43302f82832c16b283d352bf3dc533b6e10596430d367f52450")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/clip-graph.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/clip-impl.h" DIGEST)
if(NOT DIGEST STREQUAL "3ea6dcc9d89a4ff73dc087c06600ffe8541a25bc4453c8ee06c9b9165055f21d")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/clip-impl.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/clip-model.h" DIGEST)
if(NOT DIGEST STREQUAL "8908727f85765ae6eb3915dc9f6879c418adff045ff9072521cc2d0e9de2a30d")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/clip-model.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/clip.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1ee92a15a673fe80ea9bb04ed0fa1e17ad52b4ec73ff1a129e9b18726ae83f9c")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/clip.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/clip.h" DIGEST)
if(NOT DIGEST STREQUAL "c3d4174c6d7474c40d4c39fefd95e70a20fa6999e496c79f0f1462e0b5ad8255")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/clip.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/debug/mtmd-debug.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f3481bbbecd811a137cf716ba00ec0d09cfcb1ed5c3e350843de8f223da17f4d")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/debug/mtmd-debug.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/debug/mtmd-debug.h" DIGEST)
if(NOT DIGEST STREQUAL "38f6ff31eabd791e5d9233b7b0c8abf0e31297219c4859da2b5899a51e18882f")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/debug/mtmd-debug.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/debug/mtmd-debug.md" DIGEST)
if(NOT DIGEST STREQUAL "197063cd54c8beec3b7c7abb10ff96c73e222d3b71df104f221d169ddec16f83")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/debug/mtmd-debug.md")
endif()
file(SHA256 "${SRC}/tools/mtmd/miniaudio/miniaudio.h" DIGEST)
if(NOT DIGEST STREQUAL "ac7af4de748b7e26b777f37e01cee313a308a7296a3eb080e2906b320cc55c89")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/miniaudio/miniaudio.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/cogvlm.cpp" DIGEST)
if(NOT DIGEST STREQUAL "13c64d302421ef9f532b96faf859e5801241ca3af077c769d8de996f06bf5004")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/cogvlm.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/conformer.cpp" DIGEST)
if(NOT DIGEST STREQUAL "5e97222449dbc9af7c66c29cf557ddea385f8b1e74e0012f282cfa01f2c4e794")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/conformer.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/deepseekocr.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f114b38226dee78cb401a104d4f90ced45ad42f07e7c616f0b12509560794b21")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/deepseekocr.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/deepseekocr2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "afe5d405a29638f3145c6e0688ce337f0d3f342bf6f4ccd9d97cd70e68500f8c")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/deepseekocr2.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/dotsocr.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f5d4bcc7578c9bfc75f1699d2c89743da1518d74c9467adcb778bc55d394c827")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/dotsocr.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/exaone4_5.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0d91e54c4ce6f1b95fabadacec71814f95e3c93cb72b89c66d9b8d355ac2bf72")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/exaone4_5.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/gemma4a.cpp" DIGEST)
if(NOT DIGEST STREQUAL "bb215b5981c5002fee90947a7ff7ac45598cae0e53c44447a78ddd3381cfbfbe")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/gemma4a.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/gemma4ua.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1b61ecd0172773eda626dfacf10158bc674d07efd24580c3c7c4686036cc0183")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/gemma4ua.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/gemma4uv.cpp" DIGEST)
if(NOT DIGEST STREQUAL "9232301f6eaa8cbe31b1304f8d6c3957d5e4b0f0af0ec1f8dd93e488125f1500")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/gemma4uv.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/gemma4v.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e342acd761c090bc4f97123702b5e402573aaccc0d6677a6323c603db4103ea3")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/gemma4v.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/glm4v.cpp" DIGEST)
if(NOT DIGEST STREQUAL "2e7b5341c7d618cf5b88c0521b4e395fb8062a6cdf153595bb8dbe146da712c0")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/glm4v.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/granite-speech.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b8553137ae4bb96f31964f8a89971718d4f487b871efad012fc996134c73dc35")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/granite-speech.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/granite4-vision.cpp" DIGEST)
if(NOT DIGEST STREQUAL "21005e561327296b497f74c37337fa66f893b650f77469c69f6a520a759b5f93")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/granite4-vision.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/hunyuanvl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ae67286693af241fe12eafba70693f3330732284f2f164661337258686c67939")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/hunyuanvl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/internvl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b4c394106bdcfeace241fae51fb5593d5cb5495e8ad8104fdc75add4642b517a")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/internvl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/kimik25.cpp" DIGEST)
if(NOT DIGEST STREQUAL "0034426db183d03529c225176081cc22d84fa4c558318c6d4796a872577b6132")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/kimik25.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/kimivl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e1ac6606b934d8fc929fdde2032557624a0d276f9cd6dae47a0bf5c32deebdd7")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/kimivl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/llama4.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1039304f6997a0c881819c8596b176b2e6ebc2cd9036f2e2654d33a1f4d2e787")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/llama4.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/llava.cpp" DIGEST)
if(NOT DIGEST STREQUAL "eb6e536a1c605ce4a7821967ca055fd4dfeffe7da8e1741bf5a0e06f6c3cc1b7")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/llava.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/mimo-audio.cpp" DIGEST)
if(NOT DIGEST STREQUAL "fd0b034427d318affb38d9ee6426cdde415e102cbc517899e7a5c671e691b563")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/mimo-audio.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/mimovl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "49c82352910936a5323446b68a3934d9589dc063ab98cd40fa02af9879498581")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/mimovl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/minicpmv.cpp" DIGEST)
if(NOT DIGEST STREQUAL "6c707cbf6bdbb66046ec33b8ad0fb8c838c1ffab7efc1686f5992e3831875d06")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/minicpmv.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/minimax-m3.cpp" DIGEST)
if(NOT DIGEST STREQUAL "c8c62b807a8eedd765d8fa2c39ebe9d1d6ded3bcb22e330b5f4a70346cf2104c")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/minimax-m3.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/mobilenetv5.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e0e5827bf636b59d170318831c7d1be5814c2220d6b43da477feb35cad5098f9")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/mobilenetv5.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/models.h" DIGEST)
if(NOT DIGEST STREQUAL "a3b4efad6150b1ee26c31beb8809d95f79117dc63373ff1e53cd4740ce19c52a")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/models.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/nemotron-v2-vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "18bcb4eafd63db335ac84a985e7539d7aaae01edbd071e6b0ff68e6f2517a4b3")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/nemotron-v2-vl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/paddleocr.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e228d34fc0997bb76d90c6a1a8d6d35bb51761c37473a1716700eae189047b31")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/paddleocr.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/parakeet.cpp" DIGEST)
if(NOT DIGEST STREQUAL "f12d01b6a1a72a4b6066746d49f2981ba249359fa51e33b9aa9ca63ff27065cf")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/parakeet.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/pixtral.cpp" DIGEST)
if(NOT DIGEST STREQUAL "aeb2bc73c06ddd4f3cda524d8c366e7bfb66fcc3b855ebf6a15d684f3964f6a1")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/pixtral.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/qwen2vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "26397c028d7a9f676555f97923699b23fb9343ff8d06a5bc71a3483f5444ade5")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/qwen2vl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/qwen3a.cpp" DIGEST)
if(NOT DIGEST STREQUAL "06cb128f31c0b0bc6796d3d8ab74ea988cab8de3ddfe2422b484cdce2bfeba44")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/qwen3a.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/qwen3vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "854fbe8b60afab3c5c7aa044475c4f6a6a88428ea5ff0d51aa28c465a50362bc")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/qwen3vl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/siglip.cpp" DIGEST)
if(NOT DIGEST STREQUAL "ee2ef081d1deff785ea134b6d2fa07aa8efe3ea4c40cb94b4dfae44a00e9571b")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/siglip.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/step3vl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d8b89ed853259dfc3bb5a8e721f0d14ffef5f35b6ac7bb3d8ec26f59647edee7")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/step3vl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/whisper-enc.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d9c4bf4397985c99cc3f83aab8fe331365bd79d013acfb83d4d5e5e13bbc8e7f")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/whisper-enc.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/yasa2.cpp" DIGEST)
if(NOT DIGEST STREQUAL "b2f3624985ca352f60d41b13fc5d097a8296124b24a35acc4627b27dfde05a1d")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/yasa2.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/models/youtuvl.cpp" DIGEST)
if(NOT DIGEST STREQUAL "1d246e9684477d8d936dab25c490828206736c24356085eabda15e56630c3b17")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/models/youtuvl.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-audio.cpp" DIGEST)
if(NOT DIGEST STREQUAL "912a249eb8bc4baab05911078e7d0d6e7e3b0e7d2da1762a255a482bb08cf3e4")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-audio.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-audio.h" DIGEST)
if(NOT DIGEST STREQUAL "5e571e959db94be3a7284f69a8191538ed5f68f4b841b77e48e4b0a078bb8470")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-audio.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-helper.cpp" DIGEST)
if(NOT DIGEST STREQUAL "e8a814d5498809b9bd1afb868ed2b4722e1b25ef4d344139ec777721bd63198d")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-helper.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-helper.h" DIGEST)
if(NOT DIGEST STREQUAL "0dd6dd1f6b5dc22b0ec7b91059e2428acd9607dbdb8c9a863396a4a2886ab108")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-helper.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-image.cpp" DIGEST)
if(NOT DIGEST STREQUAL "d25f46a45549f43a782ec9295d777ec79317bdcb5b61236f434a908a7da0a6f2")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-image.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd-image.h" DIGEST)
if(NOT DIGEST STREQUAL "aa6ea8ed75c6ac54754266c38acbf3b10313eecc4807785afd30ec9b0500b777")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd-image.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd.cpp" DIGEST)
if(NOT DIGEST STREQUAL "29f73c3e380cc81a5c7b8a645777ca9b0ca677af462c117645633d59fc8f1056")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd.cpp")
endif()
file(SHA256 "${SRC}/tools/mtmd/mtmd.h" DIGEST)
if(NOT DIGEST STREQUAL "e700f63b2a0ba5bffb74a9924b462f79e13714b03d16cde247c7df4a5ebeee39")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/mtmd.h")
endif()
file(SHA256 "${SRC}/tools/mtmd/stb/stb_image.h" DIGEST)
if(NOT DIGEST STREQUAL "594c2fe35d49488b4382dbfaec8f98366defca819d916ac95becf3e75f4200b3")
  message(FATAL_ERROR "Pinned llama source mismatch: tools/mtmd/stb/stb_image.h")
endif()
file(SHA256 "${SRC}/unicode-data.cpp" DIGEST)
if(NOT DIGEST STREQUAL "95170cd1c105a5b41a1b2dce73b0fae8ce8011ef7897600828bb2babe8b26e5d")
  message(FATAL_ERROR "Pinned llama source mismatch: unicode-data.cpp")
endif()
file(SHA256 "${SRC}/unicode-data.h" DIGEST)
if(NOT DIGEST STREQUAL "1854f4494e5666db6036f0bf4cf818e01588b40b48a89e3372e775c4d5174402")
  message(FATAL_ERROR "Pinned llama source mismatch: unicode-data.h")
endif()
file(SHA256 "${SRC}/unicode.cpp" DIGEST)
if(NOT DIGEST STREQUAL "aa75c6258a7e0d8ddc05476cbe68ce9baae99b8cf9ffad8a8ee545d176cb97da")
  message(FATAL_ERROR "Pinned llama source mismatch: unicode.cpp")
endif()
file(SHA256 "${SRC}/unicode.h" DIGEST)
if(NOT DIGEST STREQUAL "f1562388d5b9d2dac1152ad8eda56e0bcae25dd407cf15d9dd2e96fe0124f4e7")
  message(FATAL_ERROR "Pinned llama source mismatch: unicode.h")
endif()
