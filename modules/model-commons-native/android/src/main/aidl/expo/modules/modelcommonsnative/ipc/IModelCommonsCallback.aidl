package expo.modules.modelcommonsnative.ipc;

import expo.modules.modelcommonsnative.ipc.StreamEventParcel;

interface IModelCommonsCallback {
  oneway void onEvent(in StreamEventParcel event);
}
