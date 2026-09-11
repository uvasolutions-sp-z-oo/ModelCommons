package org.modelcommons.host

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class HostModule : Module() {
  override fun definition() = ModuleDefinition { Name("ModelCommonsInferenceHost") }
}
