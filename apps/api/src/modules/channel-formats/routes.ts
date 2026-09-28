import type { ApiRoutes } from "../../app.js";
import { createChannelFormatsRepository } from "./repository.js";

/** Con kind e specs: la UI costruisce da qui lo stesso schema del server per validare gli edit. */
export const channelFormatRoutes: ApiRoutes = (api, { db }) => {
  const formats = createChannelFormatsRepository(db);

  api.get("/channel-formats", async () => formats.list());
};
