package expo.modules.modelcommonsnative.ipc;

import expo.modules.modelcommonsnative.ipc.CapabilitiesParcel;
import expo.modules.modelcommonsnative.ipc.GenerateRequestParcel;
import expo.modules.modelcommonsnative.ipc.IModelCommonsCallback;
import expo.modules.modelcommonsnative.ipc.ModelPageParcel;
import expo.modules.modelcommonsnative.ipc.OperationResultParcel;
import expo.modules.modelcommonsnative.ipc.SessionResultParcel;

interface IModelCommonsService {
  int getApiVersion();
  String getProtocolVersion();
  CapabilitiesParcel getCapabilities();
  ModelPageParcel listModels(String cursor, int limit);
  SessionResultParcel createSession(String modelId, String profileId);
  OperationResultParcel generate(String sessionId, in GenerateRequestParcel request, IModelCommonsCallback callback);
  OperationResultParcel cancel(String sessionId, String requestId);
  OperationResultParcel releaseSession(String sessionId);
}
