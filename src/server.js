import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(`Lab SDS Library is running at ${env.APP_URL}`);
});
