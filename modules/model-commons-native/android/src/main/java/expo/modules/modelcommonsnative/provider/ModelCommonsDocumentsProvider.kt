package expo.modules.modelcommonsnative.provider

import android.database.Cursor
import android.database.MatrixCursor
import android.os.CancellationSignal
import android.os.OperationCanceledException
import android.os.ParcelFileDescriptor
import android.provider.DocumentsContract
import android.provider.DocumentsProvider
import android.system.Os
import android.system.OsConstants
import expo.modules.modelcommonsnative.storage.AndroidSharedStoreIndex
import java.io.FileNotFoundException

/** Exposes only published ModelCommons metadata and READY artifacts, read-only. */
class ModelCommonsDocumentsProvider : DocumentsProvider() {
  override fun onCreate(): Boolean = context != null

  override fun queryRoots(projection: Array<out String>?): Cursor {
    val columns = projection ?: ROOT_COLUMNS
    return MatrixCursor(columns).apply {
      val row = newRow()
      put(row, columns, DocumentsContract.Root.COLUMN_ROOT_ID, ROOT_ID)
      put(row, columns, DocumentsContract.Root.COLUMN_DOCUMENT_ID, AndroidSharedStoreIndex.ROOT_DOCUMENT_ID)
      put(row, columns, DocumentsContract.Root.COLUMN_TITLE, AndroidSharedStoreIndex.ROOT_TITLE)
      put(row, columns, DocumentsContract.Root.COLUMN_SUMMARY, "Verified, read-only on-device model files")
      put(row, columns, DocumentsContract.Root.COLUMN_FLAGS,
        DocumentsContract.Root.FLAG_LOCAL_ONLY or DocumentsContract.Root.FLAG_SUPPORTS_IS_CHILD)
      put(row, columns, DocumentsContract.Root.COLUMN_MIME_TYPES, "application/json\napplication/octet-stream")
    }
  }

  override fun queryDocument(documentId: String, projection: Array<out String>?): Cursor {
    val columns = projection ?: DOCUMENT_COLUMNS
    val index = index()
    val node = if (documentId == AndroidSharedStoreIndex.ROOT_DOCUMENT_ID) index.rootNode()
      else index.nodes()[documentId] ?: throw FileNotFoundException("Unknown ModelCommons document.")
    return MatrixCursor(columns).apply { include(this, columns, node) }
  }

  override fun queryChildDocuments(
    parentDocumentId: String,
    projection: Array<out String>?,
    sortOrder: String?,
  ): Cursor {
    val columns = projection ?: DOCUMENT_COLUMNS
    val index = index()
    val nodes = index.nodes()
    val parent = if (parentDocumentId == AndroidSharedStoreIndex.ROOT_DOCUMENT_ID) index.rootNode()
      else nodes[parentDocumentId] ?: throw FileNotFoundException("Unknown ModelCommons directory.")
    if (!parent.directory) throw FileNotFoundException("ModelCommons document is not a directory.")
    return MatrixCursor(columns).apply {
      nodes.values.filter { it.parentId == parentDocumentId }
        .sortedBy { it.displayName.lowercase() }
        .forEach { include(this, columns, it) }
    }
  }

  override fun openDocument(
    documentId: String,
    mode: String,
    signal: CancellationSignal?,
  ): ParcelFileDescriptor {
    if (mode != "r") throw FileNotFoundException("ModelCommons shared documents are read-only.")
    signal?.throwIfCanceled()
    val node = index().nodes()[documentId] ?: throw FileNotFoundException("Unknown ModelCommons document.")
    val file = node.file ?: throw FileNotFoundException("ModelCommons directories cannot be opened as files.")
    signal?.throwIfCanceled()
    try {
      val descriptor = Os.open(file.path,
        OsConstants.O_RDONLY or OsConstants.O_NOFOLLOW or OsConstants.O_CLOEXEC, 0)
      try {
        val stat = Os.fstat(descriptor)
        if (!OsConstants.S_ISREG(stat.st_mode) || stat.st_size <= 0L) {
          throw FileNotFoundException("ModelCommons document is not a regular file.")
        }
        signal?.throwIfCanceled()
        return ParcelFileDescriptor.dup(descriptor)
      } finally {
        Os.close(descriptor)
      }
    } catch (error: FileNotFoundException) {
      throw error
    } catch (error: OperationCanceledException) {
      throw error
    } catch (error: Exception) {
      throw FileNotFoundException("ModelCommons document could not be opened safely.").apply {
        initCause(error)
      }
    }
  }

  override fun isChildDocument(parentDocumentId: String, documentId: String): Boolean {
    if (parentDocumentId == documentId) return true
    val nodes = runCatching { index().nodes() }.getOrElse { return false }
    var current = nodes[documentId] ?: return false
    repeat(12) {
      if (current.parentId == parentDocumentId) return true
      current = nodes[current.parentId] ?: return false
    }
    return false
  }

  private fun index() = AndroidSharedStoreIndex(requireNotNull(context))

  private fun include(cursor: MatrixCursor, columns: Array<out String>, node: AndroidSharedStoreIndex.Node) {
    val row = cursor.newRow()
    put(row, columns, DocumentsContract.Document.COLUMN_DOCUMENT_ID, node.id)
    put(row, columns, DocumentsContract.Document.COLUMN_DISPLAY_NAME, node.displayName)
    put(row, columns, DocumentsContract.Document.COLUMN_MIME_TYPE, node.mimeType)
    put(row, columns, DocumentsContract.Document.COLUMN_FLAGS, 0)
    node.file?.let {
      put(row, columns, DocumentsContract.Document.COLUMN_SIZE, it.length())
      put(row, columns, DocumentsContract.Document.COLUMN_LAST_MODIFIED, it.lastModified())
    }
  }

  private fun put(row: MatrixCursor.RowBuilder, columns: Array<out String>, name: String, value: Any?) {
    if (columns.contains(name)) row.add(name, value)
  }

  companion object {
    private const val ROOT_ID = "modelcommons-shared-root"
    private val ROOT_COLUMNS = arrayOf(
      DocumentsContract.Root.COLUMN_ROOT_ID,
      DocumentsContract.Root.COLUMN_DOCUMENT_ID,
      DocumentsContract.Root.COLUMN_TITLE,
      DocumentsContract.Root.COLUMN_SUMMARY,
      DocumentsContract.Root.COLUMN_FLAGS,
      DocumentsContract.Root.COLUMN_MIME_TYPES,
    )
    private val DOCUMENT_COLUMNS = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_FLAGS,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED,
    )
  }
}
