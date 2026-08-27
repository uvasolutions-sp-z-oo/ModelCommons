import { requireOptionalNativeModule } from 'expo-modules-core';
import type { ModelCommonsNativeModuleShape } from './types';

export default requireOptionalNativeModule<ModelCommonsNativeModuleShape>('ModelCommonsNative');
