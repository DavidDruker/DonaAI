import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SecretaryApp from "./src/SecretaryApp";

function Root() {
  return (
    <SafeAreaProvider>
      <SecretaryApp />
    </SafeAreaProvider>
  );
}

registerRootComponent(Root);
