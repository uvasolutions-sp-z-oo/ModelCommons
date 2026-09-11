package org.modelcommons.host

import java.nio.ByteBuffer
import java.nio.CharBuffer
import java.nio.charset.CodingErrorAction

internal object NativeWorker {
  val loaded = try { System.loadLibrary("modelcommons_host"); true } catch (_: LinkageError) { false }
  external fun create(): Long
  external fun cancel(handle: Long)
  external fun destroy(handle: Long)
  external fun run(handle: Long, fd: Int, roles: Array<ByteArray>, texts: Array<ByteArray>,
    output: Int, temperature: Float, topP: Float, sink: TokenSink): IntArray
}

/** Token boundaries are byte boundaries, not necessarily Unicode boundaries. */
class TokenSink(private val consume: (String) -> Unit) {
  private val decoder = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
  private val pending = ByteBuffer.allocate(8192)
  fun emit(bytes: ByteArray) { pending.put(bytes); decode(false) }
  fun finish() { decode(true) }
  private fun decode(end: Boolean) {
    pending.flip()
    val chars = CharBuffer.allocate(8192)
    decoder.decode(pending, chars, end).throwExceptionIfError()
    pending.compact()
    if (end) decoder.flush(chars).throwExceptionIfError()
    chars.flip()
    val text = chars.toString()
    // A token piece is <=4 KiB. JSON escaped payload remains well below 16 KiB per chunk.
    var start = 0
    while (start < text.length) {
      var end = minOf(start + 512, text.length)
      if (end < text.length && text[end - 1].isHighSurrogate()) end--
      consume(text.substring(start, end)); start = end
    }
  }
  private fun java.nio.charset.CoderResult.throwExceptionIfError() { if (isError) throwException() }
}
