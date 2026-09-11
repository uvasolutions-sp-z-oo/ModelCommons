package expo.modules.modelcommonsnative.service

import org.junit.Assert.*
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicInteger

class InferenceCoordinatorTest {
  @Test fun mutationCannotReleaseAnotherRequestsLease() {
    val generation = Any(); val deletion = Any()
    assertTrue(InferenceCoordinator.acquire(generation))
    try {
      assertFalse(InferenceCoordinator.acquire(deletion))
      InferenceCoordinator.release(deletion)
      assertTrue(InferenceCoordinator.busy())
    } finally { InferenceCoordinator.release(generation) }
    assertTrue(InferenceCoordinator.acquire(deletion))
    InferenceCoordinator.release(deletion)
  }
  @Test fun concurrentClientsAdmitExactlyOneOwner() {
    val start = CountDownLatch(1); val finished = CountDownLatch(16)
    val admitted = AtomicInteger(); val tokens = (0 until 16).map { Any() }
    tokens.forEach { token -> Thread {
      start.await()
      if (InferenceCoordinator.acquire(token)) admitted.incrementAndGet()
      finished.countDown()
    }.start() }
    start.countDown(); finished.await()
    try { assertEquals(1, admitted.get()) } finally { tokens.forEach(InferenceCoordinator::release) }
  }
}
