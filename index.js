import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";

import DonaAIApp from "./src/DonaAIApp";

function Root() {
  return (
    <SafeAreaProvider>
      <DonaAIApp />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
