import { getAssistantSettings } from "../settings";

import { AssistantWidget } from "./assistant-widget";

/**
 * Server entry point for the MASOM Assistant.
 *
 * Mounted in the (website) layout only — never in /admin. When the CMS toggle
 * is off this renders NOTHING: no wrapper, no listeners, and (because the chat
 * bundle is lazy-loaded inside the widget) no chat JavaScript at all.
 *
 * Only presentation settings cross to the client. No key, no provider name, no
 * model id is ever passed as a prop.
 */
export async function AssistantMount() {
  const settings = await getAssistantSettings();
  if (!settings.enabled) return null;

  return (
    <AssistantWidget
      assistantName={settings.name}
      welcomeMessage={settings.welcomeMessage}
    />
  );
}
